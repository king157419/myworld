import { useMemo } from "react";
import * as THREE from "three";
import type { Zone } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { useZoneEntries } from "../../ui/useZoneEntries";
import { useInteractable } from "../../scene/interactables";
import { seededRng } from "../../scene/rng";
import { ATTIC, DESK, EAVE_H, HALF_W, RIDGE_H, Y_ATTIC } from "./data";
import { ATTIC_PALETTE, beamMat, brassMat, paperMat, woodWarmMat } from "./materials";
import { WarmLamp } from "./lamps";

// 书墙 · 思考（zone-bookshelf）：远端山墙上塞满旧书的一整面书架 + 窗前写字台。
// 满分锚点 ref_bookshelf_nook_3：书塞放要有不规则节奏（平摞 / 竖放 / 留空），书脊低饱和杂色。
// 数据驱动：思考越多，点亮的书脊越多、书墙暖光越亮（书脊由思考点亮）。

const WALL_Z = ATTIC.room.z0; // 远端山墙
const ridgeY = Y_ATTIC + RIDGE_H;
const eaveY = Y_ATTIC + EAVE_H;
const BOOK_Z = WALL_Z + 0.2; // 书脊面（在山墙前一点）
const X_LEFT = -2.6; // 书区左界
const X_RIGHT = 0.25; // 书区右界（再往右是窗 + 写字台）

// 山墙内表面在某 x 的高度（三角顶）。
const gableTop = (x: number) => ridgeY - (Math.min(Math.abs(x), HALF_W) / HALF_W) * (RIDGE_H - EAVE_H);

// 做旧书脊配色（低饱和、杂而不闹）。
const BOOK_COLORS = ["#7d3b2e", "#3f5a46", "#6b5630", "#34465f", "#5a3550", "#7a6a45", "#2f3e3a", "#8a6a3a", "#43302a"];

interface Placed {
  m: THREE.Matrix4;
  c: THREE.Color;
}

// 一整面书墙的书：沿几层横板铺陈，逐格不规则节奏。返回 (装饰书, 可点亮候选位).
function buildBooks() {
  const rand = seededRng(4715);
  const boards = [3.25, 3.85, 4.45, 5.05, 5.65]; // 横板 y 位（越高越短，随山墙收窄）
  const decor: Placed[] = [];
  const litSpots: { x: number; y: number }[] = [];
  const aged = new THREE.Color("#241c16");
  const pick = () => new THREE.Color(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]).lerp(aged, 0.2 + rand() * 0.18);

  for (const by of boards) {
    // 该层横板在山墙下能延伸到的 x 右界（保证板上方还有 ~0.34 净高放书）
    const reach = (HALF_W * (ridgeY - (by + 0.34))) / (RIDGE_H - EAVE_H);
    const xL = X_LEFT;
    const xR = Math.min(X_RIGHT, Math.max(X_LEFT + 0.3, reach), reach);
    if (xR <= xL + 0.2) continue;
    let cursor = xL;
    while (cursor < xR - 0.06) {
      const roll = rand();
      if (roll < 0.12) {
        cursor += 0.06 + rand() * 0.12; // 留空
        continue;
      }
      if (roll < 0.22) {
        // 平摞两三本
        const pileW = 0.19 + rand() * 0.06;
        if (cursor + pileW > xR) break;
        const pileN = 2 + (rand() < 0.4 ? 1 : 0);
        let py = by + 0.03;
        for (let p = 0; p < pileN; p++) {
          const th = 0.035 + rand() * 0.02;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(cursor + pileW / 2 + (rand() - 0.5) * 0.02, py + th / 2, BOOK_Z),
            new THREE.Quaternion(),
            new THREE.Vector3(pileW, th, 0.17 + rand() * 0.05),
          );
          decor.push({ m, c: pick() });
          py += th;
        }
        litSpots.push({ x: cursor + pileW / 2, y: py + 0.03 });
        cursor += pileW + 0.02;
        continue;
      }
      // 竖放一本
      const w = 0.07 + rand() * 0.06;
      if (cursor + w > xR) break;
      const maxH = Math.min(0.5, gableTop(cursor) - by - 0.12);
      const h = Math.max(0.22, Math.min(0.24 + rand() * 0.26, maxH));
      const tilt = rand() < 0.12 ? (rand() - 0.5) * 0.28 : 0;
      const depth = 0.17 + rand() * 0.07;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cursor + w / 2, by + h / 2 + 0.02, BOOK_Z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)),
        new THREE.Vector3(w, h, depth),
      );
      decor.push({ m, c: pick() });
      litSpots.push({ x: cursor + w / 2, y: by + h / 2 + 0.02 });
      cursor += w + 0.012;
    }
  }
  return { decor, litSpots };
}

function LetterTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 660;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e9d6a6";
  ctx.fillRect(0, 0, c.width, c.height);
  // 纸的暖色 + 边角轻微做旧
  const g = ctx.createRadialGradient(256, 300, 60, 256, 330, 460);
  g.addColorStop(0, "rgba(255,246,220,0.6)");
  g.addColorStop(1, "rgba(180,150,100,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#3a2a1c";
  ctx.textBaseline = "top";
  const lines = [
    ["28px 'Kaiti','KaiTi',serif", "给三个月后的我：", 56, 60],
    ["22px 'Kaiti','KaiTi',serif", "最近总在想，你那边的这间屋子", 60, 140],
    ["22px 'Kaiti','KaiTi',serif", "长什么样了。书架上多了什么，", 60, 182],
    ["22px 'Kaiti','KaiTi',serif", "唱机在放哪一张。", 60, 224],
    ["22px 'Kaiti','KaiTi',serif", "我这边刚把雨声接进屋里，", 60, 288],
    ["22px 'Kaiti','KaiTi',serif", "还漏着风。", 60, 330],
    ["22px 'Kaiti','KaiTi',serif", "有件事想提醒你别忘了——", 60, 410],
  ];
  for (const [font, text, x, y] of lines as [string, string, number, number][]) {
    ctx.font = font;
    ctx.fillText(text, x, y);
  }
  // 钢笔搁在末行的墨迹收笔
  ctx.strokeStyle = "#2a1e14";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(360, 432);
  ctx.lineTo(392, 436);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function AtticBookshelf({ zone, low = false }: { zone: Zone; low?: boolean }) {
  const focusZone = useWorld((s) => s.focusZone);
  const thoughts = useZoneEntries(zone.id, "thought");
  const shelfRef = useInteractable(zone.id);
  const deskRef = useInteractable(zone.id);

  const { decor, litSpots } = useMemo(() => buildBooks(), []);
  const letterTex = useMemo(() => LetterTexture(), []);
  const spineGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // 点亮的书脊数：思考越多越密（至少 3，至多铺满候选位）。
  const litCount = Math.max(3, Math.min(thoughts.length, litSpots.length));
  const lit = useMemo(() => litSpots.slice(0, litCount), [litSpots, litCount]);

  const decorCb = useMemo(
    () => (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      decor.forEach((b, i) => {
        mesh.setMatrixAt(i, b.m);
        mesh.setColorAt(i, b.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    [decor],
  );

  const litCb = useMemo(
    () => (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      const m = new THREE.Matrix4();
      lit.forEach((s, i) => {
        m.compose(new THREE.Vector3(s.x, s.y, BOOK_Z + 0.03), new THREE.Quaternion(), new THREE.Vector3(0.05, 0.2, 0.16));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    [lit],
  );

  const boards = [3.25, 3.85, 4.45, 5.05, 5.65];
  const lightY = 3.9;

  return (
    <group>
      {/* 书架结构：横板 + 侧框（暗木，靠灯光读出层次） */}
      <group ref={shelfRef} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
        {boards.map((by, i) => {
          const reach = (HALF_W * (ridgeY - (by + 0.02))) / (RIDGE_H - EAVE_H);
          const xR = Math.min(X_RIGHT, reach);
          if (xR <= X_LEFT + 0.2) return null;
          const w = xR - X_LEFT;
          return (
            <mesh key={i} position={[X_LEFT + w / 2, by, WALL_Z + 0.16]} material={woodWarmMat} receiveShadow>
              <boxGeometry args={[w, 0.05, 0.32]} />
            </mesh>
          );
        })}
        {/* 侧框（左立板） */}
        <mesh position={[X_LEFT - 0.03, (Y_ATTIC + eaveY) / 2 + 0.2, WALL_Z + 0.16]} material={beamMat}>
          <boxGeometry args={[0.06, eaveY - Y_ATTIC + 1.6, 0.34]} />
        </mesh>

        {/* 装饰书（一整面，不规则节奏） */}
        <instancedMesh ref={decorCb} args={[spineGeom, undefined, decor.length]} castShadow frustumCulled={false}>
          <meshStandardMaterial roughness={0.82} metalness={0} />
        </instancedMesh>
        {/* 点亮的书脊（思考驱动，暖琥珀自发光） */}
        {lit.length > 0 && (
          <instancedMesh ref={litCb} args={[spineGeom, undefined, lit.length]} frustumCulled={false}>
            <meshStandardMaterial
              color={ATTIC_PALETTE.paperWarm}
              emissive={new THREE.Color(ATTIC_PALETTE.glowAmber)}
              emissiveIntensity={0.5}
              roughness={0.7}
              toneMapped={false}
            />
          </instancedMesh>
        )}

        {/* 书墙暖补光（内容灯：思考越多越亮；短距 → 只洇亮书墙一带，墙角仍暗） */}
        <pointLight
          userData={{ ljBake: "content" }}
          position={[-1.1, lightY, WALL_Z + 1.0]}
          color={ATTIC_PALETTE.lampWarm}
          intensity={1.6 + Math.min(thoughts.length, 12) * 0.28}
          distance={4.6}
          decay={2}
        />
        {/* 大碰撞盒：准心在整面书墙范围内都能命中并聚焦 */}
        <mesh visible={false} position={[(X_LEFT + X_RIGHT) / 2, Y_ATTIC + 1.4, WALL_Z + 0.5]}>
          <boxGeometry args={[X_RIGHT - X_LEFT + 0.4, 3.0, 0.9]} />
          <meshBasicMaterial />
        </mesh>
      </group>

      {/* ───────── 写字台（山墙窗前，属本区的舞台道具）：坐向 -Z 面窗，椅在房间侧 ───────── */}
      <group ref={deskRef} position={DESK} onClick={(e) => { e.stopPropagation(); focusZone(zone.id); }}>
        {/* 台腿 + 台面 */}
        {[[-0.55, -0.28], [0.55, -0.28], [-0.55, 0.28], [0.55, 0.28]].map((p, i) => (
          <mesh key={i} position={[p[0], 0.37, p[1]]} material={beamMat} castShadow>
            <boxGeometry args={[0.07, 0.74, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, 0.76, 0]} material={woodWarmMat} castShadow receiveShadow>
          <boxGeometry args={[1.35, 0.05, 0.72]} />
        </mesh>
        {/* 摊开的未写完的信（近看可读的纹理） */}
        <mesh position={[-0.05, 0.79, 0.06]} rotation={[-Math.PI / 2, 0, 0.05]}>
          <planeGeometry args={[0.42, 0.54]} />
          <meshStandardMaterial map={letterTex} emissive={"#4a3a24"} emissiveIntensity={0.14} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* 钢笔搁在末行 */}
        <mesh position={[0.06, 0.795, 0.02]} rotation={[0, 0.5, Math.PI / 2]} material={brassMat} castShadow>
          <cylinderGeometry args={[0.008, 0.006, 0.16, 8]} />
        </mesh>
        {/* 散落稿纸 */}
        {[[0.44, 0.14, 0.4], [0.38, -0.2, -0.3], [-0.5, 0.18, -0.5]].map((p, i) => (
          <mesh key={i} position={[p[0], 0.785 + i * 0.004, p[1]]} rotation={[-Math.PI / 2, 0, p[2]]} material={paperMat}>
            <planeGeometry args={[0.3, 0.4]} />
          </mesh>
        ))}
        {/* 墨水瓶 */}
        <mesh position={[-0.5, 0.83, -0.16]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.08, 12]} />
          <meshStandardMaterial color={"#141a26"} roughness={0.3} metalness={0.1} />
        </mesh>
        {/* 台灯（本场景唯一投影主灯，暖光只洇亮桌面一圈） */}
        <group position={[0.44, 0.78, -0.18]}>
          <mesh position={[0, 0.16, 0]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.014, 0.02, 0.32, 10]} />
          </mesh>
          <WarmLamp position={[0.03, 0.4, 0.02]} intensity={6.2} distance={3.0} scale={0.62} castShadow={!low} low={low} />
        </group>
        {/* 台脚边一小摞没放回去的书 */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.42, 0.02 + i * 0.045, 0.2 - i * 0.02]} rotation={[0, 0.3 + i * 0.3, 0]} castShadow>
            <boxGeometry args={[0.22 - i * 0.02, 0.042, 0.16]} />
            <meshStandardMaterial color={["#7a4a3a", "#3a4a5c", "#6b5a34"][i]} roughness={0.85} />
          </mesh>
        ))}
        {/* 木椅（示意有人坐过） */}
        <group position={[0, 0, 0.62]}>
          <mesh position={[0, 0.44, 0]} material={woodWarmMat} castShadow>
            <boxGeometry args={[0.44, 0.05, 0.4]} />
          </mesh>
          <mesh position={[0, 0.7, -0.18]} material={woodWarmMat} castShadow>
            <boxGeometry args={[0.44, 0.5, 0.05]} />
          </mesh>
          {[[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]].map((p, i) => (
            <mesh key={i} position={[p[0], 0.22, p[1]]} material={beamMat}>
              <boxGeometry args={[0.05, 0.44, 0.05]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
