import { useMemo } from "react";
import * as THREE from "three";
import type { Zone } from "../config/types";
import { useWorld } from "../store/useWorld";
import { useInteractable } from "../scene/interactables";

// 占位场景的 zone 视觉：简单原语，但**数据驱动**——书架/陈列/唱片按该区 entries 数量给出
// 最小反馈（点亮的书脊数 / 陈列物数 / 唱片存在感）。交互完全复用 loft 的那套：
//   useInteractable 登记 zone.id → 准心射线命中 → onClick / ENTER 调 focusZone(zone.id)；
//   HUD 聚焦层按 zone.type 分发 BookEditor / ObjectForm / RecordPanel（占位场景零改动即可编辑内容）。
// 正式成品在后续轮替换，几何契约不变（id/type 数据驱动）。

const ACCENT: Record<Zone["type"], string> = {
  bookshelf: "#c9a05a",
  objects: "#6aa0b8",
  record: "#c07a5a",
};

export default function PlaceholderZone({ zone, tint }: { zone: Zone; tint?: string }) {
  const focusZone = useWorld((s) => s.focusZone);
  const entries = useWorld((s) => s.entries);
  const ref = useInteractable(zone.id);

  // 数据驱动：本区内容条数（选择器只取 entries，过滤/计数在 useMemo，避免 getSnapshot 循环）。
  const count = useMemo(() => entries.filter((e) => e.zoneId === zone.id).length, [entries, zone.id]);

  const accent = tint ?? ACCENT[zone.type];
  const glowColor = useMemo(() => new THREE.Color(accent), [accent]);
  const shown = Math.min(Math.max(count, 1), 8); // 至少 1 个占位块，最多显示 8

  return (
    <group
      ref={ref}
      position={zone.position}
      rotation={[0, zone.rotation?.[1] ?? 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        focusZone(zone.id);
      }}
    >
      {/* 底座（书架板 / 陈列台 / 唱机箱），型随 type 微变，认得出但不追求好看 */}
      {zone.type === "bookshelf" && (
        <mesh castShadow position={[0, 0.75, -0.12]}>
          <boxGeometry args={[1.4, 1.5, 0.24]} />
          <meshStandardMaterial color="#2a2018" roughness={0.85} />
        </mesh>
      )}
      {zone.type === "objects" && (
        <mesh castShadow position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.55, 0.62, 0.7, 20]} />
          <meshStandardMaterial color="#26303a" roughness={0.7} metalness={0.2} />
        </mesh>
      )}
      {zone.type === "record" && (
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.7]} />
          <meshStandardMaterial color="#2c221c" roughness={0.7} />
        </mesh>
      )}

      {/* 数据驱动的发光内容：条数越多越密越亮 */}
      {Array.from({ length: shown }).map((_, i) => {
        if (zone.type === "bookshelf") {
          // 书脊：沿架面横排点亮
          const x = -0.55 + (i / 7) * 1.1;
          const h = 0.28 + (i % 3) * 0.08;
          return (
            <mesh key={i} position={[x, 0.55 + h / 2, 0.02]}>
              <boxGeometry args={[0.1, h, 0.16]} />
              <meshStandardMaterial color={accent} emissive={glowColor} emissiveIntensity={0.4} toneMapped={false} />
            </mesh>
          );
        }
        if (zone.type === "objects") {
          // 陈列物：绕台顶环形摆放
          const a = (i / shown) * Math.PI * 2;
          return (
            <mesh key={i} castShadow position={[Math.cos(a) * 0.32, 0.85, Math.sin(a) * 0.32]}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
              <meshStandardMaterial color={accent} emissive={glowColor} emissiveIntensity={0.3} metalness={0.4} roughness={0.4} />
            </mesh>
          );
        }
        // record：叠放的唱片
        return (
          <mesh key={i} position={[0, 0.72 + i * 0.02, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.014, 32]} />
            <meshStandardMaterial color={i === 0 ? accent : "#141118"} emissive={i === 0 ? glowColor : new THREE.Color("#000")} emissiveIntensity={i === 0 ? 0.5 : 0} roughness={0.35} metalness={0.5} />
          </mesh>
        );
      })}

      {/* 区光：内容越多越亮（占位期简单反馈；正式轮接烘焙契约 content 灯） */}
      <pointLight color={accent} intensity={0.6 + Math.min(count, 8) * 0.25} distance={5} decay={2} position={[0, 1.4, 0.3]} />

      {/* 不可见大碰撞盒：让准心在整个占位物范围内都能命中并聚焦 */}
      <mesh visible={false} position={[0, 0.9, 0]}>
        <boxGeometry args={[1.6, 1.8, 1.2]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
