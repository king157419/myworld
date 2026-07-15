// ─────────────────────────────────────────────────────────────────────────
// 主题 + 布局：整个「潮汐图书馆」的"唯一几何真相源"。
//
// 美学：潮汐图书馆 / The Tide Library（见 DECISIONS.md）。
//   一座暖灯的读书回廊，立在一片只有几厘米深、却完美映出整片星空的镜面水上。
//   冷的水与天（午夜蓝 / 银）× 暖的灯与书（琥珀）。脚步在星海倒影上荡开涟漪。
//
// LAYOUT 同时被三处读取：场景渲染（Gallery/Water/...）、漫游碰撞与高度（walk.ts）、
// 相机聚焦点（PlayerControls）。三者读同一份常量 → 几何、碰撞、镜头永不脱节。
//
// 坐标：Y 向上，水面基准 y≈0（你"走在水上"）。
//   +Z = 入水甬道（出生点，朝 -Z 望进回廊）。-Z = 后方抬高的观星台（上层）。
//   ±X = 两侧回廊：-X 书墙（思考），+X 浮岛陈列（物件）。中央＝镜面广场。
// ─────────────────────────────────────────────────────────────────────────

import type { ZoneType } from "./config/types";

export type Vec3 = [number, number, number];

export const PALETTE = {
  // 水与天：冷
  deepWater: "#03040c",
  waterTint: "#0a1430",
  skyZenith: "#02030a",
  skyHorizon: "#152647",
  star: "#e7ecff",
  milky: "#5666a8",
  aurora: "#2fae9e", // 极地青，极克制的水平辉光
  // 灯与书：暖
  lampWarm: "#ffb257",
  lampCore: "#ffe9c2",
  glowAmber: "#ff9b46",
  brass: "#caa15a",
  paperWarm: "#e9d6a6",
  // 材质
  wood: "#241910",
  woodWarm: "#3a2718",
  stone: "#10141f",
  stoneLit: "#1b2333",
} as const;

// 视高 / 出生 ──────────────────────────────────────────────────────────────
export const EYE = 1.6;
export const WATER_Y = 0.0; // 水面基准（潮汐在此上下微动）
export const SPAWN: Vec3 = [0, 0, 6.6]; // 入水甬道，面朝 -Z 望进回廊

// 镜面广场（可行走的水盘）───────────────────────────────────────────────────
export const R_COURT = 8.0; // 可行走半径（站在水上的圆形广场）
export const R_RING = 8.7; // 回廊 / 书墙所在半径（刚好在可行走区外）

// 观星台（上层）：后方 -Z 抬高的平台，木梯连通 ──────────────────────────────
export const DECK_Y = 1.45; // 台面高度
export const DECK = { x0: -3.2, x1: 3.2, zFar: -10.8, zNear: -8.1 } as const; // 台面足迹
export const STEPS = { x0: -2.0, x1: 2.0, zTop: -8.1, zBottom: -6.5 } as const; // 登台坡道足迹：由台面前缘(-8.1,y=DECK_Y)连续降到水面(-6.5,y=0)

// 潮汐（水面缓慢呼吸；也驱动"沉字浮起"）──────────────────────────────────────
export const TIDE_AMP = 0.055; // 水面上下振幅（米）
export const TIDE_PERIOD = 135; // 一个涨落周期（秒）
/** 给定经过时间，返回水面相对基准的高度偏移。 */
export function tideOffset(t: number): number {
  return Math.sin((t / TIDE_PERIOD) * Math.PI * 2) * TIDE_AMP;
}
/** 归一化潮位 0..1（0=最低潮，1=最高潮），驱动沉字透明度等。 */
export function tidePhase(t: number): number {
  return 0.5 + 0.5 * Math.sin((t / TIDE_PERIOD) * Math.PI * 2);
}

// 星空穹顶 ──────────────────────────────────────────────────────────────────
export const DOME_R = 64;
export const STAR_COUNT = 7200;

// 关键陈设点 ────────────────────────────────────────────────────────────────
// 写作台（思考区，立在 -X 书墙前的水上）—— 写下的思考会"沉入水中"。
export const LECTERN: Vec3 = [-4.3, 0, 1.4];
// 中央：一圈低烛 + 一处沉在水底的星座（纯氛围，可不踩）。
export const COURT_CENTER: Vec3 = [0, 0, -0.5];
// 留声机（影音区，在观星台上）—— 空间化音乐声源。
export const GRAMOPHONE: Vec3 = [0, DECK_Y, -9.4];

// 望远镜（观星台上，"看记忆"舞台件——不是三 zone 之一，只读已有 thought 呈现记忆星海）。
// 位置与 walk.ts 的碰撞体同源（DECK.x1-1.0, DECK.zFar+0.9）；朝向略转向广场中心，
// 目镜（星对角，朝资产 +Z）迎向登台来客。资产：物镜朝天偏后，目镜迎人。
export const TELESCOPE: Vec3 = [DECK.x1 - 1.0, DECK_Y, DECK.zFar + 0.9];
export const TELESCOPE_ROT_Y = -0.32; // 略朝广场中心
export const TELESCOPE_TARGET_H = 1.5; // 归一目标高（米）
// 归一+贴地后的局部关键点（由 GLB 原生坐标 × 目标高推得，见 build_telescope.py 头注）：
//   目镜口（相机凑近看记忆的落点）/ 物镜口（看向夜空的方向锚）。
export const TELE_EYEPIECE_LOCAL: Vec3 = [0, 0.67, 0.21];
export const TELE_OBJECTIVE_LOCAL: Vec3 = [0, 1.36, -0.38];
/** 望远镜可交互登记用的哨兵 id（非 zone，不进 world.zones / 数据契约）。 */
export const TELESCOPE_ID = "stage-telescope";

// 功能区锚点（相机聚焦 + 准心热点）。position = 看向的中心，ry = 正面朝向。
// ⚠ 按 zone **type** 索引，不按 id：id 属于用户数据（导入的世界可以改名），
//   锚点描述的是舞台几何（bookshelf 皮肤长在哪），跟着 type 走。id→type 由 world.zones 解析。
//   bookshelf → -X 整面书墙 + 写作台（思考/文字）
//   objects   → +X 浮在水上的发光陈列岛（珍视的物件）
//   record    → 观星台上的留声机（影音）
export const ZONE_ANCHORS: Record<ZoneType, { position: Vec3; ry: number }> = {
  bookshelf: { position: [-6.4, 2.05, -0.5], ry: Math.PI / 2 }, // -X 书墙，正面朝 +X（court）
  objects: { position: [6.3, 1.15, 0.4], ry: -Math.PI / 2 }, // +X 浮岛
  record: { position: [0, DECK_Y + 0.95, -9.0], ry: 0 }, // 观星台留声机，朝 +Z 望向镜面
};

// 聚焦取景：每个功能区的「主体」包围球（中心 + 半径）。PlayerControls 据此用 fov 反算
// 取景距离恰好框住主体，并从玩家当前所在的一侧切入（least-disorienting）——不再以"点击命中
// 点"为中心（命中点落在不可见碰撞盒上、随机飘忽，是之前聚焦像在乱看的根因）。同样按 type 索引。
export const FOCUS: Record<ZoneType, { center: Vec3; radius: number }> = {
  record: { center: [0, 2.02, -9.4], radius: 1.05 }, // 留声机本体（含喇叭）
  bookshelf: { center: [-6.0, 1.95, -0.3], radius: 2.5 }, // -X 书墙一段
  objects: { center: [5.2, 1.05, 0.0], radius: 2.3 }, // +X 浮岛群
};

// 书墙（思考）：沿 -X 一段圆弧排布的高书架。角度区间（绕 Y，0=+X 方向，逆时针）。
export const BOOKWALL = {
  radius: R_RING,
  a0: Math.PI * 0.62, // 起始角
  a1: Math.PI * 1.38, // 结束角（≈ -X 半侧的圆弧）
  height: 4.2,
  shelves: 6,
} as const;

// 浮岛陈列（物件）：+X 一侧水面上若干发光基座（立在水上的小岛）。
// 同时被 Gallery（渲染）与 walk.ts（碰撞）读取 → 看到的岛就是会挡路的岛。
export const PEDESTALS: { pos: Vec3; r: number; h: number }[] = [
  { pos: [5.4, 0, 2.3], r: 0.62, h: 0.9 },
  { pos: [6.3, 0, 0.0], r: 0.66, h: 1.15 },
  { pos: [5.3, 0, -2.2], r: 0.6, h: 0.8 },
  { pos: [3.7, 0, 3.6], r: 0.55, h: 0.7 },
  { pos: [3.9, 0, -3.4], r: 0.55, h: 0.7 },
];
