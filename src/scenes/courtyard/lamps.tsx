import * as THREE from "three";
import { GlowSprite } from "../../scene/gallery/glow";
import { COURT_PALETTE, woodMat } from "./materials";

// 纸灯笼：全场唯一暖点。满分定义要「亮度低、光在雾里晕开」——
// 圆筒纸罩自发光（暖）+ 罩内小灯泡 + 柔光晕 Sprite（雾中晕开的来源）+ 短距点光（只洇一圈）。
// 全场环境光压到很低，灯与灯之间自然沉成灰绿冷调，暖只属于灯。

export interface LanternProps {
  position: [number, number, number];
  /** 点光强度（低，默认 3.4）。 */
  intensity?: number;
  /** 点光半径（洇开范围，默认 3.6）。 */
  distance?: number;
  /** 灯笼缩放。 */
  scale?: number;
  /** 暖度乘子（心境调制）。 */
  mul?: number;
  /** 是否挂绳（檐下悬挂）。 */
  hang?: boolean;
  castShadow?: boolean;
  low?: boolean;
}

/** 圆筒纸灯笼（悬挂式）。 */
export function PaperLantern({
  position,
  intensity = 3.4,
  distance = 3.6,
  scale = 1,
  mul = 1,
  hang = true,
  castShadow = false,
  low = false,
}: LanternProps) {
  const s = scale;
  const warm = new THREE.Color(COURT_PALETTE.lampWarm);
  return (
    <group position={position}>
      {/* 挂绳 + 顶盖（暗木） */}
      {hang && (
        <mesh position={[0, 0.42 * s, 0]} material={woodMat}>
          <cylinderGeometry args={[0.008, 0.008, 0.5 * s, 6]} />
        </mesh>
      )}
      <mesh position={[0, 0.2 * s, 0]} material={woodMat}>
        <cylinderGeometry args={[0.11 * s, 0.12 * s, 0.04 * s, 12]} />
      </mesh>
      {/* 圆筒纸罩：暖自发光（低），双面 */}
      <mesh scale={[s, s, s]} castShadow={castShadow}>
        <cylinderGeometry args={[0.15, 0.15, 0.34, 18, 1, true]} />
        <meshStandardMaterial
          color={COURT_PALETTE.paper}
          emissive={warm}
          emissiveIntensity={0.85}
          roughness={0.85}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* 上下木箍 */}
      {[0.17, -0.17].map((y, i) => (
        <mesh key={i} position={[0, y * s, 0]} rotation={[Math.PI / 2, 0, 0]} material={woodMat}>
          <torusGeometry args={[0.15 * s, 0.012 * s, 6, 18]} />
        </mesh>
      ))}
      {/* 底穗（暗木小坠） */}
      <mesh position={[0, -0.24 * s, 0]} material={woodMat}>
        <coneGeometry args={[0.03 * s, 0.1 * s, 8]} />
      </mesh>
      {/* 罩内小灯泡（暖） */}
      <mesh position={[0, 0, 0]} scale={[s, s, s]}>
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshStandardMaterial color={COURT_PALETTE.lampCore} emissive={warm} emissiveIntensity={1.4} roughness={0.5} toneMapped={false} />
      </mesh>
      {/* 柔光晕：雾里晕开 */}
      <GlowSprite position={[0, 0, 0]} color={COURT_PALETTE.lampWarm} scale={1.0 * s} opacity={0.3} />
      {/* 短距点光：只洇亮一圈 */}
      <pointLight
        position={[0, 0, 0]}
        color={COURT_PALETTE.lampWarm}
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
