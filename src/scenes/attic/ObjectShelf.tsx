import { useMemo } from "react";
import * as THREE from "three";
import type { Primitive, Zone } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../../scene/interactables";
import { ATTIC_PALETTE, beamMat, woodWarmMat } from "./materials";
import { WarmLamp } from "./lamps";

// 檐下陈列 · 珍视之物（zone-objects）：+X 檐下矮柜/搁架，按 entries 的 primitive/color 数据驱动摆放。
// 用户增删物件 → 架上陈列跟着变（世界可由数据重建）。

const GEO: Record<Primitive, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(0.2, 0.2, 0.2),
  sphere: new THREE.SphereGeometry(0.13, 20, 16),
  cylinder: new THREE.CylinderGeometry(0.1, 0.1, 0.24, 20),
};

const DECO: { p: Primitive; c: string }[] = [
  { p: "box", c: "#5a4636" },
  { p: "cylinder", c: "#6a5a3a" },
  { p: "box", c: "#40484f" },
];

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function objMat(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    // 评审 R12·A2：套书脊 F6 修法——物件保留自身颜色，emissive 换成收敛的琥珀（不是自色白光），
    // 浅色物件（琴谱/票根）才不会被自发白光顶成「灯箱」。
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, emissive: new THREE.Color(ATTIC_PALETTE.glowAmber), emissiveIntensity: 0.14 });
    matCache.set(color, m);
  }
  return m;
}

// 两层搁架的摆位（本地坐标，开面朝 local +Z = 房间侧）。
const SLOTS: [number, number, number][] = [
  [-0.44, 0.62, 0.06], [0.0, 0.62, 0.06], [0.44, 0.62, 0.06],
  [-0.3, 1.08, 0.06], [0.3, 1.08, 0.06],
];

export default function AtticObjectShelf({ zone, low = false }: { zone: Zone; low?: boolean }) {
  const focusZone = useWorld((s) => s.focusZone);
  const gotoEntry = useWorld((s) => s.gotoEntry);
  const objects = useZoneEntries(zone.id, "object");
  const ref = useInteractable(zone.id);

  const items = useMemo(() => {
    const list: { id?: string; p: Primitive; c: string }[] = objects.map((e) => ({ id: e.id, p: e.primitive ?? "box", c: e.color ?? "#8a6f4d" }));
    for (let i = 0; list.length < SLOTS.length; i++) list.push(DECO[i % DECO.length]);
    return list.slice(0, SLOTS.length);
  }, [objects]);

  return (
    <group ref={ref} position={zone.position} rotation={[0, zone.rotation?.[1] ?? 0, 0]} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
      {/* 矮柜柜体 + 两层搁板 */}
      <mesh position={[0, 0.24, 0]} material={woodWarmMat} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.48, 0.5]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} material={beamMat} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 0.46]} />
      </mesh>
      <mesh position={[0, 0.98, 0]} material={beamMat} receiveShadow>
        <boxGeometry args={[1.3, 0.04, 0.42]} />
      </mesh>
      {/* 侧立板 */}
      {[-0.73, 0.73].map((x, i) => (
        <mesh key={i} position={[x, 0.75, 0]} material={beamMat}>
          <boxGeometry args={[0.05, 0.94, 0.44]} />
        </mesh>
      ))}

      {/* 数据驱动陈列物 */}
      {items.map((it, i) => {
        const s = SLOTS[i];
        return (
          <mesh
            key={it.id ?? `deco-${i}`}
            geometry={GEO[it.p]}
            material={objMat(it.c)}
            position={[s[0], s[1], s[2]]}
            castShadow
            dispose={null}
            onClick={it.id ? (e) => { e.stopPropagation(); gotoEntry(it.id!); } : undefined}
          />
        );
      })}

      {/* 檐下矮暖灯（短距，只把陈列一带浸暖）——收敛光强，浅色物件读作暖奶白而非曝白灯箱（评审 R12·A2） */}
      <WarmLamp position={[0.62, 1.28, 0.1]} intensity={3.2} distance={2.7} scale={0.55} low={low} />
      <pointLight userData={{ ljBake: "content" }} position={[0, 1.3, 0.1]} color={ATTIC_PALETTE.lampWarm} intensity={1.0} distance={2.6} decay={2} />

      {/* 碰撞盒 */}
      <mesh visible={false} position={[0, 0.8, 0]}>
        <boxGeometry args={[1.6, 1.5, 0.8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
