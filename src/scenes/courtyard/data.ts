import type { Entry, WorldConfig } from "../../config/types";
import type { SceneData } from "../registryData";
import { clamp, makeWalk } from "../walkKit";
import {
  COURT_EYE,
  courtFloorY,
  DESK,
  FOCUS,
  LAKEROCK,
  PINE,
  POOL,
  SPOT,
  ZONE_ANCHORS,
} from "./theme";

// ─────────────────────────────────────────────────────────────────────────
// 雾中山居（courtyard）—— v1 成品的场景数据（无 THREE 依赖）。
// 几何真相源在 theme.ts；本文件组出行走求解器 + 默认世界 + 种子 + 聚焦锚点。
// 动线：月洞门（+Z 出生点朝 -Z）→ 庭院 → 石阶 → 书房（-Z 抬高）。
// ─────────────────────────────────────────────────────────────────────────

// 可行走矩形（已从可视墙面内收；相邻段刻意小幅重叠 → 石阶处无缝衔接）。
// 东侧竹丛带（x>4.8）不可走；西侧松/湖石/水池以圆柱碰撞挡开。
const WALK_RECTS = [
  { x0: -6.0, x1: 4.8, z0: -2.4, z1: 6.5 }, // 庭院
  { x0: -1.7, x1: 1.7, z0: -2.7, z1: -1.4 }, // 石阶门喉
  { x0: -2.15, x1: 2.15, z0: -7.0, z1: -2.6 }, // 书房台基
] as const;

const walk = makeWalk({
  support: (_x, z) => courtFloorY(z),
  clampToFloor: (x, z) => {
    let best: [number, number] = [x, z];
    let bestD = Infinity;
    for (const r of WALK_RECTS) {
      const cx = clamp(x, r.x0, r.x1);
      const cz = clamp(z, r.z0, r.z1);
      const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (d < bestD) {
        bestD = d;
        best = [cx, cz];
      }
    }
    return best;
  },
  colliders: [
    { cx: POOL.cx, cz: POOL.cz, r: POOL.r + 0.05 }, // 水池（不可涉水）
    { cx: PINE[0], cz: PINE[2], r: 0.5 }, // 松
    { cx: LAKEROCK[0], cz: LAKEROCK[2], r: 0.7 }, // 湖石
    { cx: DESK[0], cz: DESK[2], r: 0.7 }, // 矮几
    { cx: SPOT.bookshelf[0], cz: SPOT.bookshelf[2], r: 0.4 }, // 卷轴架
    { cx: SPOT.objects[0], cz: SPOT.objects[2], r: 0.45 }, // 博古架
    { cx: SPOT.record[0], cz: SPOT.record[2], r: 0.45 }, // 古琴
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
    dimensions: { w: 14, h: 4, d: 15 },
    palette: { base: "#3a413b", accent: "#ffb060", floor: "#2c322f" },
    // 默认心境：细雨（比 loft 雨夜克制）。四心境在 Stage 里消费（雾/光/雨势/纸灯醇度）。
    mood: { lighting: "rainy", intensity: 1, fog: 0.045 },
  },
  zones: [
    { id: "zone-bookshelf", type: "bookshelf", position: SPOT.bookshelf, rotation: [0, Math.PI / 2, 0], label: "书案 · 思考与文字" },
    { id: "zone-objects", type: "objects", position: SPOT.objects, rotation: [0, 0, 0], label: "博古架 · 珍视之物" },
    { id: "zone-record", type: "record", position: SPOT.record, rotation: [0, -Math.PI / 2, 0], label: "古琴 · 琴音" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// 种子内容：印记正式稿·场景 B（6 卷轴 thought + 3 object + 2 track）。
// id / ageDays / 标题 / 正文 一字不改（见 references/imprint/IMPRINT.md 场景 B）。
// ─────────────────────────────────────────────────────────────────────────
const DAY = 86400000;

interface Spec {
  id: string;
  zoneId: string;
  type: Entry["type"];
  title: string;
  body: string;
  primitive?: Entry["primitive"];
  color?: string;
  ageDays: number;
}

const SPECS: Spec[] = [
  // —— 书房卷轴 · 思考（渲染成可点开的卷轴） ——
  { id: "yard-s1", zoneId: "zone-bookshelf", type: "thought", ageDays: 64,
    title: "听雨",
    body: "\"少年听雨歌楼上。而今听雨僧庐下。\"——蒋捷《虞美人》。抄这首的时候在下雨。还没到僧庐的年纪，但已经不在歌楼了。" },
  { id: "yard-s2", zoneId: "zone-bookshelf", type: "thought", ageDays: 50,
    title: "空山",
    body: "\"空山新雨后，天气晚来秋。\"——王维。十个字，一整个院子的湿度。" },
  { id: "yard-s3", zoneId: "zone-bookshelf", type: "thought", ageDays: 38,
    title: "枯荷",
    body: "\"留得枯荷听雨声。\"——李商隐。别人扫掉的东西，他留着听。所谓审美，大概就是舍不得的角度和别人不一样。" },
  { id: "yard-s4", zoneId: "zone-bookshelf", type: "thought", ageDays: 26,
    title: "定风波",
    body: "\"回首向来萧瑟处，归去，也无风雨也无晴。\"——苏轼。做不到。先抄下来。" },
  { id: "yard-s5", zoneId: "zone-bookshelf", type: "thought", ageDays: 14,
    title: "心远",
    body: "\"问君何能尔？心远地自偏。\"——陶渊明。这院子不在山里，在我心里偏出来的一块。" },
  { id: "yard-s6", zoneId: "zone-bookshelf", type: "thought", ageDays: 2,
    title: "痴人",
    body: "\"莫说相公痴，更有痴似相公者。\"——张岱《湖心亭看雪》。深夜做这种没用的东西的人，看到这句会笑。" },

  // —— 书房物件 ——
  { id: "yard-o1", zoneId: "zone-objects", type: "object", ageDays: 46, primitive: "box", color: "#3a3f3d",
    title: "一方端砚",
    body: "磨墨的时候心跳会慢下来。墨条是朋友送的，舍不得磨完——像那瓶香水。原来我在两个世界里是同一种舍不得。" },
  { id: "yard-o2", zoneId: "zone-objects", type: "object", ageDays: 20, primitive: "cylinder", color: "#6f7d74",
    title: "喝剩的凤凰单丛",
    body: "锡罐是武夷山带回来的。开盖那一下的香气比茶本身值钱。" },
  { id: "yard-o3", zoneId: "zone-objects", type: "object", ageDays: 6, primitive: "cylinder", color: "#8c8578",
    title: "小香炉",
    body: "下雨天点一支沉香，屋里的雨就有了味道。" },

  // —— 琴音 ——
  { id: "yard-r1", zoneId: "zone-record", type: "track", ageDays: 33,
    title: "平沙落雁",
    body: "古琴曲里我最先听懂的一首。雁落下来的那一段，忽然明白爵士的即兴和琴的吟猱是一回事：都是让乐器说人话。" },
  { id: "yard-r2", zoneId: "zone-record", type: "track", ageDays: 8,
    title: "雾里的一盏灯",
    body: "不知名的环境乐。灯在雾里晕开的样子是有声音的——就是这张的声音。" },
];

function makeSeed(now: number): Entry[] {
  return SPECS.map((s) => ({
    id: s.id,
    zoneId: s.zoneId,
    type: s.type,
    title: s.title,
    body: s.body,
    primitive: s.primitive,
    color: s.color,
    createdAt: now - s.ageDays * DAY,
    updatedAt: now - s.ageDays * DAY,
  }));
}

export const courtyardData: SceneData = {
  style: "courtyard",
  label: "雾中山居",
  tagline: "月洞门里一庭烟雨，石径通向抬高的书房，纸灯把雾洇暖",
  defaultWorld,
  makeSeed,
  spawn: { position: [0, 0, 6.2], yaw: 0 }, // 月洞门内，面朝 -Z 望向庭院与书房
  eye: COURT_EYE,
  walk,
  zoneAnchors: {
    bookshelf: ZONE_ANCHORS.bookshelf,
    objects: ZONE_ANCHORS.objects,
    record: ZONE_ANCHORS.record,
  },
  focus: {
    bookshelf: FOCUS.bookshelf,
    objects: FOCUS.objects,
    record: FOCUS.record,
  },
};
