import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh } from "three";
import type { Zone } from "../../config/types";
import { DECK_Y, GRAMOPHONE, PALETTE } from "../../theme";
import { useWorld } from "../../store/useWorld";
import { useInteractable } from "../interactables";

// 留声机 · 影音：观星台上的 GRAMOPHONE 热区 + 旋转黑胶碟。
// Gallery 已渲染留声机箱体和喇叭；这里只叠加：
//   - 旋转的黑胶唱片（播放时飞转，反之停止）
//   - 准心可点击的根 group
// 音轨列表在 ui/RecordPanel 里；playingTrackId 驱动转速。

export default function RecordPlayer({ zone }: { zone: Zone }) {
  const disc = useRef<Mesh>(null);
  const focusZone = useWorld((s) => s.focusZone);
  // playingTrackId 非 null 即为"有音轨正在播放"
  const playingTrackId = useWorld((s) => s.playingTrackId);
  const ref = useInteractable(zone.id);

  useFrame((_, dt) => {
    if (!disc.current) return;
    // 有选中音轨时飞转，否则静止
    disc.current.rotation.y += dt * (playingTrackId ? 3.8 : 0.0);
  });

  // 留声机顶台：Gallery 里 Gramophone 在 GRAMOPHONE 位置，顶台在 y=0.72（箱体 0.7+0.03/2）
  const discY = 0.74; // 紧贴顶台面
  const labelY = 0.755;

  return (
    <group
      ref={ref}
      position={GRAMOPHONE}
      onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}
    >
      {/* 旋转黑胶唱片 */}
      <mesh ref={disc} position={[0, discY, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.022, 48]} />
        <meshStandardMaterial color={"#0c0c0c"} roughness={0.28} metalness={0.22} />
      </mesh>

      {/* 唱片中心标签（播放时发暖光）*/}
      <mesh position={[0, labelY, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.008, 24]} />
        <meshStandardMaterial
          color={playingTrackId ? PALETTE.brass : "#6a5030"}
          emissive={new THREE.Color(playingTrackId ? PALETTE.glowAmber : "#000000")}
          emissiveIntensity={playingTrackId ? 0.9 : 0}
          roughness={0.5}
        />
      </mesh>

      {/* 播放时在唱片上方打一束暖光 */}
      <pointLight
        position={[0, 0.85, 0]}
        color={PALETTE.lampWarm}
        intensity={playingTrackId ? 4.5 : 1.2}
        distance={5}
        decay={2}
      />

      {/* 不可见的大碰撞盒，方便准心命中整个留声机区 */}
      <mesh
        position={[0, DECK_Y * 0.4, 0]}
        visible={false}
      >
        <boxGeometry args={[1.2, 1.5, 1.2]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
