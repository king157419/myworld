import type { Vec3 } from "../../config/types";

// ─────────────────────────────────────────────────────────────────────────
// 雾中山居（courtyard）—— v1 成品舞台的「唯一几何真相源」。
// 同时被三处读取：Stage/组件渲染、漫游碰撞与高度（walk）、相机聚焦点（PlayerControls）。
// 三者读同一份常量 → 几何、碰撞、镜头永不脱节（对齐 attic 的 data.ts / loft 的 theme.ts）。
//
// 动线：月洞门（+Z 院门，出生点朝 -Z）→ 庭院（约 14×9）→ 石阶抬升 → 书房（-Z，抬高一层）。
// 坐标：Y 向上，庭院地面 y=0。+Z = 院门 / 出生点。-Z = 抬高的书房。
//   ±X = 两厢：+X（东）竹丛、-X（西）松 + 湖石 + 浅水池。远山在围墙之外四围渐隐。
// ─────────────────────────────────────────────────────────────────────────

export const COURT_EYE = 1.6;

/** 书房地面抬高（庭院 y=0 → 书房 y=Y_STUDY，石阶三级）。 */
export const Y_STUDY = 0.55;

/** 围墙 / 院门。 */
export const WALL = {
  x: 7.0, // 东西围墙 |x|
  zGate: 7.0, // 南面院墙（月洞门所在，+Z）
  height: 2.75,
  thick: 0.22,
} as const;

/** 月洞门（南墙，圆形门洞，居中 x=0）。 */
export const GATE = {
  z: WALL.zGate,
  cy: 1.35, // 圆心离地
  r: 1.25, // 洞半径
} as const;

/** 庭院可视地面（石板铺地）。 */
export const YARD = {
  x0: -WALL.x,
  x1: WALL.x,
  z0: -3.0, // 书房台基前缘（庭院 -Z 界）
  z1: WALL.zGate, // 院门（+Z）
} as const;

/** 石阶：庭院 y=0（近 +Z）→ 书房台基 y=Y_STUDY（远 -Z），连续线性坡。 */
export const STEP = { zBot: -1.6, zTop: -2.6 } as const;

/** 书房（抬高台基上的小屋 + 前廊）。内墙足迹；前廊敞口朝 +Z（庭院）。 */
export const STUDY = {
  x0: -2.5,
  x1: 2.5,
  zBack: -7.2, // 后墙（-Z）
  zFront: -3.0, // 前檐柱线（廊）
  zRoom: -3.2, // 室内前墙（矮几区起点）
  wallH: 2.35, // 室内净高
} as const;

/** 书房脚下地表高度：庭院 0 → 石阶线性 → 书房台基 Y_STUDY，随 z 单调。 */
export function courtFloorY(z: number): number {
  const { zBot, zTop } = STEP;
  if (z >= zBot) return 0;
  if (z <= zTop) return Y_STUDY;
  return ((zBot - z) / (zBot - zTop)) * Y_STUDY;
}

/** 浅水池（西侧，深墨绿静水；圆形近似）。 */
export const POOL = { cx: -3.5, cz: 2.4, r: 2.0, y: 0.02 } as const;

/** 松 + 湖石（西侧，池畔）。 */
export const PINE: Vec3 = [-4.9, 0, -0.5];
export const LAKEROCK: Vec3 = [-2.4, 0, 4.0];

/** 竹丛（东墙，InstancedMesh 剪影）。 */
export const BAMBOO = { x0: 4.9, x1: 6.5, z0: -2.4, z1: 6.4 } as const;

// zone 舞台落点（书房内；y=Y_STUDY）。皮肤：bookshelf=卷轴架、objects=博古架、record=古琴。
export const SPOT = {
  bookshelf: [-2.35, Y_STUDY, -5.5] as Vec3, // 西内墙：卷轴架
  objects: [1.3, Y_STUDY, -6.9] as Vec3, // 后内墙：博古架
  record: [2.25, Y_STUDY, -5.0] as Vec3, // 东内墙：古琴
};
/** 矮几（书房居中，摊开卷轴 + 砚台 + 毛笔）；属 zone-bookshelf 的舞台道具。 */
export const DESK: Vec3 = [0, Y_STUDY, -4.35];

// 相机聚焦锚点（按 zone.type；position=看向中心，ry=正面朝向）。y 用绝对世界坐标（含台基层高）。
export const ZONE_ANCHORS: Record<string, { position: Vec3; ry: number }> = {
  bookshelf: { position: [-2.05, Y_STUDY + 1.15, -5.5], ry: Math.PI / 2 },
  objects: { position: [1.3, Y_STUDY + 0.95, -6.7], ry: 0 },
  record: { position: [2.0, Y_STUDY + 0.7, -5.0], ry: -Math.PI / 2 },
};
export const FOCUS: Record<string, { center: Vec3; radius: number }> = {
  bookshelf: { center: [-2.4, Y_STUDY + 1.0, -5.5], radius: 1.7 },
  objects: { center: [1.3, Y_STUDY + 0.82, -6.95], radius: 1.25 },
  record: { center: [2.35, Y_STUDY + 0.58, -5.0], radius: 1.05 },
};
