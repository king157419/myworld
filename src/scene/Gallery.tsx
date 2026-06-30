import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Edges } from "@react-three/drei";
import { RoundedBoxGeometry } from "three-stdlib";
import * as THREE from "three";
import GramophoneModel from "./GramophoneModel";
import {
  BOOKWALL,
  DECK,
  DECK_Y,
  LECTERN,
  PALETTE,
  PEDESTALS,
  R_COURT,
  STEPS,
  STEP_RISE,
  STEP_RUN,
  tideOffset,
} from "../theme";

// 舞台（authored）：潮汐图书馆的建筑外壳。本轮把"基本几何体堆叠"升级为有倒角、有车削轮廓、真金属的建模：
//   · 凡是盒子 → RoundedBox（倒角的高光棱线是"真实物件 vs CG 原型"的第一道分水岭）。
//   · 留声机喇叭 / 灯杆 / 灯泡 / 茶杯 → LatheGeometry 车削轮廓（曲面回转剪影＝"被建模过"，不是"原型拼出来的"）。
//   · 黄铜 metalness=1 roughness≈0.26，真正反射 Environment；书脊倒角 + 做旧配色；书架框描一道暖金边。
// 全部是几何/材质改动，不碰 theme 常量 → walk.ts 的碰撞足迹不变。用户内容仍由 zones/* 数据驱动叠加。

const BOOK_COLORS = ["#7d3b2e", "#3f5a46", "#6b5630", "#34465f", "#5a3550", "#7a6a45", "#2f3e3a"];

const V2 = (r: number, y: number) => new THREE.Vector2(r, y);

// ── 车削轮廓（绕 Y 回转） ───────────────────────────────────────────────────
// 灯杆：细的车削木/铜杆，带一两处节。
const POST_PROFILE = [
  V2(0.085, 0), V2(0.05, 0.05), V2(0.044, 0.22), V2(0.058, 0.34),
  V2(0.04, 0.5), V2(0.044, 1.55), V2(0.052, 1.78), V2(0.038, 1.9),
];
// 灯泡：泪滴状（圆底、微收顶），比完美球体远没那么"AI 默认"。
const BULB_PROFILE = [
  V2(0.0, 0), V2(0.07, 0.03), V2(0.115, 0.1), V2(0.12, 0.18),
  V2(0.095, 0.27), V2(0.05, 0.33), V2(0.0, 0.35),
];
// 小台灯灯泡（更小）。
const SMALL_BULB = BULB_PROFILE.map((p) => V2(p.x * 0.82, p.y * 0.82));
// 茶杯：杯壁 + 卷口。
const CUP_PROFILE = [
  V2(0.0, 0), V2(0.04, 0), V2(0.048, 0.015), V2(0.052, 0.08), V2(0.058, 0.1), V2(0.05, 0.092),
];
// 钟形灯罩（车削）：底口宽、向上收窄。罩住灯泡——把"裸灯泡+大圆盘光晕"的棒棒糖换成有体量的灯。
const SHADE_PROFILE = [
  V2(0.205, 0), V2(0.2, 0.03), V2(0.165, 0.1), V2(0.11, 0.19), V2(0.06, 0.265), V2(0.045, 0.285),
];

function Lantern({ position, light = false }: { position: THREE.Vector3; light?: boolean }) {
  return (
    <group position={position}>
      {/* 车削灯杆 */}
      <mesh position={[0, 0, 0]} castShadow>
        <latheGeometry args={[POST_PROFILE, 18]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.36} metalness={0.9} />
      </mesh>
      {/* 顶部铜枝（灯罩由此悬下）*/}
      <mesh position={[0, 2.18, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.03, 0.18, 12]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.95} />
      </mesh>
      {/* 灯泡（小、暖，藏在罩内）*/}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.062, 16, 12]} />
        <meshStandardMaterial
          color={PALETTE.lampCore}
          emissive={new THREE.Color(PALETTE.lampWarm)}
          emissiveIntensity={2.4}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      {/* 钟形灯罩：底口朝下、罩住灯泡；双面——外壳收冷月光，内壁被灯泡照得发暖（一盏"有体量的灯"）*/}
      <mesh position={[0, 1.9, 0]} castShadow>
        <latheGeometry args={[SHADE_PROFILE, 28]} />
        <meshStandardMaterial
          color={PALETTE.paperWarm}
          emissive={new THREE.Color(PALETTE.lampWarm)}
          emissiveIntensity={0.45}
          roughness={0.72}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 收紧的柔光晕（贴着罩口一小团，不再是大圆盘）*/}
      <mesh position={[0, 1.92, 0]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshBasicMaterial color={PALETTE.lampWarm} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {light && <pointLight position={[0, 1.92, 0]} color={PALETTE.lampWarm} intensity={6} distance={9} decay={2} />}
    </group>
  );
}

function Lanterns() {
  const lanterns = useMemo(() => {
    const out: { p: THREE.Vector3; light: boolean }[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      // 后方观星台扇区不放灯笼（那里有台灯）
      if (a > Math.PI * 1.18 && a < Math.PI * 1.82) continue;
      const p = new THREE.Vector3(Math.cos(a) * (R_COURT + 0.4), 0, Math.sin(a) * (R_COURT + 0.4));
      out.push({ p, light: i % 2 === 0 });
    }
    return out;
  }, []);
  return (
    <group>
      {lanterns.map((l, i) => (
        <Lantern key={i} position={l.p} light={l.light} />
      ))}
    </group>
  );
}

function BookWallStructure() {
  // -X 一段圆弧上的高书架骨架 + 大量装饰书脊（实例化，倒角）。用户思考由 zones/Bookshelf 叠加。
  const spineGeom = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.085), []);
  const { uprights, shelves, instances } = useMemo(() => {
    const up: { p: THREE.Vector3; ry: number }[] = [];
    const sh: { p: THREE.Vector3; ry: number; w: number }[] = [];
    const inst: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const segs = 7;
    for (let s = 0; s <= segs; s++) {
      const a = BOOKWALL.a0 + (BOOKWALL.a1 - BOOKWALL.a0) * (s / segs);
      const x = Math.cos(a) * BOOKWALL.radius;
      const z = Math.sin(a) * BOOKWALL.radius;
      const ry = a + Math.PI / 2; // 面朝圆心
      up.push({ p: new THREE.Vector3(x, BOOKWALL.height / 2, z), ry });
    }
    for (let s = 0; s < segs; s++) {
      const a = BOOKWALL.a0 + (BOOKWALL.a1 - BOOKWALL.a0) * ((s + 0.5) / segs);
      const x = Math.cos(a) * BOOKWALL.radius;
      const z = Math.sin(a) * BOOKWALL.radius;
      const ry = a + Math.PI / 2;
      const segW = (BOOKWALL.radius * (BOOKWALL.a1 - BOOKWALL.a0)) / segs;
      for (let lvl = 0; lvl < BOOKWALL.shelves; lvl++) {
        const y = 0.5 + lvl * (BOOKWALL.height / BOOKWALL.shelves);
        sh.push({ p: new THREE.Vector3(x, y, z), ry, w: segW * 0.94 });
        // 这一格里排一串书：宽窄/高矮/进深各异，偶有歪斜、偶有被抽出半截，颜色做旧——绝不雷同。
        const inward = new THREE.Vector3(-x, 0, -z).normalize(); // 朝圆心（书架正面）方向
        const count = 11;
        let cursor = -segW * 0.46;
        const aged = new THREE.Color("#2e2620");
        for (let b = 0; b < count && cursor < segW * 0.46; b++) {
          const w = 0.07 + Math.random() * 0.06;
          cursor += w * 0.62;
          const along = cursor;
          const h = 0.28 + Math.random() * 0.24;
          const depth = 0.17 + Math.random() * 0.08;
          const pulled = Math.random() < 0.14 ? 0.05 + Math.random() * 0.05 : 0; // 偶尔抽出半截
          const tilt = Math.random() < 0.12 ? (Math.random() - 0.5) * 0.34 : 0; // 偶尔歪斜
          const bx = x + Math.cos(ry) * along + inward.x * pulled;
          const bz = z + Math.sin(ry) * along + inward.z * pulled;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, tilt));
          m.compose(new THREE.Vector3(bx, y + h / 2 + 0.04, bz), q, new THREE.Vector3(w, h, depth));
          const c = new THREE.Color(BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]).lerp(aged, 0.22 + Math.random() * 0.18);
          inst.push({ m, c });
          cursor += w * 0.62;
        }
      }
    }
    return { uprights: up, shelves: sh, instances: inst };
  }, []);

  const meshRef = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const col = new THREE.Color();
    instances.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, col.copy(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <group>
      {uprights.map((u, i) => (
        <RoundedBox key={`u${i}`} args={[0.1, BOOKWALL.height, 0.46]} radius={0.018} smoothness={3} position={u.p} rotation={[0, u.ry, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.68} metalness={0.05} />
          {/* 框上一道极淡的暖金边：像灯光擦过木头的棱线，瞬间高级 */}
          <Edges threshold={18} scale={1.0}>
            <lineBasicMaterial color={PALETTE.brass} transparent opacity={0.16} toneMapped={false} />
          </Edges>
        </RoundedBox>
      ))}
      {shelves.map((s, i) => (
        <RoundedBox key={`s${i}`} args={[s.w, 0.05, 0.56]} radius={0.012} smoothness={2} position={s.p} rotation={[0, s.ry, 0]}>
          <meshStandardMaterial color={PALETTE.wood} roughness={0.8} />
        </RoundedBox>
      ))}
      <instancedMesh ref={meshRef} args={[spineGeom, undefined, instances.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.82} metalness={0.0} />
      </instancedMesh>
      {/* 书墙暖补光（无影、克制）：给整面墙横向的可读层次，别让它糊成一块暗板 */}
      <pointLight position={[-5.2, 2.2, -0.5]} color={PALETTE.lampWarm} intensity={2.2} distance={7} decay={2} />
    </group>
  );
}

function Deck() {
  // 观星台：从水面升起的石台 + 木梯 + 栏杆 + 望远镜。
  const treads = useMemo(() => {
    const out: { y: number; z: number; h: number }[] = [];
    for (let i = 0; i < STEPS.count; i++) {
      const h = (i + 1) * STEP_RISE;
      const z = STEPS.zBottom - i * STEP_RUN - STEP_RUN / 2;
      out.push({ y: h, z, h });
    }
    return out;
  }, []);
  const cx = (DECK.x0 + DECK.x1) / 2;
  const cz = (DECK.zFar + DECK.zNear) / 2;
  const wx = DECK.x1 - DECK.x0;
  const wz = DECK.zNear - DECK.zFar;
  return (
    <group>
      {/* 台体 */}
      <RoundedBox args={[wx, DECK_Y, wz]} radius={0.04} smoothness={3} position={[cx, DECK_Y / 2, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.stoneLit} roughness={0.82} metalness={0.06} />
      </RoundedBox>
      {/* 木梯 */}
      {treads.map((t, i) => (
        <RoundedBox key={i} args={[STEPS.x1 - STEPS.x0, t.h, STEP_RUN * 1.02]} radius={0.02} smoothness={2} position={[0, t.h / 2, t.z]} castShadow receiveShadow>
          <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.7} />
        </RoundedBox>
      ))}
      {/* 两侧栏杆（真黄铜，车削立柱） */}
      {[DECK.x0 + 0.1, DECK.x1 - 0.1].map((rx, i) => (
        <group key={i}>
          <mesh position={[rx, DECK_Y + 0.5, cz]}>
            <boxGeometry args={[0.06, 0.06, wz - 0.2]} />
            <meshStandardMaterial color={PALETTE.brass} roughness={0.28} metalness={1} />
          </mesh>
          {[cz - wz / 2 + 0.3, cz, cz + wz / 2 - 0.3].map((pz, j) => (
            <mesh key={j} position={[rx, DECK_Y + 0.26, pz]} castShadow>
              <cylinderGeometry args={[0.026, 0.026, 0.52, 12]} />
              <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={1} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 望远镜（朝天） */}
      <group position={[DECK.x1 - 1.0, DECK_Y, DECK.zFar + 0.9]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.055, 0.07, 1.0, 20]} />
          <meshStandardMaterial color={PALETTE.brass} roughness={0.28} metalness={1} />
        </mesh>
        <mesh position={[0, 0.9, 0.18]} rotation={[0.9, 0, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.1, 0.9, 20]} />
          <meshStandardMaterial color={"#1c2430"} roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
          <meshStandardMaterial color={PALETTE.wood} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

function Lectern() {
  // 写作台：立在 -X 书墙前的水上，一盏暖台灯。写下的思考会"沉入水中"。
  return (
    <group position={LECTERN}>
      {/* 车削木腿 */}
      <mesh position={[0, 0, 0]} castShadow>
        <latheGeometry args={[POST_PROFILE.map((p) => V2(p.x * 1.25, p.y * 0.55)), 16]} />
        <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.68} />
      </mesh>
      {/* 倾斜台面 */}
      <RoundedBox args={[0.7, 0.5, 0.05]} radius={0.014} smoothness={2} position={[0, 1.02, 0]} rotation={[-0.5, 0, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.wood} roughness={0.58} />
      </RoundedBox>
      {/* 摊开的纸 */}
      <mesh position={[0, 1.05, 0.02]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.5, 0.36]} />
        <meshStandardMaterial color={PALETTE.paperWarm} emissive={new THREE.Color(PALETTE.paperWarm)} emissiveIntensity={0.22} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* 台灯：车削灯泡 + 铜颈 */}
      <mesh position={[0.42, 1.08, -0.1]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 0.22, 12]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={1} />
      </mesh>
      <mesh position={[0.42, 1.2, -0.1]}>
        <latheGeometry args={[SMALL_BULB, 18]} />
        <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
      </mesh>
      <pointLight position={[0.42, 1.2, -0.1]} color={PALETTE.lampWarm} intensity={5} distance={7} decay={2} />
    </group>
  );
}

function PedestalBases() {
  // 立在水上的发光陈列岛：水面小基座 + 细黄铜柱 + 顶台。物件由 zones/ObjectMuseum 叠在顶台上。
  return (
    <group>
      {PEDESTALS.map((p, i) => (
        <group key={i} position={[p.pos[0], 0, p.pos[2]]}>
          <RoundedBox args={[p.r * 1.7, 0.12, p.r * 1.7]} radius={0.05} smoothness={3} position={[0, 0.06, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={PALETTE.stoneLit} roughness={0.72} metalness={0.1} />
          </RoundedBox>
          {/* 车削黄铜柱 */}
          <mesh position={[0, p.h / 2 + 0.1, 0]} castShadow>
            <latheGeometry args={[[V2(0.085, 0), V2(0.06, 0.12), V2(0.055, p.h * 0.55), V2(0.07, p.h * 0.9), V2(0.085, p.h)], 24]} />
            <meshStandardMaterial color={PALETTE.brass} roughness={0.28} metalness={1} />
          </mesh>
          {/* 顶台（倒角圆盘） */}
          <mesh position={[0, p.h + 0.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[p.r * 0.62, p.r * 0.6, 0.08, 28]} />
            <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.58} metalness={0.1} />
          </mesh>
          {/* 顶台铜沿 */}
          <mesh position={[0, p.h + 0.16, 0]}>
            <torusGeometry args={[p.r * 0.62, 0.012, 10, 32]} />
            <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={1} />
          </mesh>
          {/* 顶台暖光圈 */}
          <mesh position={[0, p.h + 0.175, 0]}>
            <torusGeometry args={[p.r * 0.5, 0.012, 8, 28]} />
            <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
          <pointLight position={[0, p.h + 0.45, 0]} color={PALETTE.lampWarm} intensity={1.5} distance={2.8} decay={2} />
        </group>
      ))}
    </group>
  );
}

function FloatingBooks() {
  // 漂在镜面水上的旧书，随潮轻轻起伏、缓缓自转。是"记忆当作水来盛放"的具象。
  const ref = useRef<THREE.Group>(null);
  const coverGeom = useMemo(() => new RoundedBoxGeometry(0.36, 0.075, 0.27, 2, 0.018), []);
  const books = useMemo(() => {
    const out: { x: number; z: number; ry: number; phase: number; color: string }[] = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.7;
      const r = 2.7 + (i % 4) * 1.25;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r - 0.5,
        ry: (i * 1.7) % (Math.PI * 2),
        phase: (i * 2.3) % (Math.PI * 2),
        color: BOOK_COLORS[i % BOOK_COLORS.length],
      });
    }
    return out;
  }, []);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    const tide = tideOffset(t);
    g.children.forEach((c, i) => {
      const b = books[i];
      c.position.y = 0.05 + Math.sin(t * 0.5 + b.phase) * 0.025 + tide * 0.6;
      c.rotation.y = b.ry + Math.sin(t * 0.12 + b.phase) * 0.12;
    });
  });
  return (
    <group ref={ref}>
      {books.map((b, i) => (
        <group key={i} position={[b.x, 0.05, b.z]} rotation={[0, b.ry, 0]}>
          <mesh geometry={coverGeom} castShadow>
            <meshStandardMaterial color={b.color} roughness={0.66} metalness={0.04} />
          </mesh>
          {/* 书口（纸页）：露出一圈奶白 */}
          <mesh position={[0, 0.004, 0]}>
            <boxGeometry args={[0.315, 0.062, 0.235]} />
            <meshStandardMaterial color={PALETTE.paperWarm} emissive={new THREE.Color(PALETTE.paperWarm)} emissiveIntensity={0.05} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ListeningNook() {
  // 观星台上、留声机旁的"听歌角"：毯子 + 靠垫 + 一盏暖台灯 —— 给登顶一个停留的理由。
  return (
    <group>
      {/* 双层地毯：深红地 + 更深的边 */}
      <mesh position={[0.7, DECK_Y + 0.014, -9.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial color={"#3a1a1a"} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.7, DECK_Y + 0.02, -9.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.7, 1.2]} />
        <meshStandardMaterial color={"#6e2f2c"} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* 两个圆软坐垫（压扁的球 + 一圈滚边，读成"织物"而不是橡皮） */}
      {[
        { p: [1.25, DECK_Y + 0.13, -9.35] as const, r: 0.33, c: "#7c4a38" },
        { p: [0.45, DECK_Y + 0.12, -8.65] as const, r: 0.29, c: "#6a5a42" },
      ].map((cu, i) => (
        <group key={i} position={[cu.p[0], cu.p[1], cu.p[2]]}>
          <mesh scale={[1, 0.46, 1]} castShadow>
            <sphereGeometry args={[cu.r, 22, 16]} />
            <meshStandardMaterial color={cu.c} roughness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[cu.r * 0.96, 0.022, 10, 28]} />
            <meshStandardMaterial color={new THREE.Color(cu.c).multiplyScalar(0.7)} roughness={0.98} />
          </mesh>
        </group>
      ))}
      {/* 搭在坐垫上的折叠薄毯 */}
      <RoundedBox args={[0.5, 0.06, 0.36]} radius={0.025} smoothness={2} position={[1.25, DECK_Y + 0.26, -9.35]} rotation={[0, 0.5, 0.04]} castShadow>
        <meshStandardMaterial color={"#9a6038"} roughness={0.95} />
      </RoundedBox>
      {/* 摊开的书 */}
      <group position={[0.5, DECK_Y + 0.05, -9.25]} rotation={[0, 0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, -0.16]} position={[-0.12, 0, 0]}>
          <planeGeometry args={[0.26, 0.32]} />
          <meshStandardMaterial color={PALETTE.paperWarm} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0.16]} position={[0.12, 0, 0]}>
          <planeGeometry args={[0.26, 0.32]} />
          <meshStandardMaterial color={PALETTE.paperWarm} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.04, 0.03, 0.32]} />
          <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.8} />
        </mesh>
      </group>
      {/* 车削茶杯 + 把手 */}
      <group position={[0.0, DECK_Y + 0.02, -9.5]}>
        <mesh castShadow>
          <latheGeometry args={[CUP_PROFILE, 20]} />
          <meshStandardMaterial color={"#d8c8a8"} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0.06, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.028, 0.008, 8, 16, Math.PI]} />
          <meshStandardMaterial color={"#d8c8a8"} roughness={0.55} />
        </mesh>
      </group>
      {/* 暖台灯：车削杆 + 泪滴灯泡 */}
      <group position={[-1.4, DECK_Y, -9.4]}>
        <mesh castShadow>
          <latheGeometry args={[POST_PROFILE.map((p) => V2(p.x * 0.9, p.y * 0.56)), 16]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.08, 0]}>
          <latheGeometry args={[BULB_PROFILE, 18]} />
          <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshBasicMaterial color={PALETTE.lampWarm} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 1.1, 0]} color={PALETTE.lampWarm} intensity={3.6} distance={6} decay={2} />
      </group>
    </group>
  );
}

export default function Gallery() {
  return (
    <group>
      <Lanterns />
      <BookWallStructure />
      <Deck />
      <Lectern />
      <PedestalBases />
      <FloatingBooks />
      <GramophoneModel />
      <ListeningNook />
    </group>
  );
}
