import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Zone, ZoneType } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { audioEngine } from "../../audio/engine";
import { ATTIC, EAVE_H, HALF_W, RIDGE_H, Y_ATTIC } from "./data";
import Shell from "./Shell";
import Stairs from "./Stairs";
import AtticBookshelf from "./Bookshelf";
import AtticObjectShelf from "./ObjectShelf";
import AtticRecordCorner from "./RecordCorner";
import { GableWindow, Skylight } from "./Glass";
import { makeRainGlassMaterial } from "./rainGlass";
import { useAtticRain } from "./useAtticRain";
import { StairCreak, useAtticLibrary, useVinylCrackle } from "./atticAudio";
import { ATTIC_PALETTE } from "./materials";

// 雨夜阁楼 · v1 成品舞台。
// 满分锚点：暖光洇开（灯潭小、墙角近黑）× 屋里暖 / 窗外冷双色平衡 × 书墙不规则节奏 ×
//   窗上可辨认雨痕水珠 × 楼梯连续坡 × 低檐区不可走。
// 光照预算：唯一投影主灯 = 写字台台灯（Bookshelf 里 castShadow）；其余点光一律不投影。
// 全局环境光压到极低 → 灯潭之间自然沉暗（绝不全屋均匀提亮）。

const ridgeY = Y_ATTIC + RIDGE_H;

// 心境映射（阁楼室内自定；四档必须可感知且不崩）。均以「暖灯为锚（恒定），窗外冷 + 雨势 + 环境」摆动。
interface MoodCfg {
  bg: string;
  ambClr: string;
  ambInt: number;
  hemi: number;
  cold: number; // 窗外冷光乘子
  rain: number; // 雨势（水珠/雨丝密度）
  fog: number;
  rainVol: number; // 雨声床音量
}
const ATTIC_MOOD: Record<string, MoodCfg> = {
  rainy: { bg: "#080b14", ambClr: "#2a3452", ambInt: 0.11, hemi: 0.16, cold: 1.15, rain: 1.0, fog: 0.02, rainVol: 0.5 },
  warm: { bg: "#0d0a08", ambClr: "#3a2c22", ambInt: 0.13, hemi: 0.12, cold: 0.55, rain: 0.45, fog: 0.008, rainVol: 0.28 },
  cool: { bg: "#080c15", ambClr: "#28324e", ambInt: 0.11, hemi: 0.16, cold: 1.0, rain: 0.7, fog: 0.012, rainVol: 0.38 },
  neutral: { bg: "#0a0b10", ambClr: "#31313f", ambInt: 0.12, hemi: 0.13, cold: 0.8, rain: 0.4, fog: 0.008, rainVol: 0.32 },
};

const ZONE_BODY: Record<ZoneType, (p: { zone: Zone; low?: boolean }) => React.JSX.Element> = {
  bookshelf: AtticBookshelf,
  objects: AtticObjectShelf,
  record: AtticRecordCorner,
};

/** 灯边微尘：极轻的暖色悬浮尘（单 Points，一处 useFrame）。 */
function DustMotes() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 70;
  const { geom, mat } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4.0;
      pos[i * 3 + 1] = Y_ATTIC + 0.2 + Math.random() * 2.2;
      pos[i * 3 + 2] = -3.0 - Math.random() * 7.5;
      spd[i] = 0.02 + Math.random() * 0.05;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpd", new THREE.BufferAttribute(spd, 1));
    const m = new THREE.PointsMaterial({ size: 0.02, color: new THREE.Color("#ffdca8"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
    return { geom: g, mat: m };
  }, []);
  useFrame((s, dt) => {
    const p = geom.getAttribute("position") as THREE.BufferAttribute;
    const spd = geom.getAttribute("aSpd") as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      let y = arr[i * 3 + 1] + spd.getX(i) * dt;
      arr[i * 3] += Math.sin(s.clock.elapsedTime * 0.2 + i) * dt * 0.03;
      if (y > Y_ATTIC + 2.6) y = Y_ATTIC + 0.2;
      arr[i * 3 + 1] = y;
    }
    p.needsUpdate = true;
  });
  return <points ref={ref} geometry={geom} material={mat} frustumCulled={false} />;
}

/** 雨夜偶发远雷（合成，复用 engine.thunder；仅 rainy）。 */
function DistantThunder() {
  useEffect(() => {
    let alive = true;
    let id: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      id = setTimeout(() => {
        if (!alive) return;
        audioEngine.thunder(0.25 + Math.random() * 0.35);
        schedule(20000 + Math.random() * 26000);
      }, delay);
    };
    schedule(12000 + Math.random() * 12000);
    return () => { alive = false; clearTimeout(id); };
  }, []);
  return null;
}

// 屋顶斜面法向（内表面朝室内），用于给天窗定向。
function slopeEuler(sign: number): [number, number, number] {
  const interiorN = new THREE.Vector3(-sign * (RIDGE_H - EAVE_H), -(HALF_W), 0).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), interiorN);
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

export default function AtticStage({ low }: { low: boolean }) {
  const zones = useWorld((s) => s.world.zones);
  const mood = useWorld((s) => s.world.room.mood.lighting);
  const cfg = ATTIC_MOOD[mood] ?? ATTIC_MOOD.rainy;

  // 玻璃雨蚀 / 雨丝共享 uniform（Stage 每帧推进 uTime，按心境写 uRain）。
  const timeUniform = useMemo(() => ({ value: 0 }), []);
  const rainUniform = useMemo(() => ({ value: 1 }), []);
  const glassMat = useMemo(() => makeRainGlassMaterial(rainUniform, timeUniform), [rainUniform, timeUniform]);
  useEffect(() => {
    rainUniform.value = cfg.rain;
  }, [cfg.rain, rainUniform]);
  useFrame((s) => {
    timeUniform.value = s.clock.elapsedTime;
  });

  // 室内雨声床（随 useAudio.started 起停 + 压掉 loft 水床；音量随心境）。
  useAtticRain(cfg.rainVol);
  // 唱机曲库切爵士（离场恢复 loft）+ musicPlaying 时叠黑胶底噪。
  useAtticLibrary();
  useVinylCrackle();

  // 天窗定向（两坡各一，错开 Z）。
  const ePlus = useMemo(() => slopeEuler(+1), []);
  const eMinus = useMemo(() => slopeEuler(-1), []);
  const nPlus = useMemo(() => new THREE.Vector3(-(RIDGE_H - EAVE_H), -HALF_W, 0).normalize(), []);
  const nMinus = useMemo(() => new THREE.Vector3(RIDGE_H - EAVE_H, -HALF_W, 0).normalize(), []);
  const skyPlusPos = useMemo(() => new THREE.Vector3(1.5, ridgeY - (1.5 / HALF_W) * (RIDGE_H - EAVE_H), -6.4).addScaledVector(nPlus, 0.06), [nPlus]);
  const skyMinusPos = useMemo(() => new THREE.Vector3(-1.5, ridgeY - (1.5 / HALF_W) * (RIDGE_H - EAVE_H), -8.6).addScaledVector(nMinus, 0.06), [nMinus]);

  return (
    <>
      <color attach="background" args={[cfg.bg]} />
      {/* 极轻室内雾（雨夜的空气感；只吃标准材质，天窗/玻璃 shader 不受） */}
      <fogExp2 attach="fog" args={[cfg.bg, cfg.fog]} />

      {/* 全局环境：压到极低——灯潭之间必须沉暗（洇开的前提） */}
      <ambientLight intensity={cfg.ambInt} color={cfg.ambClr} />
      {/* 地色略暖（不再纯黑）：向下的面（梁下缘/檐下）接住一点暖余晖，避免塌成黑贴片 */}
      <hemisphereLight args={["#2a3448", "#15100a", cfg.hemi]} />

      {/* 建筑外壳 + 楼梯 */}
      <Shell />
      <Stairs />

      {/* 山墙窗（写字台前，雨蚀玻璃 + 冷夜 + 暖 bokeh）；尺寸/位置收在山墙三角内不越屋脊线 */}
      <GableWindow material={glassMat} rainUniform={rainUniform} timeUniform={timeUniform} position={[1.25, Y_ATTIC + 1.15, ATTIC.room.z0 + 0.12]} size={[1.3, 1.4]} coldMul={cfg.cold} />
      {/* 双坡各一扇天窗（雨在玻璃上 + 冷光下泄） */}
      <Skylight material={glassMat} rainUniform={rainUniform} timeUniform={timeUniform} position={[skyPlusPos.x, skyPlusPos.y, skyPlusPos.z]} rotation={ePlus} size={[1.2, 1.2]} coldMul={cfg.cold} low={low} />
      <Skylight material={glassMat} rainUniform={rainUniform} timeUniform={timeUniform} position={[skyMinusPos.x, skyMinusPos.y, skyMinusPos.z]} rotation={eMinus} size={[1.2, 1.2]} coldMul={cfg.cold} low={low} />

      {/* 三个数据驱动 zone（按 type 分发；内容过滤/聚焦/登记全用 zone.id） */}
      {zones.map((zone) => {
        const Body = ZONE_BODY[zone.type];
        return Body ? <Body key={zone.id} zone={zone} low={low} /> : null;
      })}

      {/* 门厅边桌 + 一盏小暖灯（刻意昏暗，把人往楼上暖光牵） */}
      <group position={[-1.9, 0, 3.6]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 0.4]} />
          <meshStandardMaterial color={ATTIC_PALETTE.woodWarm} roughness={0.7} />
        </mesh>
        {[[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].map((p, i) => (
          <mesh key={i} position={[p[0], 0.25, p[1]]}>
            <boxGeometry args={[0.04, 0.5, 0.04]} />
            <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
          </mesh>
        ))}
        {/* 小暖灯：门厅主暖光，灯潭稍扩，把门厅从纯黑里托出（评审 F5，仍昏暗） */}
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.05, 14, 10]} />
          <meshStandardMaterial color={ATTIC_PALETTE.lampCore} emissive={new THREE.Color(ATTIC_PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.62, 0]} color={ATTIC_PALETTE.lampWarm} intensity={5.6} distance={3.9} decay={2} />
      </group>

      {/* 第七级楼梯吱呀（印记 attic-t5 彩蛋） */}
      <StairCreak />
      {/* 灯边微尘 */}
      {!low && <DustMotes />}
      {/* 雨夜远雷 */}
      {mood === "rainy" && <DistantThunder />}
    </>
  );
}
