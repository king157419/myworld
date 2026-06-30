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

function pushOut(x: number, z: number): [number, number] {
  let nx = x, nz = z;
  for (const [cx, cz, r] of COLLIDERS) {
    const dx = nx - cx, dz = nz - cz;
    const d = Math.hypot(dx, dz);
    const min = r + RADIUS;
    if (d < min) {
      if (d > 1e-4) {
        nx = cx + (dx / d) * min;
        nz = cz + (dz / d) * min;
      } else {
        // 正好落在圆心（dx=dz=0）：任取一方向推出，避免卡死在岛心
        nx = cx + min;
        nz = cz;
      }
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

/** 给定上一帧位置与本帧期望水平位置，返回合法落点与脚下高度。 */
export function resolveMove(prevY: number, wantX: number, wantZ: number): Resolved {
  let [x, z] = clampToWalkable(wantX, wantZ);
  [x, z] = pushOut(x, z);
  [x, z] = clampToWalkable(x, z); // push 后可能越界，再夹一次
  return { x, z, y: supportHeight(x, z, prevY) };
}
