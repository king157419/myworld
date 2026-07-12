import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import type { Zone } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { useAudio } from "../../audio/useAudio";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../../scene/interactables";
import { COURT_PALETTE, woodMat, woodWarmMat } from "./materials";

// 琴音 · 影音（zone-record）：本场景的「唱机」是一张古琴。契约 type=record 不变，皮肤换成古琴——
// 播放时（useAudio.musicPlaying）琴弦泛起微光并轻颤（收敛，不像灯管——场景 A 教训）。
// 琴音曲库《平沙落雁》的接线在 useCourtyardAudio；此处只做视觉与聚焦登记。

const lacquerMat = new THREE.MeshStandardMaterial({ color: "#241c16", roughness: 0.42, metalness: 0.12 });

export default function Guqin({ zone, low = false }: { zone: Zone; low?: boolean }) {
  const focusZone = useWorld((s) => s.focusZone);
  const playing = useAudio((s) => s.musicPlaying);
  const tracks = useZoneEntries(zone.id, "track");
  const ref = useInteractable(zone.id);
  const stringsRef = useRef<Group>(null);

  const L = 1.24; // 琴长（local X）
  const W = 0.2; // 琴宽
  const stringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8c48f", emissive: new THREE.Color(COURT_PALETTE.glowAmber), emissiveIntensity: 0, roughness: 0.6, toneMapped: false }), []);

  useFrame((s) => {
    if (!stringsRef.current) return;
    const t = s.clock.elapsedTime;
    // 播放时：微光脉动 + 极轻上下颤（收敛幅度）
    const glow = playing ? 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(t * 5.0)) : 0;
    stringMat.emissiveIntensity = glow;
    stringsRef.current.position.y = playing ? Math.sin(t * 9.0) * 0.0015 : 0;
  });

  const strings = 7;

  return (
    <group ref={ref} position={zone.position} rotation={[0, zone.rotation?.[1] ?? -Math.PI / 2, 0]} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
      {/* 琴几（矮案） */}
      <mesh position={[0, 0.36, 0]} material={woodWarmMat} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.05, 0.44]} />
      </mesh>
      {[[-0.66, -0.16], [0.66, -0.16], [-0.66, 0.16], [0.66, 0.16]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.18, p[1]]} material={woodMat} castShadow>
          <boxGeometry args={[0.05, 0.36, 0.05]} />
        </mesh>
      ))}

      {/* 琴身（长板，微拱，黑漆） */}
      <mesh position={[0, 0.42, 0]} material={lacquerMat} castShadow receiveShadow>
        <boxGeometry args={[L, 0.045, W]} />
      </mesh>
      {/* 岳山 / 龙龈（两端微起） */}
      {[-L / 2 + 0.05, L / 2 - 0.05].map((x, i) => (
        <mesh key={i} position={[x, 0.45, 0]} material={lacquerMat}>
          <boxGeometry args={[0.05, 0.03, W]} />
        </mesh>
      ))}
      {/* 十三徽（一排小点） */}
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={i} position={[-L / 2 + 0.12 + (i / 12) * (L - 0.24), 0.465, W / 2 - 0.02]}>
          <cylinderGeometry args={[0.008, 0.008, 0.004, 8]} />
          <meshStandardMaterial color={"#cdd3cb"} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      {/* 七弦（播放时微光轻颤） */}
      <group ref={stringsRef}>
        {Array.from({ length: strings }).map((_, i) => {
          const z = -W / 2 + 0.03 + (i / (strings - 1)) * (W - 0.06);
          return (
            <mesh key={i} position={[0, 0.472, z]} rotation={[0, 0, Math.PI / 2]} material={stringMat}>
              <cylinderGeometry args={[0.0035, 0.0035, L - 0.08, 6]} />
            </mesh>
          );
        })}
      </group>

      {/* 一卷琴谱靠案（存在感随 tracks；至少 1） */}
      {Array.from({ length: Math.max(1, Math.min(tracks.length, 2)) }).map((_, i) => (
        <mesh key={i} position={[0.55 + i * 0.09, 0.47, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.24, 12]} />
          <meshStandardMaterial color={"#d8c48f"} roughness={0.88} />
        </mesh>
      ))}

      {/* 内容灯（暖、短距；播放时略强，把琴浸在暖光里） */}
      {!low && (
        <pointLight userData={{ ljBake: "content" }} position={[0, 1.0, 0.5]} color={COURT_PALETTE.lampWarm} intensity={playing ? 1.5 : 1.0} distance={2.6} decay={2} />
      )}

      {/* 碰撞盒 */}
      <mesh visible={false} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.6, 1.1, 0.7]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
