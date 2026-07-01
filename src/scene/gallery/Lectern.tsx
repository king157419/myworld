import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { LECTERN, PALETTE } from "../../theme";
import { POST_PROFILE, SMALL_BULB, V2 } from "./profiles";
import { brassMat, woodWarmMat } from "./materials";

// 写作台：立在 -X 书墙前的水上，一盏暖台灯。写下的思考会"沉入水中"。

export default function Lectern() {
  return (
    <group position={LECTERN}>
      {/* 车削木腿 */}
      <mesh position={[0, 0, 0]} castShadow material={woodWarmMat}>
        <latheGeometry args={[POST_PROFILE.map((p) => V2(p.x * 1.25, p.y * 0.55)), 16]} />
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
      <mesh position={[0.42, 1.08, -0.1]} castShadow material={brassMat}>
        <cylinderGeometry args={[0.018, 0.022, 0.22, 12]} />
      </mesh>
      <mesh position={[0.42, 1.2, -0.1]}>
        <latheGeometry args={[SMALL_BULB, 18]} />
        <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={1.5} roughness={0.5} toneMapped={false} />
      </mesh>
      <pointLight position={[0.42, 1.2, -0.1]} color={PALETTE.lampWarm} intensity={5} distance={7} decay={2} />
    </group>
  );
}
