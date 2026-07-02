import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { DECK_Y, GRAMOPHONE, PALETTE } from "../../theme";
import { CUP_PROFILE, POST_PROFILE, BULB_PROFILE, V2 } from "./profiles";
import { brassMat, paperMat, woodWarmMat } from "./materials";
import { GlowSprite } from "./glow";

// 观星台上、留声机旁的"听歌角"：毯子 + 靠垫 + 一盏暖台灯 —— 给登顶一个停留的理由。
// 整组以 GRAMOPHONE 锚点定位（挪留声机时听歌角跟着走），组内坐标全是相对偏移。

export default function ListeningNook() {
  return (
    <group position={[GRAMOPHONE[0], DECK_Y, GRAMOPHONE[2]]}>
      {/* 双层地毯：深红地 + 更深的边 */}
      <mesh position={[0.7, 0.014, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial color={"#3a1a1a"} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.7, 0.02, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.7, 1.2]} />
        <meshStandardMaterial color={"#6e2f2c"} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* 两个圆软坐垫（压扁的球 + 一圈滚边，读成"织物"而不是橡皮） */}
      {[
        { p: [1.25, 0.13, 0.05] as const, r: 0.33, c: "#7c4a38" },
        { p: [0.45, 0.12, 0.75] as const, r: 0.29, c: "#6a5a42" },
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
      <RoundedBox args={[0.5, 0.06, 0.36]} radius={0.025} smoothness={2} position={[1.25, 0.26, 0.05]} rotation={[0, 0.5, 0.04]} castShadow>
        <meshStandardMaterial color={"#9a6038"} roughness={0.95} />
      </RoundedBox>
      {/* 摊开的书 */}
      <group position={[0.5, 0.05, 0.15]} rotation={[0, 0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, -0.16]} position={[-0.12, 0, 0]} material={paperMat}>
          <planeGeometry args={[0.26, 0.32]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0.16]} position={[0.12, 0, 0]} material={paperMat}>
          <planeGeometry args={[0.26, 0.32]} />
        </mesh>
        <mesh position={[0, 0.01, 0]} material={woodWarmMat}>
          <boxGeometry args={[0.04, 0.03, 0.32]} />
        </mesh>
      </group>
      {/* 车削茶杯 + 把手 */}
      <group position={[0.0, 0.02, -0.1]}>
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
      <group position={[-1.4, 0, 0.0]}>
        <mesh castShadow material={brassMat}>
          <latheGeometry args={[POST_PROFILE.map((p) => V2(p.x * 0.9, p.y * 0.56)), 16]} />
        </mesh>
        <mesh position={[0, 1.08, 0]}>
          <latheGeometry args={[BULB_PROFILE, 18]} />
          <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={1.25} roughness={0.5} toneMapped={false} />
        </mesh>
        <GlowSprite position={[0, 1.1, 0]} color={PALETTE.lampWarm} scale={0.95} opacity={0.32} />
        <pointLight position={[0, 1.1, 0]} color={PALETTE.lampWarm} intensity={3.6} distance={6} decay={2} />
      </group>
    </group>
  );
}
