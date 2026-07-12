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

  // 留声机唱盘：自制 GLB（build_gramophone.py）毛毡顶面在本地 y≈0.242（0.252×缩放 0.961）。
  // 旋转碟直接贴在毛毡上转（碟厚 0.016，中心 = 0.242+0.008），唱针轴尖从碟心标签下探出。
  const discY = 0.25; // 紧贴毛毡面
  const labelY = 0.261;

  return (
    <group
      ref={ref}
      position={GRAMOPHONE}
      onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}
    >
      {/* 旋转黑胶唱片（盖住模型静态唱片，转起来就是"在放"）。
          高金属低粗糙：黑胶要靠掠射的灯光沟纹反光被认出来——纯黑哑面从侧面看是"喇叭上的黑洞"（审计遗留）*/}
      <mesh ref={disc} position={[0, discY, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.016, 48]} />
        <meshStandardMaterial color={"#101014"} roughness={0.18} metalness={0.6} envMapIntensity={1.6} />
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

      {/* 播放时在唱盘/喇叭口之间打一束暖光（内容灯：随播放态变，烘焙管线跳过） */}
      <pointLight
        userData={{ ljBake: "content" }}
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
