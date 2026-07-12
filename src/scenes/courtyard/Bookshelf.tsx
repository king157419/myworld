import { useMemo } from "react";
import * as THREE from "three";
import type { Zone } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../../scene/interactables";
import { COURT_PALETTE, woodMat, woodWarmMat } from "./materials";
import { DESK, SPOT } from "./theme";

// 书案 · 思考（zone-bookshelf）：西内墙一架卷轴架（挂着几幅立轴 + 卷着几卷手卷，数量跟 thoughts 走）
// + 书房居中的矮几（摊开卷轴 + 砚台 + 毛笔）。满分锚 ref_scroll_calligraphy_4：宣纸黄化斑驳、墨有浓淡。
// 数据驱动：思考越多，架上点亮的卷轴越多（微光收敛，不像灯管——场景 A 教训）。

// 摊开卷轴上的一段字（静态道具纹理，楷体，做旧纸）。
function ScrollTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 320;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e4d3a6";
  ctx.fillRect(0, 0, c.width, c.height);
  const g = ctx.createRadialGradient(320, 150, 40, 320, 160, 360);
  g.addColorStop(0, "rgba(255,246,214,0.5)");
  g.addColorStop(1, "rgba(150,120,72,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  // 竖排一句（自右向左）
  ctx.fillStyle = "#2a2016";
  ctx.textBaseline = "top";
  const lines = ["空山新雨后", "天气晚来秋"];
  lines.forEach((ln, col) => {
    const x = 560 - col * 120;
    ctx.font = "46px 'Kaiti','KaiTi','STKaiti',serif";
    for (let i = 0; i < ln.length; i++) ctx.fillText(ln[i], x, 40 + i * 52);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const AGED = ["#e4d3a6", "#d8c48f", "#e9dcb4", "#cdb884"];

export default function CourtyardBookshelf({ zone, low = false }: { zone: Zone; low?: boolean }) {
  const focusZone = useWorld((s) => s.focusZone);
  const thoughts = useZoneEntries(zone.id, "thought");
  const rackRef = useInteractable(zone.id);
  const deskRef = useInteractable(zone.id);
  const scrollTex = useMemo(() => ScrollTexture(), []);

  // 数量跟 thoughts 走（至少 3，至多 8）：一半挂轴、一半手卷。
  const total = Math.max(3, Math.min(thoughts.length || 3, 8));
  const hung = Math.ceil(total / 2);
  const rolled = total - hung;

  const rackH = 1.9;
  const rackW = 1.7;

  return (
    <group>
      {/* ───────── 卷轴架（西内墙，front 朝室内 +X） ───────── */}
      <group ref={rackRef} position={SPOT.bookshelf} rotation={[0, zone.rotation?.[1] ?? Math.PI / 2, 0]} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
        {/* 立框 + 顶横 + 挂杆 + 下层板 */}
        {[-rackW / 2, rackW / 2].map((x, i) => (
          <mesh key={i} position={[x, rackH / 2, -0.12]} material={woodMat}>
            <boxGeometry args={[0.07, rackH, 0.24]} />
          </mesh>
        ))}
        <mesh position={[0, rackH - 0.05, -0.12]} material={woodMat}>
          <boxGeometry args={[rackW + 0.1, 0.08, 0.24]} />
        </mesh>
        {/* 挂杆（立轴悬于此） */}
        <mesh position={[0, rackH - 0.18, 0.02]} rotation={[0, 0, Math.PI / 2]} material={woodMat}>
          <cylinderGeometry args={[0.02, 0.02, rackW, 8]} />
        </mesh>
        {/* 下层板（放手卷） */}
        <mesh position={[0, 0.5, -0.05]} material={woodWarmMat} receiveShadow>
          <boxGeometry args={[rackW, 0.05, 0.34]} />
        </mesh>
        <mesh position={[0, 0.02, -0.05]} material={woodWarmMat} receiveShadow>
          <boxGeometry args={[rackW, 0.05, 0.34]} />
        </mesh>

        {/* 挂着的立轴（挂几幅；点亮的偏亮一档，代表被写下的思考） */}
        {Array.from({ length: hung }).map((_, i) => {
          const x = -rackW / 2 + ((i + 0.5) / hung) * rackW;
          const lit = i < thoughts.length;
          const h = 1.0 + (i % 3) * 0.14;
          const col = AGED[i % AGED.length];
          return (
            <group key={i} position={[x, rackH - 0.24 - h / 2, 0.03]}>
              {/* 天杆 + 地轴（木） */}
              <mesh position={[0, h / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMat}><cylinderGeometry args={[0.016, 0.016, 0.34, 6]} /></mesh>
              <mesh position={[0, -h / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMat}><cylinderGeometry args={[0.02, 0.02, 0.36, 6]} /></mesh>
              {/* 画心（做旧宣纸；点亮微光收敛） */}
              <mesh>
                <planeGeometry args={[0.28, h]} />
                <meshStandardMaterial color={col} emissive={new THREE.Color(COURT_PALETTE.glowAmber)} emissiveIntensity={lit ? 0.14 : 0} roughness={0.9} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
            </group>
          );
        })}

        {/* 卷着的手卷（下层板上横放） */}
        {Array.from({ length: rolled }).map((_, i) => {
          const x = -rackW / 2 + 0.2 + (i / Math.max(rolled, 1)) * (rackW - 0.4);
          return (
            <mesh key={i} position={[x, 0.58, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.34, 12]} />
              <meshStandardMaterial color={AGED[(i + 1) % AGED.length]} roughness={0.88} />
            </mesh>
          );
        })}

        {/* 内容灯（暖、短距、低——照亮卷轴一带，墙角仍暗；思考越多略亮） */}
        <pointLight
          userData={{ ljBake: "content" }}
          position={[0.5, rackH - 0.4, 0.6]}
          color={COURT_PALETTE.lampWarm}
          intensity={1.0 + Math.min(thoughts.length, 8) * 0.16}
          distance={3.0}
          decay={2}
        />
        {/* 碰撞盒 */}
        <mesh visible={false} position={[0, rackH / 2, 0.2]}>
          <boxGeometry args={[rackW + 0.4, rackH + 0.3, 0.9]} />
          <meshBasicMaterial />
        </mesh>
      </group>

      {/* ───────── 矮几（书房居中；摊开卷轴 + 砚台 + 毛笔） ───────── */}
      <group ref={deskRef} position={DESK} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
        {/* 几面 + 四腿（矮，坐地感） */}
        <mesh position={[0, 0.34, 0]} material={woodWarmMat} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.05, 0.66]} />
        </mesh>
        {[[-0.58, -0.26], [0.58, -0.26], [-0.58, 0.26], [0.58, 0.26]].map((p, i) => (
          <mesh key={i} position={[p[0], 0.17, p[1]]} material={woodMat} castShadow>
            <boxGeometry args={[0.06, 0.34, 0.06]} />
          </mesh>
        ))}
        {/* 摊开的卷轴（近看可读的做旧纸） */}
        <mesh position={[-0.02, 0.37, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.72, 0.4]} />
          <meshStandardMaterial map={scrollTex} emissive={"#3a2c18"} emissiveIntensity={0.1} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* 卷起的一端（右侧木轴） */}
        <mesh position={[0.4, 0.4, 0.02]} rotation={[0, 0, Math.PI / 2]} material={woodMat} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.42, 10]} />
        </mesh>
        {/* 砚台（深端石，浅凹） */}
        <mesh position={[0.42, 0.38, -0.18]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.04, 20]} />
          <meshStandardMaterial color={"#20272a"} roughness={0.4} metalness={0.1} />
        </mesh>
        {/* 墨（一小锭） */}
        <mesh position={[0.42, 0.41, -0.18]}>
          <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
          <meshStandardMaterial color={"#0e1210"} roughness={0.3} />
        </mesh>
        {/* 毛笔（斜搁几缘） */}
        <mesh position={[-0.1, 0.4, -0.24]} rotation={[0, 0.4, Math.PI / 2 - 0.15]} material={woodWarmMat} castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.24, 8]} />
        </mesh>
        <mesh position={[-0.02, 0.4, -0.28]} rotation={[0, 0.4, Math.PI / 2 - 0.15]}>
          <coneGeometry args={[0.012, 0.06, 8]} />
          <meshStandardMaterial color={"#1a1410"} roughness={0.7} />
        </mesh>
      </group>

      {/* 矮几上方一盏内容灯（暖、低），把几面浸暖便于阅读（暗角落里也可读——场景 A 教训） */}
      {!low && (
        <pointLight userData={{ ljBake: "content" }} position={[DESK[0], DESK[1] + 1.0, DESK[2] + 0.1]} color={COURT_PALETTE.lampWarm} intensity={1.2} distance={2.6} decay={2} />
      )}
    </group>
  );
}
