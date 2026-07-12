import type { Entry, Vec3, WorldConfig } from "../../config/types";
import type { SceneData } from "../registryData";
import { MOOD_PRESETS } from "../../config/moods";
import { clamp, makeWalk } from "../walkKit";

// ─────────────────────────────────────────────────────────────────────────
// 雨夜阁楼（attic）——占位舞台（几何用简单原语，不追求好看；后续轮建成品）。
// 本轮验收点：能进、能走、三个 zone 占位物可聚焦交互、光照能看清、**两层高差可上下**。
//
// 坐标：Y 向上，前半（z≥0）为下层地面 y=0；后半（z≤ZUP）为上层平台 y=YUP；中间一段坡道连通。
//   +Z = 入口（出生点，朝 -Z 望进阁楼，走上坡到上层书架）。
// ─────────────────────────────────────────────────────────────────────────

export const ATTIC_EYE = 1.6;
export const YUP = 1.35; // 上层平台高度（两层高差示意）

// 可行走矩形（已从可视墙面内缩一个身位，避免贴墙穿模）。
const BOUNDS = { x0: -4.7, x1: 4.7, z0: -5.7, z1: 5.7 } as const;
// 可视墙面 / 平台足迹（Stage 按此画）。
export const ATTIC = {
  wall: { x0: -5, x1: 5, z0: -6, z1: 6 },
  lower: { zNear: 6, zFar: 0 }, // 下层地面 z∈[0,6]
  upper: { zNear: -2.5, zFar: -6 }, // 上层平台 z∈[-6,-2.5]
  ramp: { zLower: 0, zUpper: -2.5, yUpper: YUP }, // 连通坡道 z∈[-2.5,0]
} as const;

/** 阁楼脚下地表高度：下层 0 → 坡道线性 → 上层 YUP，随 z 单调（不瞬移）。 */
export function atticFloorY(z: number): number {
  const { zLower, zUpper, yUpper } = ATTIC.ramp;
  if (z >= zLower) return 0;
  if (z <= zUpper) return yUpper;
  return ((zLower - z) / (zLower - zUpper)) * yUpper;
}

// zone 占位物落点（下层两侧 + 上层书架），PlaceholderZone 据此摆放。
const SPOT = {
  bookshelf: [0, YUP, -5.2] as Vec3, // 上层：走上坡才够到
  objects: [-3.4, 0, 3.0] as Vec3, // 下层左
  record: [3.4, 0, 3.0] as Vec3, // 下层右
};

const walk = makeWalk({
  support: (_x, z) => atticFloorY(z),
  clampToFloor: (x, z) => [clamp(x, BOUNDS.x0, BOUNDS.x1), clamp(z, BOUNDS.z0, BOUNDS.z1)],
  colliders: [
    { cx: SPOT.bookshelf[0], cz: SPOT.bookshelf[2], r: 0.85 },
    { cx: SPOT.objects[0], cz: SPOT.objects[2], r: 0.6 },
    { cx: SPOT.record[0], cz: SPOT.record[2], r: 0.5 },
  ],
});

const GENESIS = 0;

const defaultWorld: WorldConfig = {
  version: "2.0.0",
  owner: { name: "" },
  createdAt: GENESIS,
  updatedAt: GENESIS,
  room: {
    style: "attic",
    dimensions: { w: 10, h: 4, d: 12 },
    palette: { base: "#2a2018", accent: "#c9a05a", floor: "#1a1712" },
    mood: { lighting: "rainy", intensity: 1, fog: MOOD_PRESETS.rainy.fog },
  },
  zones: [
    { id: "zone-bookshelf", type: "bookshelf", position: SPOT.bookshelf, rotation: [0, 0, 0], label: "阁楼书架 · 思考与文字" },
    { id: "zone-objects", type: "objects", position: SPOT.objects, rotation: [0, Math.PI / 2, 0], label: "窗边陈列 · 珍视之物" },
    { id: "zone-record", type: "record", position: SPOT.record, rotation: [0, -Math.PI / 2, 0], label: "角落唱机 · 影音" },
  ],
};

// 占位期最小种子（各 1 条，标题注明占位）。正式印记内容后续轮由主会话提供。
function makeSeed(now: number): Entry[] {
  return [
    { id: "attic-seed-t1", zoneId: "zone-bookshelf", type: "thought", title: "雨点敲在斜屋顶上（占位，待正式内容）", body: "这里将是雨夜阁楼的思考。占位内容，后续轮替换。", createdAt: now, updatedAt: now },
    { id: "attic-seed-o1", zoneId: "zone-objects", type: "object", primitive: "box", color: "#6a5a3a", title: "旧木箱（占位，待正式内容）", body: "占位物件，后续轮替换。", createdAt: now, updatedAt: now },
    { id: "attic-seed-r1", zoneId: "zone-record", type: "track", title: "窗外的雨声（占位，待正式内容）", body: "占位音轨，后续轮替换。", createdAt: now, updatedAt: now },
  ];
}

export const atticData: SceneData = {
  style: "attic",
  label: "雨夜阁楼",
  tagline: "斜顶阁楼，雨敲天窗，两层高差（占位）",
  defaultWorld,
  makeSeed,
  spawn: { position: [0, 0, 4.8], yaw: 0 },
  eye: ATTIC_EYE,
  walk,
  zoneAnchors: {
    bookshelf: { position: [0, YUP + 1.3, -5.2], ry: 0 },
    objects: { position: [-3.4, 1.2, 3.0], ry: Math.PI / 2 },
    record: { position: [3.4, 1.2, 3.0], ry: -Math.PI / 2 },
  },
  focus: {
    bookshelf: { center: [0, YUP + 0.8, -5.0], radius: 1.6 },
    objects: { center: [-3.4, 0.7, 3.0], radius: 1.2 },
    record: { center: [3.4, 0.6, 3.0], radius: 1.1 },
  },
};
