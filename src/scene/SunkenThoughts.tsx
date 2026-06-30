import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { R_COURT, tidePhase, LECTERN } from "../theme";
import { useZoneEntries } from "../ui/useZoneEntries";
import { spawnRipple } from "./ripples";
import type { Entry } from "../config/types";

// ─────────────────────────────────────────────────────────────────────────────
// SunkenThoughts — 沉在星海里的思绪光点。
//
// 每一条思考（Entry type="thought", zoneId="zone-bookshelf"）在水下对应一颗
// 微弱的生物荧光点：随潮汐缓缓沉浮，随涨潮渐亮，随落潮渐暗。
// 写下新思考时：光点从写作台位置下沉到它的安息深度，触发一圈涟漪。
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MOTES = 60;
const SINK_DURATION = 3.5; // 秒：新思考从水面沉到安息位的动画时长

// 光点核心半径 / 晕圈半径
const CORE_R = 0.065;
const HALO_R = 0.22;

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
  bobPhase: number;       // 慢漂 Y 相位（由 id 派生，0..2π）
  driftPhaseX: number;    // x 方向漂移相位
  driftPhaseZ: number;    // z 方向漂移相位
  sinkTriggered: boolean; // 已触发落水涟漪
}

// ─── 单个光点：核心球 + 晕圈球 ───────────────────────────────────────────────
interface MoteInstanceProps {
  state: MoteState;
  coreGeo: THREE.SphereGeometry;
  haloGeo: THREE.SphereGeometry;
}

function MoteInstance({ state, coreGeo, haloGeo }: MoteInstanceProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // 每个光点各自独立的材质实例（需独立控制 opacity）
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CORE_COLOR,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: HALO_COLOR,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      coreMat.dispose();
      haloMat.dispose();
    };
  }, [coreMat, haloMat]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const ageSec = (Date.now() - state.entry.createdAt) / 1000;
    let curX: number;
    let curZ: number;
    let curY: number;

    if (ageSec < SINK_DURATION) {
      // 沉入动画：从写作台 (LECTERN) 水面 y=0 沿 ease-out cubic 下沉到安息位。
      const prog = Math.max(0, Math.min(1, ageSec / SINK_DURATION));
      const ease = 1 - Math.pow(1 - prog, 3);
      curX = LECTERN[0] + (state.x - LECTERN[0]) * ease;
      curZ = LECTERN[2] + (state.z - LECTERN[2]) * ease;
      const tideShift = (tidePhase(t) - 0.5) * 0.35;
      curY = (state.restY + tideShift) * ease; // 从 y=0 平滑下沉

      // 首帧触发涟漪（仅一次）
      if (!state.sinkTriggered) {
        spawnRipple(LECTERN[0], LECTERN[2], t, 1.4);
        state.sinkTriggered = true;
      }
    } else {
      // 安息状态：潮汐缓升降 + 个性慢漂
      const tideShift = (tidePhase(t) - 0.5) * 0.35;
      const bobY = Math.sin(t * 0.22 + state.bobPhase) * 0.045;
      const driftX = Math.sin(t * 0.11 + state.driftPhaseX) * 0.12;
      const driftZ = Math.cos(t * 0.09 + state.driftPhaseZ) * 0.12;
      curX = state.x + driftX;
      curZ = state.z + driftZ;
      curY = state.restY + tideShift + bobY;
    }

    if (coreRef.current) coreRef.current.position.set(curX, curY, curZ);
    if (haloRef.current) haloRef.current.position.set(curX, curY, curZ);

    // 深度 → 透明度：curY ≈ -0.1（高潮浅处）~ -1.6（低潮深处）
    // depthFactor: 0=深沉, 1=近水面
    const depthFactor = Math.max(0, Math.min(1, (curY + 1.6) / 1.5));
    const baseAlpha = 0.3 + depthFactor * 0.6; // 0.3 ~ 0.9
    coreMat.opacity = Math.min(1, baseAlpha * 1.1);
    haloMat.opacity = baseAlpha * 0.20;
  });

  return (
    <>
      {/* 核心亮点 */}
      <mesh ref={coreRef} geometry={coreGeo} material={coreMat} />
      {/* 柔光晕圈 */}
      <mesh ref={haloRef} geometry={haloGeo} material={haloMat} />
    </>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function SunkenThoughts() {
  // zustand v5 selector 规则：不在选择器里 filter（getSnapshot 循环）。
  // useZoneEntries 在 useMemo 里 filter，符合规范。
  const thoughts = useZoneEntries("zone-bookshelf", "thought");

  // 最多渲染 MAX_MOTES 条（hook 已按 createdAt 倒序，最新在前）
  const visible = useMemo(() => thoughts.slice(0, MAX_MOTES), [thoughts]);

  // 共享几何（所有光点复用同一份，unmount 时统一 dispose）
  const coreGeo = useMemo(() => new THREE.SphereGeometry(CORE_R, 8, 6), []);
  const haloGeo = useMemo(() => new THREE.SphereGeometry(HALO_R, 8, 6), []);

  useEffect(() => {
    return () => {
      coreGeo.dispose();
      haloGeo.dispose();
    };
  }, [coreGeo, haloGeo]);

  // 运行时状态 Map：id → MoteState（存在 ref 里，不触发 re-render）
  const moteStatesRef = useRef<Map<string, MoteState>>(new Map());

  // 同步 visible 变化到 moteStatesRef：添加新条目、更新 entry 引用、清理已删除的。
  useEffect(() => {
    const map = moteStatesRef.current;
    const currentIds = new Set(visible.map((e) => e.id));

    // 清理已删除的条目
    for (const id of map.keys()) {
      if (!currentIds.has(id)) map.delete(id);
    }

    // 添加新条目 / 更新现有的 entry 引用
    for (const entry of visible) {
      if (!map.has(entry.id)) {
        const { x, z, restY } = stablePosition(entry.id);
        const [h1, h2, h3] = idHash(entry.id);
        map.set(entry.id, {
          entry,
          x,
          z,
          restY,
          bobPhase: h1 * Math.PI * 2,
          driftPhaseX: h2 * Math.PI * 2,
          driftPhaseZ: h3 * Math.PI * 2,
          sinkTriggered: false,
        });
      } else {
        // entry 引用可能在编辑后更新（createdAt 不变，状态保持）
        const s = map.get(entry.id)!;
        s.entry = entry;
      }
    }
  }, [visible]);

  return (
    <group name="sunken-thoughts">
      {visible.map((entry) => {
        // 渲染期惰性建状态：保证首帧（内容刚加载时）光点立即出现，不依赖 effect 先跑。
        let state = moteStatesRef.current.get(entry.id);
        if (!state) {
          const { x, z, restY } = stablePosition(entry.id);
          const [h1, h2, h3] = idHash(entry.id);
          state = { entry, x, z, restY, bobPhase: h1 * Math.PI * 2, driftPhaseX: h2 * Math.PI * 2, driftPhaseZ: h3 * Math.PI * 2, sinkTriggered: false };
          moteStatesRef.current.set(entry.id, state);
        } else {
          state.entry = entry;
        }
        return (
          <MoteInstance
            key={entry.id}
            state={state}
            coreGeo={coreGeo}
            haloGeo={haloGeo}
          />
        );
      })}
    </group>
  );
}
