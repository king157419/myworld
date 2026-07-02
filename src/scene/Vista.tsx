import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRng } from "./rng";
import { PALETTE } from "../theme";
import { glowTexture } from "./gallery/glow";

// ─────────────────────────────────────────────────────────────────────────────
// Vista — 远景层。解决审计 W2：「世界没有远方，四望皆虚无，一眼看尽」。
//
// 三样东西，全是剪影与光点，不可到达：
//   1. 环形群岛剪影（InstancedMesh 锥体，1 次绘制）：世界从"孤台"变成"星海上的群岛夜"。
//      MeshBasic + 场景雾 → 大气透视免费（越远越溶进雾色），不受光、永远是剪影。
//   2. 一座会呼吸的灯塔：4.2s 一次的暖光脉冲——远方有"别人"在，世界在活着。
//   3. 漂流的放水灯：中景水面上缓缓漂的几点暖光——广场与群岛之间的空档有了内容。
// 全部立在 y≈0 的镜面水上 → MeshReflectorMaterial 把它们的倒影写进水里，纵深翻倍。
// 纯背景：不进 walk 碰撞、不进数据契约、不进 theme（它不是可交互几何真相）。
// ─────────────────────────────────────────────────────────────────────────────

const ISLAND_BASE = new THREE.Color("#101a30"); // 近岛偏蓝黑
const ISLAND_FAR = new THREE.Color("#1c2848"); // 远岛溶向地平线色

function Islands() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 26;
  const { mats, cols } = useMemo(() => {
    const rand = seededRng(4102);
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    // 12 座"岛"，每座 1~3 峰；避开正 +Z（入水甬道的来路留一线空阔——有一个方向是纯粹的远方）
    for (let isl = 0; isl < 12; isl++) {
      const a = ((isl + 0.5) / 12) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const gapToSouth = Math.abs(((a + Math.PI / 2) % (Math.PI * 2)) - Math.PI); // 0=正对+Z, π=正对-Z
      if (gapToSouth < 0.56) continue; // +Z ±32° 留空——有一个方向是纯粹的远方
      const r = 44 + rand() * 12;
      const peaks = 1 + Math.floor(rand() * 3);
      for (let p = 0; p < peaks; p++) {
        const px = Math.cos(a) * r + (rand() - 0.5) * 7;
        const pz = Math.sin(a) * r + (rand() - 0.5) * 7;
        const h = 2.2 + rand() * rand() * 7.5;
        const w = 2.6 + rand() * 6;
        q.setFromEuler(e.set(0, rand() * Math.PI * 2, 0));
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(px, h / 2 - 0.05, pz),
          q,
          new THREE.Vector3(w, h, w * (0.7 + rand() * 0.5)),
        );
        mats.push(m);
        // 大气透视的手动一层：越远越亮越蓝（在雾之外再推一档）
        const t = (r - 44) / 12;
        cols.push(ISLAND_BASE.clone().lerp(ISLAND_FAR, t * 0.8 + rand() * 0.2));
        if (mats.length >= COUNT) break;
      }
      if (mats.length >= COUNT) break;
    }
    return { mats, cols };
  }, []);

  const init = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    mats.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, cols[i]);
    });
    mesh.count = mats.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <instancedMesh ref={(m) => { ref.current = m; init(m); }} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      {/* 7 棱锥：低到看不出"程序生成"，又比圆锥多一点嶙峋 */}
      <coneGeometry args={[1, 1, 7]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const LIGHTHOUSE_POS: [number, number, number] = [-26, 0, -40];

function Lighthouse() {
  const glowRef = useRef<THREE.Sprite>(null);
  const lampMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: new THREE.Color(PALETTE.lampWarm),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useFrame((s) => {
    // 4.2s 一个周期的"呼吸"：快亮缓灭（灯塔的扫光节奏，pow 锐化上升沿）
    const t = (s.clock.elapsedTime % 4.2) / 4.2;
    const pulse = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 3);
    glowMat.opacity = 0.55 * pulse;
    if (lampMat.current) lampMat.current.color.setScalar(0.35 + pulse).multiply(new THREE.Color(PALETTE.lampWarm));
  });
  return (
    <group position={LIGHTHOUSE_POS}>
      {/* 塔身剪影（略收分）+ 灯室 */}
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.5, 0.85, 6.4, 8]} />
        <meshBasicMaterial color={"#0c1424"} toneMapped={false} />
      </mesh>
      <mesh position={[0, 6.6, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.5, 8]} />
        <meshBasicMaterial ref={lampMat} color={PALETTE.lampWarm} toneMapped={false} />
      </mesh>
      <mesh position={[0, 7.05, 0]}>
        <coneGeometry args={[0.55, 0.5, 8]} />
        <meshBasicMaterial color={"#0c1424"} toneMapped={false} />
      </mesh>
      <sprite ref={glowRef} position={[0, 6.6, 0]} scale={[4.5, 4.5, 1]} material={glowMat} />
      {/* 塔基小岛 */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[3.4, 2.6, 7]} />
        <meshBasicMaterial color={"#0d1526"} toneMapped={false} />
      </mesh>
    </group>
  );
}

function DriftLanterns() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 7;
  const { geom, mat, seeds } = useMemo(() => {
    const rand = seededRng(913);
    const pos = new Float32Array(COUNT * 3);
    const seeds: { r: number; a: number; w: number; bob: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      const r = 20 + rand() * 18;
      const a = rand() * Math.PI * 2;
      seeds.push({ r, a, w: (0.003 + rand() * 0.004) * (rand() < 0.5 ? 1 : -1), bob: rand() * Math.PI * 2 });
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.12;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      map: glowTexture(),
      size: 0.9,
      color: new THREE.Color("#ffb257"),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    return { geom: g, mat: m, seeds };
  }, []);

  useFrame((s) => {
    const p = geom.getAttribute("position") as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const sd = seeds[i];
      const a = sd.a + t * sd.w;
      arr[i * 3] = Math.cos(a) * sd.r;
      arr[i * 3 + 1] = 0.12 + Math.sin(t * 0.4 + sd.bob) * 0.04;
      arr[i * 3 + 2] = Math.sin(a) * sd.r;
    }
    p.needsUpdate = true;
  });

  return <points ref={ref} geometry={geom} material={mat} frustumCulled={false} />;
}

export default function Vista() {
  return (
    <group name="vista">
      <Islands />
      <Lighthouse />
      <DriftLanterns />
    </group>
  );
}
