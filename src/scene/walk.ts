// ─────────────────────────────────────────────────────────────────────────
// 漫游求解：纯函数，无 THREE / DOM 依赖（可单测）。读 theme.ts 的几何常量，
// 与场景渲染共用同一份 LAYOUT → 走的地方和看的地方永远一致。
//
// 「潮汐图书馆」可行走区是三块的并集：
//   ① 镜面广场：半径 R_COURT 的水盘（y=0，你"走在水上"）。
//   ② 观星台：后方 -Z 抬高的平台（y=DECK_Y）。
//   ③ 木梯：连通广场与观星台（逐级抬升）。
// 支撑高度按当前 y 在同一 xz 上区分"站在水面"还是"站在观星台"。
// ─────────────────────────────────────────────────────────────────────────
import { DECK, DECK_Y, LECTERN, PEDESTALS, R_COURT, STEPS, STEP_RISE, STEP_RUN } from "../theme";

const STEP_TOL = STEP_RISE + 0.14;
const RADIUS = 0.32; // 玩家身体半径

function inCourt(x: number, z: number): boolean {
  return Math.hypot(x, z) <= R_COURT + 1e-3;
}
function inDeck(x: number, z: number): boolean {
  return x >= DECK.x0 && x <= DECK.x1 && z >= DECK.zFar && z <= DECK.zNear;
}
function inSteps(x: number, z: number): boolean {
  return x >= STEPS.x0 && x <= STEPS.x1 && z >= STEPS.zTop && z <= STEPS.zBottom;
}
/** 木梯在某 z 处的踏面高度（zBottom 处最低，zTop 处接近 DECK_Y）。 */
function stepHeightAt(z: number): number {
  const i = Math.min(STEPS.count - 1, Math.max(0, Math.floor((STEPS.zBottom - z) / STEP_RUN)));
  return (i + 1) * STEP_RISE;
}

/** 脚下地表高度。currentY 用于在同一 xz 上区分"站水面"还是"站观星台"。 */
export function supportHeight(x: number, z: number, currentY: number): number {
  const cands: number[] = [];
  if (inCourt(x, z)) cands.push(0);
  if (inDeck(x, z)) cands.push(DECK_Y);
  if (inSteps(x, z)) cands.push(stepHeightAt(z));
  if (cands.length === 0) return Math.max(0, currentY); // 兜底：保持高度（移动会先把人夹回可行走区）
  let best = -Infinity;
  for (const h of cands) if (h <= currentY + STEP_TOL && h > best) best = h;
  if (best === -Infinity) best = Math.min(...cands); // 全都高于容差（不该发生）→ 取最低
  return best;
}

// 水上浮岛 + 写作台：圆柱碰撞（cx, cz, r）。
const COLLIDERS: [number, number, number][] = [
  ...PEDESTALS.map((p) => [p.pos[0], p.pos[2], p.r] as [number, number, number]),
  [LECTERN[0], LECTERN[2], 0.5],
];

// 沿障碍滑行（slide），而非径向弹出。弹出会在斜向擦碰时把人沿反方向"弹回来"
// （实测复现：擦着浮岛走，切向位移会突然反向）。这里把本帧位移分解为"指向圆心(法向)"
// 与"切向"两部分，只剔除指向圆心的那部分 → 贴着障碍顺滑绕行，不反弹。
function slideColliders(fx: number, fz: number, x: number, z: number): [number, number] {
  let nx = x, nz = z;
  for (const [cx, cz, r] of COLLIDERS) {
    const minR = r + RADIUS;
    const dx = nx - cx, dz = nz - cz;
    if (Math.hypot(dx, dz) >= minR) continue; // 未侵入此障碍
    // 接触法向取"来向一侧"（from 相对圆心），比从侵入点径向弹出更稳、不反弹
    let onx = fx - cx, onz = fz - cz;
    let ol = Math.hypot(onx, onz);
    if (ol < 1e-4) { onx = dx; onz = dz; ol = Math.hypot(dx, dz); } // from 在圆心：退用目标方向
    if (ol < 1e-4) { onx = 1; onz = 0; ol = 1; } // 全在圆心：任取一方向
    onx /= ol; onz /= ol;
    const mvx = nx - fx, mvz = nz - fz; // 本帧位移
    const dot = mvx * onx + mvz * onz;
    if (dot < 0) { // 朝障碍里走：剔除法向分量，只留切向（滑行）
      nx = fx + (mvx - dot * onx);
      nz = fz + (mvz - dot * onz);
    }
    // 滑完仍在体内（贴着面切向走）：径向顶到表面
    const ax = nx - cx, az = nz - cz;
    const ad = Math.hypot(ax, az);
    if (ad < minR) {
      if (ad > 1e-4) { nx = cx + (ax / ad) * minR; nz = cz + (az / ad) * minR; }
      else { nx = cx + onx * minR; nz = cz + onz * minR; }
    }
  }
  return [nx, nz];
}

export interface Resolved {
  x: number;
  z: number;
  y: number; // 地表高度（脚），相机视高另加 EYE
}

/** 把期望落点夹进「广场∪木梯∪观星台」的并集。 */
function clampToWalkable(x: number, z: number): [number, number] {
  if (inDeck(x, z)) {
    return [Math.max(DECK.x0, Math.min(DECK.x1, x)), Math.max(DECK.zFar, Math.min(DECK.zNear, z))];
  }
  if (inSteps(x, z)) {
    return [Math.max(STEPS.x0, Math.min(STEPS.x1, x)), Math.max(STEPS.zTop, Math.min(STEPS.zBottom, z))];
  }
  // 广场：夹回半径内
  const r = Math.hypot(x, z);
  if (r > R_COURT) return [(x / r) * R_COURT, (z / r) * R_COURT];
  return [x, z];
}

/**
 * 给定上一帧位置(from)与本帧期望水平位置(want)，返回合法落点与脚下高度。
 * from 用于沿障碍滑行（不传则退化为原地求解：from=want）。
 */
export function resolveMove(prevY: number, fromX: number, fromZ: number, wantX: number, wantZ: number): Resolved {
  let [x, z] = clampToWalkable(wantX, wantZ);
  [x, z] = slideColliders(fromX, fromZ, x, z);
  [x, z] = clampToWalkable(x, z); // 滑行后可能越界，再夹一次
  return { x, z, y: supportHeight(x, z, prevY) };
}
