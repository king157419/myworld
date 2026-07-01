import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, R_COURT } from "../../theme";
import { POST_PROFILE, SHADE_PROFILE } from "./profiles";
import { brassMat, brassSoftMat } from "./materials";

// 环广场灯笼：车削灯杆 + 钟形灯罩 + 藏在罩内的暖灯泡。隔一盏才带真实光源（点光预算）。

function Lantern({ position, light = false }: { position: THREE.Vector3; light?: boolean }) {
  return (
    <group position={position}>
      {/* 车削灯杆 */}
      <mesh position={[0, 0, 0]} castShadow material={brassSoftMat}>
        <latheGeometry args={[POST_PROFILE, 18]} />
      </mesh>
      {/* 顶部铜枝（灯罩由此悬下）*/}
      <mesh position={[0, 2.18, 0]} castShadow material={brassMat}>
        <cylinderGeometry args={[0.022, 0.03, 0.18, 12]} />
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

export default function Lanterns() {
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
