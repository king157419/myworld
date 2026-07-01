import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh } from "three";
import type { Zone } from "../../config/types";
import { DECK_Y, GRAMOPHONE, PALETTE } from "../../theme";
import { useWorld } from "../../store/useWorld";
import { useAudio } from "../../audio/useAudio";
import { useInteractable } from "../interactables";

// 留声机 · 影音：观星台上的 GRAMOPHONE 热区 + 旋转黑胶碟。
// Gallery 已渲染留声机箱体和喇叭；这里只叠加：
//   - 旋转的黑胶唱片（播放时飞转，反之停止）
//   - 准心可点击的根 group
// 音轨列表在 ui/RecordPanel 里；useAudio.musicPlaying（曲库真实播放态）驱动转速与辉光。

export default function RecordPlayer({ zone }: { zone: Zone }) {
  const disc = useRef<Mesh>(null);
  const focusZone = useWorld((s) => s.focusZone);
  const playing = useAudio((s) => s.musicPlaying);
  const ref = useInteractable(zone.id);

  useFrame((_, dt) => {
    if (!disc.current) return;
    // 播放中飞转，暂停静止
    disc.current.rotation.y += dt * (playing ? 3.8 : 0.0);
  });

  // 留声机唱盘：GLB 模型（GramophoneModel）箱体顶面在世界 y≈1.702、唱针臂在 ≈1.728。
  // 旋转碟落在唱盘上（贴着模型自带唱片、压在唱针臂下方），让"正在放"的碟真的转。
  // GRAMOPHONE 世界 y=1.45，故本地 discY = 1.71-1.45 ≈ 0.26。
  const discY = 0.26; // 紧贴模型唱盘面
  const labelY = 0.272;

  return (
    <group
      ref={ref}
      position={GRAMOPHONE}
      onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}
    >
      {/* 旋转黑胶唱片（盖住模型静态唱片，转起来就是"在放"）*/}
      <mesh ref={disc} position={[0, discY, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.016, 48]} />
        <meshStandardMaterial color={"#0a0a0d"} roughness={0.3} metalness={0.24} />
      </mesh>

      {/* 唱片中心标签（播放时发暖光）*/}
      <mesh position={[0, labelY, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.008, 24]} />
        <meshStandardMaterial
          color={playing ? PALETTE.brass : "#6a5030"}
          emissive={new THREE.Color(playing ? PALETTE.glowAmber : "#000000")}
          emissiveIntensity={playing ? 0.9 : 0}
          roughness={0.5}
        />
      </mesh>

      {/* 播放时在唱盘/喇叭口之间打一束暖光 */}
      <pointLight
        position={[0, 0.55, 0.05]}
        color={PALETTE.lampWarm}
        intensity={playing ? 4.0 : 1.0}
        distance={4}
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
