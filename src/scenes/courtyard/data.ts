import type { Entry, Vec3, WorldConfig } from "../../config/types";
import type { SceneData } from "../registryData";
import { MOOD_PRESETS } from "../../config/moods";
import { clamp, makeWalk } from "../walkKit";

// ─────────────────────────────────────────────────────────────────────────
// 雾中山居（courtyard）——占位舞台（简单原语，不追求好看；后续轮建成品）。
// 本轮验收点：能进、能走、三个 zone 占位物可聚焦交互、光照能看清、平地 + 门洞示意。
//
// 坐标：平地 y=0。+Z = 入口（出生点朝 -Z）。-Z 后墙留一个门洞（示意山居入口）。
// ─────────────────────────────────────────────────────────────────────────

export const COURT_EYE = 1.6;

const BOUNDS = { x0: -5.7, x1: 5.7, z0: -5.7, z1: 5.7 } as const;
export const COURT = {
  wall: { x0: -6, x1: 6, z0: -6, z1: 6 },
  door: { cx: 0, z: -6, half: 1.0, height: 2.6 }, // 后墙门洞（x∈[-1,1]）
} as const;

const SPOT = {
  bookshelf: [-3.4, 0, -3.0] as Vec3,
  objects: [3.4, 0, -3.0] as Vec3,
  record: [0, 0, 3.0] as Vec3,
};

const walk = makeWalk({
  support: () => 0, // 平地
  clampToFloor: (x, z) => [clamp(x, BOUNDS.x0, BOUNDS.x1), clamp(z, BOUNDS.z0, BOUNDS.z1)],
  colliders: [
    { cx: SPOT.bookshelf[0], cz: SPOT.bookshelf[2], r: 0.62 },
    { cx: SPOT.objects[0], cz: SPOT.objects[2], r: 0.62 },
    { cx: SPOT.record[0], cz: SPOT.record[2], r: 0.55 },
    // 门洞两侧立柱：挡住，从门洞中间可穿过
    { cx: COURT.door.cx - COURT.door.half, cz: COURT.door.z, r: 0.28 },
    { cx: COURT.door.cx + COURT.door.half, cz: COURT.door.z, r: 0.28 },
  ],
});

const GENESIS = 0;

const defaultWorld: WorldConfig = {
  version: "2.0.0",
  owner: { name: "" },
  createdAt: GENESIS,
  updatedAt: GENESIS,
  room: {
    style: "courtyard",
    dimensions: { w: 12, h: 4, d: 12 },
    palette: { base: "#3a4038", accent: "#6aa0b8", floor: "#2a302c" },
    mood: { lighting: "cool", intensity: 1, fog: MOOD_PRESETS.cool.fog },
  },
  zones: [
    { id: "zone-bookshelf", type: "bookshelf", position: SPOT.bookshelf, rotation: [0, Math.PI / 2, 0], label: "山居书案 · 思考与文字" },
    { id: "zone-objects", type: "objects", position: SPOT.objects, rotation: [0, -Math.PI / 2, 0], label: "廊下陈列 · 珍视之物" },
    { id: "zone-record", type: "record", position: SPOT.record, rotation: [0, Math.PI, 0], label: "檐角唱机 · 影音" },
  ],
};

function makeSeed(now: number): Entry[] {
  return [
    { id: "court-seed-t1", zoneId: "zone-bookshelf", type: "thought", title: "山雾漫过门槛（占位，待正式内容）", body: "这里将是雾中山居的思考。占位内容，后续轮替换。", createdAt: now, updatedAt: now },
    { id: "court-seed-o1", zoneId: "zone-objects", type: "object", primitive: "sphere", color: "#8a9a8a", title: "溪边的青石（占位，待正式内容）", body: "占位物件，后续轮替换。", createdAt: now, updatedAt: now },
    { id: "court-seed-r1", zoneId: "zone-record", type: "track", title: "远处的钟（占位，待正式内容）", body: "占位音轨，后续轮替换。", createdAt: now, updatedAt: now },
  ];
}

export const courtyardData: SceneData = {
  style: "courtyard",
  label: "雾中山居",
  tagline: "平地院落，雾锁门洞（占位）",
  defaultWorld,
  makeSeed,
  spawn: { position: [0, 0, 4.8], yaw: 0 },
  eye: COURT_EYE,
  walk,
  zoneAnchors: {
    bookshelf: { position: [-3.4, 1.3, -3.0], ry: Math.PI / 2 },
    objects: { position: [3.4, 1.3, -3.0], ry: -Math.PI / 2 },
    record: { position: [0, 1.2, 3.0], ry: Math.PI },
  },
  focus: {
    bookshelf: { center: [-3.4, 0.8, -3.0], radius: 1.5 },
    objects: { center: [3.4, 0.7, -3.0], radius: 1.2 },
    record: { center: [0, 0.6, 3.0], radius: 1.1 },
  },
};
