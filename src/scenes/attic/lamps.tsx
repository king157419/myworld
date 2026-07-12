import * as THREE from "three";
import { GlowSprite } from "../../scene/gallery/glow";
import { SHADE_PROFILE, SMALL_BULB } from "../../scene/gallery/profiles";
import { ATTIC_PALETTE, brassMat } from "./materials";

// 阁楼的暖灯：满分定义要的是「洇开」——每盏只照亮自己周围一张桌面大小，墙角衰减到近黑。
// 做法：point 光 distance 收得很短（3~4m）+ decay 2；灯罩顶亮底暗、灯泡藏罩内；柔光晕 Sprite。
// 全屋没有均匀提亮的环境光（那在 Stage 里压到极低），所以这些光潭之间自然沉成暗。
//
// castShadow 只留给主灯（写字台），其余点光不投影（阴影预算 ≤2 盏）。

export interface WarmLampProps {
  position: [number, number, number];
  /** 点光强度（默认 5）。 */
  intensity?: number;
  /** 点光半径：一张桌面≈这么大（默认 3.4）。收得越短，洇开的光潭越小、墙角越黑。 */
  distance?: number;
  /** 是否投影（阴影预算内才开）。 */
  castShadow?: boolean;
  /** 灯罩缩放。 */
  scale?: number;
  /** 光潭强度乘子（心境调制）。 */
  mul?: number;
  low?: boolean;
}

/** 台灯 / 壁灯共用：钟形灯罩 + 罩内暖灯泡 + 柔光晕 + 短距点光。灯座另在各处自配。 */
export function WarmLamp({ position, intensity = 5, distance = 3.4, castShadow = false, scale = 1, mul = 1, low = false }: WarmLampProps) {
  const s = scale;
  return (
    <group position={position}>
      {/* 钟形灯罩（顶亮底暗靠自发光 + 罩内灯泡）；双面，夜里读作「这盏灯亮着」 */}
      <mesh scale={[s, s, s]} castShadow={castShadow}>
        <latheGeometry args={[SHADE_PROFILE, 24]} />
        <meshStandardMaterial
          color={ATTIC_PALETTE.paperWarm}
          emissive={new THREE.Color(ATTIC_PALETTE.lampWarm)}
          emissiveIntensity={1.05}
          roughness={0.72}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* 罩内灯泡（小、暖） */}
      <mesh position={[0, 0.12 * s, 0]} scale={[s, s, s]}>
        <latheGeometry args={[SMALL_BULB, 16]} />
        <meshStandardMaterial color={ATTIC_PALETTE.lampCore} emissive={new THREE.Color(ATTIC_PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
      </mesh>
      {/* 柔光晕：Sprite 渐变贴图（加色、不写深度） */}
      <GlowSprite position={[0, 0.1 * s, 0]} color={ATTIC_PALETTE.lampWarm} scale={0.95 * s} opacity={0.32} />
      {/* 短距点光：光潭只有一张桌面大 */}
      <pointLight
        position={[0, 0.05 * s, 0]}
        color={ATTIC_PALETTE.lampWarm}
        intensity={intensity * mul * (low ? 0.85 : 1)}
        distance={distance}
        decay={2}
        castShadow={castShadow}
        shadow-mapSize-width={low ? 512 : 1024}
        shadow-mapSize-height={low ? 512 : 1024}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </group>
  );
}

/** 壁灯：从墙面伸出的短铜臂 + 朝下的小暖灯（楼梯间 / 门厅用）。 */
export function Sconce({ position, ry = 0, mul = 1 }: { position: [number, number, number]; ry?: number; mul?: number }) {
  return (
    <group position={position} rotation={[0, ry, 0]}>
      {/* 铜臂：贴墙伸出 */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} material={brassMat} castShadow>
        <cylinderGeometry args={[0.016, 0.02, 0.24, 10]} />
      </mesh>
      {/* 小灯泡 + 光晕 */}
      <mesh position={[0, -0.02, 0.24]}>
        <sphereGeometry args={[0.05, 14, 10]} />
        <meshStandardMaterial color={ATTIC_PALETTE.lampCore} emissive={new THREE.Color(ATTIC_PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
      </mesh>
      <GlowSprite position={[0, -0.02, 0.24]} color={ATTIC_PALETTE.lampWarm} scale={0.7} opacity={0.3} />
      <pointLight position={[0, -0.02, 0.3]} color={ATTIC_PALETTE.lampWarm} intensity={3.4 * mul} distance={3.0} decay={2} />
    </group>
  );
}
