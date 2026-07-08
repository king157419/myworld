import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, R_COURT } from "../../theme";
import { POST_PROFILE, SHADE_PROFILE } from "./profiles";
import { brassMat, brassSoftMat } from "./materials";
import { GlowSprite } from "./glow";

// 环广场灯笼：车削灯杆 + 钟形灯罩 + 藏在罩内的暖灯泡。隔一盏才带真实光源（点光预算）。

function Lantern({ position, light = false, baked = false }: { position: THREE.Vector3; light?: boolean; baked?: boolean }) {
  return (
    <group position={position}>
      {/* 静态壳（baked 时由 BakedShell 接管） */}
      {!baked && (
        <>
          {/* 车削灯杆 */}
          <mesh name="lantern-post" userData={{ ljBake: "static" }} position={[0, 0, 0]} castShadow material={brassSoftMat}>
            <latheGeometry args={[POST_PROFILE, 18]} />
          </mesh>
          {/* 顶部铜枝（灯罩由此悬下）*/}
          <mesh name="lantern-arm" userData={{ ljBake: "static" }} position={[0, 2.18, 0]} castShadow material={brassMat}>
            <cylinderGeometry args={[0.022, 0.03, 0.18, 12]} />
          </mesh>
        </>
      )}
      {/* 灯泡（小、暖，藏在罩内）。2.4 的自发光在 bloom 下是一颗无细节白蛋——收到 1.6，亮感交给罩与光晕 */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.062, 16, 12]} />
        <meshStandardMaterial
          color={PALETTE.lampCore}
          emissive={new THREE.Color(PALETTE.lampWarm)}
          emissiveIntensity={1.6}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      {/* 钟形灯罩：底口朝下、罩住灯泡；双面。0.45 的自发光在夜里读作"这盏灯没开"——
          纸罩被灯点亮本来就该整体透暖（1.1），这是"全场灯都亮着"的最便宜一笔 */}
      <mesh name="lantern-shade" userData={{ ljBake: "emitter" }} position={[0, 1.9, 0]} castShadow>
        <latheGeometry args={[SHADE_PROFILE, 28]} />
        <meshStandardMaterial
          color={PALETTE.paperWarm}
          emissive={new THREE.Color(PALETTE.lampWarm)}
          emissiveIntensity={1.1}
          roughness={0.72}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 柔光晕：Sprite 渐变贴图（旧加色球近看是多边形轮廓）*/}
      <GlowSprite position={[0, 1.88, 0]} color={PALETTE.lampWarm} scale={1.05} opacity={0.34} />
      {light && <pointLight position={[0, 1.92, 0]} color={PALETTE.lampWarm} intensity={6} distance={9} decay={2} />}
    </group>
  );
}

export default function Lanterns({ baked = false }: { baked?: boolean }) {
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
        <Lantern key={i} position={l.p} light={l.light} baked={baked} />
      ))}
    </group>
  );
}
