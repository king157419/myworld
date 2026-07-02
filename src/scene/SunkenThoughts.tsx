import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { R_COURT, tidePhase, LECTERN } from "../theme";
import { useZoneEntries } from "../ui/useZoneEntries";
import { spawnRipple } from "./ripples";
import { glowTexture } from "./gallery/glow";
import type { Entry } from "../config/types";

// ─────────────────────────────────────────────────────────────────────────────
// SunkenThoughts — 沉在星海里的思绪光点。
//
// 每一条思考（Entry type="thought", zoneId="zone-bookshelf"）在水下对应一颗
// 微弱的生物荧光点：随潮汐缓缓沉浮，随涨潮渐亮，随落潮渐暗。
// 写下新思考时：光点从写作台位置下沉到它的安息深度，触发一圈涟漪。
//
// 渲染结构：两个 InstancedMesh（核心球 + 晕圈球）+ 父组件单个 useFrame。
// 这是场景里唯一随用户内容无界生长的部分——之前每颗光点自带 useFrame、每帧各调一次
// Date.now()、各持两份透明材质（60 颗 = 60 个回调 + 120 个无法合批的透明 draw）。
// 透明度折进 instanceColor：加色混合下 (色×α, opacity 1) ≡ (色, opacity α)，逐实例可调。
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MOTES = 60;
const SINK_DURATION = 3.5; // 秒：新思考从水面沉到安息位的动画时长

const CORE_R = 0.055;
const HALO_SIZE = 0.5; // 晕圈点精灵的世界尺寸（sizeAttenuation）

// 暖金色（"沉在水里的思绪"——在一整片冷色星海里，你的念头是暖的，一眼能认出）
const CORE_COLOR = new THREE.Color("#ffe0a6").multiplyScalar(1.7);
const HALO_COLOR = new THREE.Color("#ff9e52");

// ─── 哈希工具 ─────────────────────────────────────────────────────────────────
// 由思考 id（UUID）生成三个独立的 [0..1) 浮点值，结果永远稳定。
function idHash(id: string): [number, number, number] {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x6b137941;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x5bd1e995);
    h2 = Math.imul(h2 ^ c, 0x9e3779b9);
    h3 = Math.imul(h3 ^ (c * 31), 0x85ebca6b);
  }
  h1 ^= h1 >>> 16;
  h2 ^= h2 >>> 13;
  h3 ^= h3 >>> 17;
  return [(h1 >>> 0) / 0xffffffff, (h2 >>> 0) / 0xffffffff, (h3 >>> 0) / 0xffffffff];
}

// 从 id 推导稳定的安息位。
// x/z 极坐标散布在 [minR, R_COURT-1.2] 内，避开中心 1.6m（lectern/deck 区域）。
// restY：-0.35（浅）~ -1.4（深）。
function stablePosition(id: string): { x: number; z: number; restY: number } {
  const [h1, h2, h3] = idHash(id);
  const angle = h1 * Math.PI * 2;
  const r = 1.6 + h2 * (R_COURT - 1.2 - 1.6);
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;
  const restY = -0.35 - h3 * 1.05;
  return { x, z, restY };
}

// 单个光点的运行时状态（存在 Map<id, MoteState> ref 里，不触发 React re-render）。
interface MoteState {
  entry: Entry;
  x: number;
  z: number;
  restY: number;
  bobPhase: number;
  driftPhaseX: number;
  driftPhaseZ: number;
  sinkTriggered: boolean; // 已触发落水涟漪
}

function makeState(entry: Entry): MoteState {
  const { x, z, restY } = stablePosition(entry.id);
  const [h1, h2, h3] = idHash(entry.id);
  return {
    entry,
    x,
    z,
    restY,
    bobPhase: h1 * Math.PI * 2,
    driftPhaseX: h2 * Math.PI * 2,
    driftPhaseZ: h3 * Math.PI * 2,
    sinkTriggered: false,
  };
}

export default function SunkenThoughts() {
  // zustand v5 selector 规则：不在选择器里 filter（getSnapshot 循环）。
  // useZoneEntries 在 useMemo 里 filter，符合规范。
  const thoughts = useZoneEntries("zone-bookshelf", "thought");

  // 最多渲染 MAX_MOTES 条（hook 已按 createdAt 倒序，最新在前）
  const visible = useMemo(() => thoughts.slice(0, MAX_MOTES), [thoughts]);

  const coreRef = useRef<THREE.InstancedMesh>(null);
  const states = useRef<Map<string, MoteState>>(new Map());

  // 晕圈：Points + 径向渐变贴图（一次绘制）。此前是 60 颗半径 0.22 的加色低分球——
  // 近看是"橙色八边形煎蛋"（审计 P4）；点精灵永远面向相机、边缘按贴图衰减，无轮廓可穿帮。
  const halo = useMemo(() => {
    const pos = new Float32Array(MAX_MOTES * 3);
    const col = new Float32Array(MAX_MOTES * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setDrawRange(0, 0);
    const m = new THREE.PointsMaterial({
      map: glowTexture(),
      size: HALO_SIZE,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    return { g, m, pos, col };
  }, []);

  // 同步 visible 变化：清理已删除的、更新 entry 引用（新增在帧循环里惰性建，保证首帧即现）。
  useEffect(() => {
    const map = states.current;
    const ids = new Set(visible.map((e) => e.id));
    for (const id of map.keys()) {
      if (!ids.has(id)) map.delete(id);
    }
    for (const entry of visible) {
      const st = map.get(entry.id);
      if (st) st.entry = entry; // 编辑后引用更新（createdAt 不变，状态保持）
    }
  }, [visible]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  useFrame((s) => {
    const core = coreRef.current;
    if (!core) return;
    const t = s.clock.elapsedTime;
    const now = Date.now(); // 每帧一次，60 颗共用
    const tideShift = (tidePhase(t) - 0.5) * 0.35;

    let n = 0;
    for (const entry of visible) {
      let st = states.current.get(entry.id);
      if (!st) {
        st = makeState(entry);
        states.current.set(entry.id, st);
      }
      const ageSec = (now - entry.createdAt) / 1000;
      let curX: number;
      let curZ: number;
      let curY: number;

      if (ageSec < SINK_DURATION) {
        // 沉入动画：从写作台 (LECTERN) 水面 y=0 沿 ease-out cubic 下沉到安息位。
        const prog = Math.max(0, Math.min(1, ageSec / SINK_DURATION));
        const ease = 1 - Math.pow(1 - prog, 3);
        curX = LECTERN[0] + (st.x - LECTERN[0]) * ease;
        curZ = LECTERN[2] + (st.z - LECTERN[2]) * ease;
        curY = (st.restY + tideShift) * ease; // 从 y=0 平滑下沉

        if (!st.sinkTriggered) {
          spawnRipple(LECTERN[0], LECTERN[2], t, 1.4);
          st.sinkTriggered = true;
        }
      } else {
        // 安息状态：潮汐缓升降 + 个性慢漂
        const bobY = Math.sin(t * 0.22 + st.bobPhase) * 0.045;
        curX = st.x + Math.sin(t * 0.11 + st.driftPhaseX) * 0.12;
        curZ = st.z + Math.cos(t * 0.09 + st.driftPhaseZ) * 0.12;
        curY = st.restY + tideShift + bobY;
      }

      tmpMat.makeTranslation(curX, curY, curZ);
      core.setMatrixAt(n, tmpMat);
      halo.pos[n * 3] = curX;
      halo.pos[n * 3 + 1] = curY;
      halo.pos[n * 3 + 2] = curZ;

      // 深度 → 亮度：curY ≈ -0.1（高潮浅处）~ -1.6（低潮深处）
      const depthFactor = Math.max(0, Math.min(1, (curY + 1.6) / 1.5));
      const baseAlpha = 0.3 + depthFactor * 0.6; // 0.3 ~ 0.9
      core.setColorAt(n, tmpCol.copy(CORE_COLOR).multiplyScalar(Math.min(1, baseAlpha * 1.1)));
      tmpCol.copy(HALO_COLOR).multiplyScalar(baseAlpha * 0.5);
      halo.col[n * 3] = tmpCol.r;
      halo.col[n * 3 + 1] = tmpCol.g;
      halo.col[n * 3 + 2] = tmpCol.b;
      n++;
    }

    core.count = n;
    core.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    halo.g.setDrawRange(0, n);
    (halo.g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (halo.g.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group name="sunken-thoughts">
      {/* 核心亮点（实例化）。renderOrder=4：在水面(2)/涟漪(3)之后画——反射水面比旧玻璃水
          不透明得多，光点若按深度序先画会被水面盖到只剩 15%；后画 = "荧光透水而出"。
          水面不写深度，此处仍做深度测试 → 不会鬼影穿透观星台/书墙等实体。 */}
      <instancedMesh ref={coreRef} args={[undefined, undefined, MAX_MOTES]} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[CORE_R, 12, 9]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      {/* 柔光晕圈（点精灵，一次绘制） */}
      <points geometry={halo.g} material={halo.m} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
