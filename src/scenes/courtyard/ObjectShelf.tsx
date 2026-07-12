import { useMemo } from "react";
import * as THREE from "three";
import type { Primitive, Zone } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../../scene/interactables";
import { COURT_PALETTE, woodMat, woodWarmMat } from "./materials";

// 廊下陈列 · 珍视之物（zone-objects）：后内墙一座博古架（不规则格），按 entries 的 primitive/color
// 数据驱动摆放。用户增删物件 → 架上陈列跟着变（世界可由数据重建）。色皆灰绿墨黑，无饱和色。

const GEO: Record<Primitive, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(0.16, 0.16, 0.16),
  sphere: new THREE.SphereGeometry(0.1, 18, 14),
  cylinder: new THREE.CylinderGeometry(0.08, 0.08, 0.2, 18),
};

const DECO: { p: Primitive; c: string }[] = [
  { p: "cylinder", c: "#5a6258" },
  { p: "box", c: "#484f47" },
  { p: "sphere", c: "#6a7268" },
];

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function objMat(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12 });
    matCache.set(color, m);
  }
  return m;
}

// 不规则格（本地坐标，开面朝 local +Z）：[x, y, 格宽, 格高]。
const NICHES: [number, number, number, number][] = [
  [-0.42, 0.5, 0.5, 0.55],
  [0.28, 0.42, 0.75, 0.4],
  [-0.5, 1.12, 0.42, 0.5],
  [0.12, 1.02, 0.5, 0.62],
  [0.56, 1.18, 0.42, 0.42],
];

export default function CourtyardObjectShelf({ zone, low = false }: { zone: Zone; low?: boolean }) {
  const focusZone = useWorld((s) => s.focusZone);
  const gotoEntry = useWorld((s) => s.gotoEntry);
  const objects = useZoneEntries(zone.id, "object");
  const ref = useInteractable(zone.id);

  const items = useMemo(() => {
    const list: { id?: string; p: Primitive; c: string }[] = objects.map((e) => ({ id: e.id, p: e.primitive ?? "box", c: e.color ?? "#6a7268" }));
    for (let i = 0; list.length < NICHES.length; i++) list.push(DECO[i % DECO.length]);
    return list.slice(0, NICHES.length);
  }, [objects]);

  return (
    <group ref={ref} position={zone.position} rotation={[0, zone.rotation?.[1] ?? 0, 0]} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
      {/* 架体背板 + 外框 */}
      <mesh position={[0, 0.8, -0.16]} material={woodMat} receiveShadow>
        <boxGeometry args={[1.5, 1.6, 0.06]} />
      </mesh>
      {[-0.75, 0.75].map((x, i) => (
        <mesh key={`s${i}`} position={[x, 0.8, -0.02]} material={woodMat}>
          <boxGeometry args={[0.06, 1.6, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, 1.58, -0.02]} material={woodMat}><boxGeometry args={[1.56, 0.06, 0.3]} /></mesh>
      <mesh position={[0, 0.02, -0.02]} material={woodMat}><boxGeometry args={[1.56, 0.06, 0.3]} /></mesh>
      {/* 不规则隔板（格） */}
      {NICHES.map((n, i) => (
        <group key={`n${i}`}>
          <mesh position={[n[0], n[1] - n[3] / 2, -0.02]} material={woodWarmMat} receiveShadow>
            <boxGeometry args={[n[2], 0.04, 0.28]} />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[n[0] - n[2] / 2, n[1], -0.02]} material={woodWarmMat}>
              <boxGeometry args={[0.04, n[3], 0.28]} />
            </mesh>
          )}
        </group>
      ))}

      {/* 数据驱动陈列物（落在各格内） */}
      {items.map((it, i) => {
        const n = NICHES[i];
        return (
          <mesh
            key={it.id ?? `deco-${i}`}
            geometry={GEO[it.p]}
            material={objMat(it.c)}
            position={[n[0], n[1] - n[3] + 0.14, 0.02]}
            castShadow
            dispose={null}
            onClick={it.id ? (e) => { e.stopPropagation(); gotoEntry(it.id!); } : undefined}
          />
        );
      })}

      {/* 内容灯（暖、短距、低——把陈列一带浸暖便于辨认） */}
      {!low && (
        <pointLight userData={{ ljBake: "content" }} position={[0, 1.2, 0.7]} color={COURT_PALETTE.lampWarm} intensity={1.1} distance={2.6} decay={2} />
      )}

      {/* 碰撞盒 */}
      <mesh visible={false} position={[0, 0.85, 0.1]}>
        <boxGeometry args={[1.6, 1.7, 0.7]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
