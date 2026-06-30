import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import type { Primitive, Zone } from "../../config/types";
import { PALETTE, PEDESTALS, tideOffset } from "../../theme";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../interactables";

// 浮岛陈列 · 珍视之物：+X 水面浮岛上的发光陈列。
// 每件用户物件按其 primitive/color 生成，放在对应基座顶台，缓缓自转随潮起伏。
// 没有足够物件时用预设陈设占位（让岛不空）。

const GEO: Record<Primitive, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(0.36, 0.36, 0.36),
  sphere: new THREE.SphereGeometry(0.24, 28, 28),
  cylinder: new THREE.CylinderGeometry(0.2, 0.2, 0.46, 28),
};

const DECO: { p: Primitive; c: string }[] = [
  { p: "sphere", c: PALETTE.brass },
  { p: "box", c: "#3a5a6a" },
  { p: "cylinder", c: "#7a3a3a" },
  { p: "sphere", c: "#4a6a4a" },
  { p: "box", c: "#6a4a6a" },
];

// 简易材质缓存（按颜色复用，避免每帧重建）
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function objMat(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.45,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.28,
    });
    matCache.set(color, m);
  }
  return m;
}

export default function ObjectMuseum({ zone }: { zone: Zone }) {
  const focusZone = useWorld((s) => s.focusZone);
  const gotoEntry = useWorld((s) => s.gotoEntry);
  const objects = useZoneEntries(zone.id, "object");
  const ref = useInteractable(zone.id);
  const spins = useRef<(Group | null)[]>([]);

  // 物件列表：用户内容 + 陈设填充（保证每个基座都有东西）
  const items = useMemo(() => {
    const list: { id?: string; p: Primitive; c: string }[] = objects.map((e) => ({
      id: e.id,
      p: e.primitive ?? "box",
      c: e.color ?? PALETTE.brass,
    }));
    for (let i = 0; list.length < PEDESTALS.length; i++) {
      list.push(DECO[i % DECO.length]);
    }
    return list.slice(0, PEDESTALS.length);
  }, [objects]);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const tide = tideOffset(t);
    spins.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.y += dt * 0.38;
      // 轻微潮汐起伏
      const ped = PEDESTALS[i % PEDESTALS.length];
      g.position.y = ped.h + 0.30 + Math.sin(t * 0.5 + i * 1.3) * 0.018 + tide * 0.45;
    });
  });

  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); focusZone(zone.id, [e.point.x, e.point.y, e.point.z]); }}>
      {items.map((it, i) => {
        const ped = PEDESTALS[i % PEDESTALS.length];
        return (
          <group key={it.id ?? `deco-${i}`}>
            {/* 每件物件：自转 + 潮汐起伏（y 在 useFrame 里更新）*/}
            <group
              ref={(g) => { spins.current[i] = g; }}
              position={[ped.pos[0], ped.h + 0.30, ped.pos[2]]}
              onClick={it.id ? (e) => { e.stopPropagation(); gotoEntry(it.id!); } : undefined}
            >
              <mesh
                geometry={GEO[it.p]}
                material={objMat(it.c)}
                castShadow
                dispose={null}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}
