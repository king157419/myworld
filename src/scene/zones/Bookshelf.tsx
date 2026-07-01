import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Zone } from "../../config/types";
import { BOOKWALL, LECTERN, PALETTE, ZONE_ANCHORS, tideOffset } from "../../theme";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../interactables";

// 书墙 · 思考：-X 圆弧书墙 + 写作台热区。
// 用户"思考"越多，书脊的暖光越密越亮。
// 点击书墙或写作台任一区域都聚焦本区。

const SPINE_COLORS = [
  "#6b2b22", "#2f4a5a", "#4a3a22", "#3a4a2e", "#5a3a4a",
  "#2a3550", "#7a5a2a", "#43302a", "#8a6a3a", "#4a5a6a",
] as const;

function seededRng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

// 沿圆弧书墙排一排发光书脊（instanced），位置在书架面内侧（朝圆心）。
function useGlowSpines(count: number) {
  return useMemo(() => {
    const r = seededRng(42);
    const { radius, a0, a1, height, shelves } = BOOKWALL;
    const rowH = height / shelves;
    const segCount = 7;
    const actual = Math.max(Math.min(count, 24), 3);

    const spines: { m: THREE.Matrix4; color: THREE.Color }[] = [];
    for (let i = 0; i < actual; i++) {
      const seg = i % segCount;
      const a = a0 + (a1 - a0) * ((seg + 0.5 + r() * 0.4 - 0.2) / segCount);
      const x = Math.cos(a) * (radius - 0.18);
      const z = Math.sin(a) * (radius - 0.18);
      const ry = a + Math.PI / 2;

      const lvl = Math.floor(r() * shelves);
      const y = 0.55 + lvl * rowH + r() * (rowH * 0.5);
      const w = 0.1 + r() * 0.07;
      const h = 0.28 + r() * 0.18;

      const mat = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      mat.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(0.15, h, w));
      spines.push({ m: mat, color: new THREE.Color(SPINE_COLORS[i % SPINE_COLORS.length]) });
    }
    return spines;
  }, [count]);
}

export default function Bookshelf({ zone }: { zone: Zone }) {
  const focusZone = useWorld((s) => s.focusZone);
  const thoughts = useZoneEntries(zone.id, "thought");
  const ref = useInteractable(zone.id);
  // 写作台也注册同一 zoneId
  const lecternRef = useInteractable(zone.id);
  const glowGroupRef = useRef<THREE.Group>(null);

  const spines = useGlowSpines(thoughts.length);
  const anchor = ZONE_ANCHORS["zone-bookshelf"];

  // instanced mesh callback：挂载时写矩阵与颜色
  const meshCb = useMemo(() => (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    spines.forEach((s, i) => {
      mesh.setMatrixAt(i, s.m);
      mesh.setColorAt(i, s.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spines]);

  // 书脊随潮汐微微起伏
  useFrame((s) => {
    const g = glowGroupRef.current;
    if (!g) return;
    g.position.y = tideOffset(s.clock.elapsedTime) * 0.3;
  });

  const lightIntensity = 1.8 + Math.min(thoughts.length, 10) * 0.7;

  return (
    <>
      {/* 书墙主热区：覆盖整段圆弧 */}
      <group ref={ref} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
        {/* 不可见的大碰撞盒，让准心在圆弧范围内都能命中 */}
        <mesh
          position={[anchor.position[0], anchor.position[1] - 0.55, anchor.position[2]]}
          rotation={[0, anchor.ry, 0]}
          visible={false}
        >
          <boxGeometry args={[0.5, BOOKWALL.height + 0.4, 10.0]} />
          <meshBasicMaterial />
        </mesh>

        {/* 发光书脊（用户思考驱动）*/}
        {spines.length > 0 && (
          <group ref={glowGroupRef}>
            <instancedMesh
              ref={meshCb}
              args={[undefined, undefined, spines.length]}
              castShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                roughness={0.7}
                metalness={0.03}
                emissive={new THREE.Color(PALETTE.glowAmber)}
                emissiveIntensity={0.35}
                toneMapped={false}
              />
            </instancedMesh>
          </group>
        )}

        {/* 思考越多，书墙暖光越亮 */}
        <pointLight
          position={[anchor.position[0] + 1.0, anchor.position[1] - 0.3, anchor.position[2]]}
          color={PALETTE.lampWarm}
          intensity={lightIntensity}
          distance={8}
          decay={2}
        />
      </group>

      {/* 写作台热区：独立注册同一 zoneId，点击台面也能聚焦 */}
      <group
        ref={lecternRef}
        position={LECTERN}
        onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}
      >
        <mesh visible={false} position={[0, 0.6, 0]}>
          <boxGeometry args={[0.9, 1.2, 0.9]} />
          <meshBasicMaterial />
        </mesh>
      </group>
    </>
  );
}
