import { useEffect, useMemo } from "react";
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

// 评审 R12·C2：挂着的立轴原来是空白纸条——个人印记的可视载体必须有墨。
// 用 canvas 2D 把种子条目真的写上去：竖排、大字标题 + 小字批注，楷体栈，纸面黄化斑驳，墨有浓淡（globalAlpha 抖动）。
const KAITI = "'Kaiti SC','KaiTi','STKaiti',serif";
function makeScrollInkTexture(title: string, body: string): THREE.CanvasTexture {
  const W = 180;
  const H = 512; // ≤512² 每幅
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  // 做旧宣纸底 + 暖光晕
  ctx.fillStyle = "#e7d6a9";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.45, H * 0.62);
  g.addColorStop(0, "rgba(255,246,214,0.5)");
  g.addColorStop(1, "rgba(150,120,72,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 黄化斑驳
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 6 + Math.random() * 24;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.04 + Math.random() * 0.08;
    rg.addColorStop(0, `rgba(150,120,70,${a})`);
    rg.addColorStop(1, "rgba(150,120,70,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const ink = "#241a12";
  ctx.fillStyle = ink;
  // 标题：竖排大字，最右一列
  const titleSize = 30;
  const titleX = W - 26;
  let ty = 28;
  for (const ch of Array.from(title).slice(0, 6)) {
    ctx.font = `bold ${titleSize}px ${KAITI}`;
    ctx.globalAlpha = 0.82 + Math.random() * 0.18;
    ctx.fillText(ch, titleX, ty);
    ty += titleSize + 6;
  }
  // 正文批注：小字竖排，自右向左逐列换行；globalAlpha 抖动模拟墨的浓淡枯润
  const bodySize = 15;
  const colStep = bodySize + 6;
  const rowStep = bodySize + 3;
  const topY = 40;
  const botY = H - 26;
  let cx = titleX - 36;
  let cy = topY;
  const text = Array.from(body.replace(/\s+/g, "")).slice(0, 64);
  ctx.font = `${bodySize}px ${KAITI}`;
  for (const ch of text) {
    if (cy > botY) {
      cy = topY;
      cx -= colStep;
      if (cx < 14) break;
    }
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillText(ch, cx, cy);
    cy += rowStep;
  }
  ctx.globalAlpha = 1;
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

  // 挂着的立轴写上对应思考的正文（有墨）；无对应条目的挂轴留白。生成后随数据变化释放旧贴图。
  const inkTextures = useMemo(
    () => Array.from({ length: hung }).map((_, i) => {
      const t = thoughts[i];
      return t ? makeScrollInkTexture(t.title, t.body) : null;
    }),
    [thoughts, hung],
  );
  useEffect(() => () => { for (const tex of inkTextures) tex?.dispose(); }, [inkTextures]);

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

        {/* 挂着的立轴（挂几幅；有墨的立轴＝被写下的思考，纸面微光收敛不像灯管） */}
        {Array.from({ length: hung }).map((_, i) => {
          const x = -rackW / 2 + ((i + 0.5) / hung) * rackW;
          const tex = inkTextures[i];
          const h = 1.0 + (i % 3) * 0.14;
          const col = AGED[i % AGED.length];
          return (
            <group key={i} position={[x, rackH - 0.24 - h / 2, 0.03]}>
              {/* 天杆 + 地轴（木） */}
              <mesh position={[0, h / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMat}><cylinderGeometry args={[0.016, 0.016, 0.34, 6]} /></mesh>
              <mesh position={[0, -h / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMat}><cylinderGeometry args={[0.02, 0.02, 0.36, 6]} /></mesh>
              {/* 画心：有对应思考 → 写上正文的做旧宣纸（emissiveMap 让纸面自发微光而墨迹仍暗）；否则留白 */}
              <mesh>
                <planeGeometry args={[0.28, h]} />
                {tex ? (
                  <meshStandardMaterial map={tex} emissiveMap={tex} emissive={new THREE.Color("#ffd9a0")} emissiveIntensity={0.2} roughness={0.9} side={THREE.DoubleSide} toneMapped={false} />
                ) : (
                  <meshStandardMaterial color={col} roughness={0.9} side={THREE.DoubleSide} />
                )}
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
