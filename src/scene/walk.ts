// ─────────────────────────────────────────────────────────────────────────
// 漫游求解：纯函数，无 THREE / DOM 依赖（可单测）。读 theme.ts 的几何常量，
// 与场景渲染共用同一份 LAYOUT → 走的地方和看的地方永远一致。
//
// 「潮汐图书馆」可行走区是三块的并集：
//   ① 镜面广场：半径 R_COURT 的水盘（y=0，你"走在水上"）。
//   ② 观星台：后方 -Z 抬高的平台（y=DECK_Y）。
//   ③ 登台坡道：连通广场与观星台。**高度是 z 的连续函数（线性坡）**，不是离散台阶。
//
// 关键修复（本轮）：
//   · 离散台阶 → 连续坡道。支撑高度按 z 单调，**绝不会**一帧跳过好几级（之前的"瞬移上去"）。
//   · clamp 改为"最近可行走区"（不再在走出台子边缘时径向投影回水圈 → 那是"空气墙向后瞬移"的根因）。
//   · 加 MAX_STEP_UP 门限：从侧面撞上比脚高很多的坡壁会被挡住（像墙），不再"瞬移上去"。
// ─────────────────────────────────────────────────────────────────────────
import { DECK, DECK_Y, GRAMOPHONE, LECTERN, PEDESTALS, R_COURT, STEPS } from "../theme";

const RADIUS = 0.32; // 玩家身体半径
const MAX_STEP_UP = 0.42; // 单帧最多抬升（> 一级踏步，≪ 多级；> 走坡每帧抬升，故正常上坡不受阻）

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function inCourt(x: number, z: number): boolean {
  return Math.hypot(x, z) <= R_COURT + 1e-3;
}
function inDeck(x: number, z: number): boolean {
  return x >= DECK.x0 && x <= DECK.x1 && z >= DECK.zFar && z <= DECK.zNear;
}
function inSteps(x: number, z: number): boolean {
  return x >= STEPS.x0 && x <= STEPS.x1 && z >= STEPS.zTop && z <= STEPS.zBottom;
}

/**
 * 登台坡道在某 z 处的高度。zBottom(水面,-6.5)=0 → zTop(台前缘,-8.1)=DECK_Y，线性、单调。
 * 单调是"不瞬移"的根本保证：z 每帧只动一点点，高度也只动一点点。
 */
export function rampHeightAt(z: number): number {
  const t = clamp((STEPS.zBottom - z) / (STEPS.zBottom - STEPS.zTop), 0, 1);
  return t * DECK_Y;
}

/**
 * 脚下地表高度。优先级 台面 > 坡道 > 水面（三区在各自足迹内不冲突：坡道底 h≈0 正好接水面）。
 * 不在并集内时返回 currentY（移动求解会先把人夹回可行走区）。
 */
export function supportHeight(x: number, z: number, currentY: number): number {
  if (inDeck(x, z)) return DECK_Y;
  if (inSteps(x, z)) return rampHeightAt(z);
  if (inCourt(x, z)) return 0;
  return Math.max(0, currentY);
}

// 水上浮岛 + 写作台 + 观星台道具：圆柱碰撞（cx, cz, r）。
// 台上道具（留声机/听歌角台灯/望远镜）此前没有碰撞体——一路 W 能从留声机模型正中穿过去，
// 相机进到喇叭腔里看背面剔除的黑色碎片（审计 F2 实拍）。英雄物件必须是实体。
const COLLIDERS: [number, number, number][] = [
  ...PEDESTALS.map((p) => [p.pos[0], p.pos[2], p.r] as [number, number, number]),
  [LECTERN[0], LECTERN[2], 0.5],
  [GRAMOPHONE[0], GRAMOPHONE[2], 0.62], // 留声机（含底座）
  [GRAMOPHONE[0] - 1.4, GRAMOPHONE[2], 0.3], // 听歌角台灯
  [DECK.x1 - 1.0, DECK.zFar + 0.9, 0.42], // 望远镜
];

// 沿障碍滑行（slide），而非径向弹出。把本帧位移分解为"指向圆心(法向)"与"切向"两部分，
// 只剔除指向圆心的那部分 → 贴着障碍顺滑绕行，不反弹。
function slideColliders(fx: number, fz: number, x: number, z: number): [number, number] {
  let nx = x, nz = z;
  for (const [cx, cz, r] of COLLIDERS) {
    const minR = r + RADIUS;
    const dx = nx - cx, dz = nz - cz;
    if (Math.hypot(dx, dz) >= minR) continue; // 未侵入此障碍
    let onx = fx - cx, onz = fz - cz;
    let ol = Math.hypot(onx, onz);
    if (ol < 1e-4) { onx = dx; onz = dz; ol = Math.hypot(dx, dz); }
    if (ol < 1e-4) { onx = 1; onz = 0; ol = 1; }
    onx /= ol; onz /= ol;
    const mvx = nx - fx, mvz = nz - fz;
    const dot = mvx * onx + mvz * onz;
    if (dot < 0) { nx = fx + (mvx - dot * onx); nz = fz + (mvz - dot * onz); }
    const ax = nx - cx, az = nz - cz;
    const ad = Math.hypot(ax, az);
    if (ad < minR) {
      if (ad > 1e-4) { nx = cx + (ax / ad) * minR; nz = cz + (az / ad) * minR; }
      else { nx = cx + onx * minR; nz = cz + onz * minR; }
    }
  }
  return [nx, nz];
}

/**
 * 把期望落点夹进「广场∪坡道∪台面」并集——取**最近的那个区**的夹取结果。
 * 这是修掉"走出台子边缘被瞬移回水圈"的关键：走过台子背沿时，最近区是台面边缘（就停在边上），
 * 而不是把你径向投影到半径 8 的水圈（那会把人猛拉一大段）。
 */
function clampToWalkable(x: number, z: number): [number, number] {
  const cands: [number, number][] = [];
  // 水圈（圆盘）
  const r = Math.hypot(x, z);
  cands.push(r > R_COURT ? [(x / r) * R_COURT, (z / r) * R_COURT] : [x, z]);
  // 台面矩形
  cands.push([clamp(x, DECK.x0, DECK.x1), clamp(z, DECK.zFar, DECK.zNear)]);
  // 坡道矩形
  cands.push([clamp(x, STEPS.x0, STEPS.x1), clamp(z, STEPS.zTop, STEPS.zBottom)]);
  let best = cands[0], bd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c[0] - x, c[1] - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export interface Resolved {
  x: number;
  z: number;
  y: number; // 地表高度（脚），相机视高另加 EYE
}

/**
 * 单次尝试：夹回可行走区 → 沿障碍滑行 → 再夹一次 → 求脚下高度。
 * ok = 相对**起点地面**的抬升不超过 MAX_STEP_UP（撞上太高的坡壁=false，像墙挡住）。
 * 注意比的是 from 的**地面高度**而非 prevY(相机视高/已阻尼)——否则跑步上坡时视高滞后会被误判为撞墙。
 */
function attempt(prevY: number, fromX: number, fromZ: number, tx: number, tz: number) {
  let [x, z] = clampToWalkable(tx, tz);
  [x, z] = slideColliders(fromX, fromZ, x, z);
  [x, z] = clampToWalkable(x, z);
  const y = supportHeight(x, z, prevY);
  const fromY = supportHeight(fromX, fromZ, prevY);
  return { x, z, y, ok: y - fromY <= MAX_STEP_UP };
}

/**
 * 给定上一帧位置(from)与本帧期望水平位置(want)，返回合法落点与脚下高度。
 * 若整步会撞上过高的坡壁（MAX_STEP_UP），改为轴分离滑行（沿墙走），都不行才原地停。
 */
export function resolveMove(prevY: number, fromX: number, fromZ: number, wantX: number, wantZ: number): Resolved {
  const full = attempt(prevY, fromX, fromZ, wantX, wantZ);
  if (full.ok) return { x: full.x, z: full.z, y: full.y };

  // 撞上太高的坡壁 → 试只动 X / 只动 Z（沿墙滑行），取可行且更接近目标者。
  const xOnly = attempt(prevY, fromX, fromZ, wantX, fromZ);
  const zOnly = attempt(prevY, fromX, fromZ, fromX, wantZ);
  const dist = (a: { x: number; z: number }) => Math.hypot(wantX - a.x, wantZ - a.z);
  const ok = [xOnly, zOnly].filter((a) => a.ok).sort((a, b) => dist(a) - dist(b));
  if (ok.length) return { x: ok[0].x, z: ok[0].z, y: ok[0].y };

  // 全被挡：原地（高度按当前位置求）。
  return { x: fromX, z: fromZ, y: supportHeight(fromX, fromZ, prevY) };
}
