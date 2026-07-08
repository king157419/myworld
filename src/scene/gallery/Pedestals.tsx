import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, PEDESTALS } from "../../theme";
import { V2 } from "./profiles";
import { brassMat } from "./materials";

// 立在水上的发光陈列岛：水面小基座 + 细黄铜柱 + 顶台。物件由 zones/ObjectMuseum 叠在顶台上。

export default function Pedestals({ baked = false }: { baked?: boolean }) {
  return (
    <group>
      {PEDESTALS.map((p, i) => (
        <group key={i} position={[p.pos[0], 0, p.pos[2]]}>
          {/* 静态壳（baked 时由 BakedShell 接管） */}
          {!baked && (
            <>
              <RoundedBox name="ped-base" userData={{ ljBake: "static" }} args={[p.r * 1.7, 0.12, p.r * 1.7]} radius={0.05} smoothness={3} position={[0, 0.06, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={PALETTE.stoneLit} roughness={0.72} metalness={0.1} />
              </RoundedBox>
              {/* 车削黄铜柱 */}
              <mesh name="ped-column" userData={{ ljBake: "static" }} position={[0, p.h / 2 + 0.1, 0]} castShadow material={brassMat}>
                <latheGeometry args={[[V2(0.085, 0), V2(0.06, 0.12), V2(0.055, p.h * 0.55), V2(0.07, p.h * 0.9), V2(0.085, p.h)], 24]} />
              </mesh>
              {/* 顶台（倒角圆盘） */}
              <mesh name="ped-top" userData={{ ljBake: "static" }} position={[0, p.h + 0.12, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[p.r * 0.62, p.r * 0.6, 0.08, 28]} />
                <meshStandardMaterial color={PALETTE.woodWarm} roughness={0.58} metalness={0.1} />
              </mesh>
              {/* 顶台铜沿 */}
              <mesh name="ped-rim" userData={{ ljBake: "static" }} position={[0, p.h + 0.16, 0]} material={brassMat}>
                <torusGeometry args={[p.r * 0.62, 0.012, 10, 32]} />
              </mesh>
            </>
          )}
          {/* 顶台暖光圈：收敛成一道细暖鞘，别再像发光"飞碟环" */}
          <mesh position={[0, p.h + 0.175, 0]}>
            <torusGeometry args={[p.r * 0.5, 0.008, 8, 28]} />
            <meshStandardMaterial color={PALETTE.lampCore} emissive={new THREE.Color(PALETTE.lampWarm)} emissiveIntensity={0.6} toneMapped={false} />
          </mesh>
          {/* 接水柔光：基座落在水面处一小团暖光，给"立在水上"的落地感 */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[p.r * 1.5, 24]} />
            <meshBasicMaterial color={PALETTE.lampWarm} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <pointLight position={[0, p.h + 0.45, 0]} color={PALETTE.lampWarm} intensity={1.3} distance={2.8} decay={2} />
        </group>
      ))}
    </group>
  );
}
