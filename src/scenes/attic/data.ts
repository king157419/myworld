import type { Entry, Vec3, WorldConfig } from "../../config/types";
import type { SceneData } from "../registryData";
import { clamp, makeWalk } from "../walkKit";

// ─────────────────────────────────────────────────────────────────────────
// 雨夜阁楼（attic）—— v1 成品舞台的「唯一几何真相源」。
// LAYOUT 同时被三处读取：Stage/组件渲染、漫游碰撞与高度（walk）、相机聚焦点（PlayerControls）。
// 三者读同一份常量 → 几何、碰撞、镜头永不脱节（对齐 loft 的 theme.ts 做法）。
//
// 动线：门厅（y=0）→ 木楼梯（连续线性坡）→ 阁楼主间（y=Y_ATTIC）。
// 坐标：Y 向上。+Z = 前门 / 出生点（朝 -Z 望进屋，走上楼梯到阁楼）。
//   门厅在最前（z 最大），楼梯居中抬升，阁楼在最后（z 最负）且抬高一整层——
//   像依坡而建的老宅，越往里越高，无地面开洞、坡沿 z 单调（不瞬移）。
// ─────────────────────────────────────────────────────────────────────────

export const ATTIC_EYE = 1.6;
export const Y_ATTIC = 3.0; // 阁楼地面高度（相对门厅 y=0，即整整一层楼）

// 双坡屋顶（人字形）：屋脊沿 Z 走、居中 x=0，向 ±X 两檐落下。
export const RIDGE_H = 3.3; // 屋脊离阁楼地面高度（y = Y_ATTIC + RIDGE_H = 6.3）
export const EAVE_H = 1.3; // 檐口离阁楼地面高度（低檐，人站不直——不可走）
export const HALF_W = 3.0; // 阁楼半宽（x ∈ [-3, 3]，山墙在 ±Z 两端）

// 三段房间的「可视足迹」（Shell 按此画墙/地/顶）。
export const ATTIC = {
  entry: { x0: -2.5, x1: 2.5, z0: 2.2, z1: 6.2, door: { half: 0.95, top: 2.35 } }, // 门厅 5×4
  stair: { x0: -1.25, x1: 1.25, zBot: 2.2, zTop: -2.6 }, // 楼梯井（zBot 门厅侧 y=0，zTop 阁楼侧 y=Y_ATTIC）
  room: { x0: -HALF_W, x1: HALF_W, z0: -11.4, z1: -2.6 }, // 阁楼主间 6×8.8
} as const;

/** 阁楼脚下地表高度：门厅 0 → 楼梯线性 → 阁楼 Y_ATTIC，随 z 单调。 */
export function atticFloorY(z: number): number {
  const { zBot, zTop } = ATTIC.stair;
  if (z >= zBot) return 0;
  if (z <= zTop) return Y_ATTIC;
  return ((zBot - z) / (zBot - zTop)) * Y_ATTIC;
}

// 可行走矩形（已从可视墙面内收一个身位；相邻段刻意小幅重叠 → 无缝衔接、不卡门槛）。
// 阁楼可行走 x 收到 ±2.0：|x|>2 处屋顶已低到直不起腰（低檐区不可走）。
// 阁楼入口另设「门喉」窄段（±1.2）对齐近端山墙门洞——否则贴着门口侧墙会穿模。
const WALK_RECTS = [
  { x0: -2.3, x1: 2.3, z0: 2.2, z1: 5.9 }, // 门厅
  { x0: -1.05, x1: 1.05, z0: -2.8, z1: 2.4 }, // 楼梯井（走廊宽）
  { x0: -1.2, x1: 1.2, z0: -3.4, z1: -2.6 }, // 阁楼入口门喉（对齐山墙门洞 ±1.3）
  { x0: -2.0, x1: 2.0, z0: -11.1, z1: -3.3 }, // 阁楼主间中央（低檐外收）
] as const;

// zone 落点（书墙在远端山墙；黑胶角在 -X 檐下；陈列在 +X 檐下）。
export const SPOT = {
  bookshelf: [0, Y_ATTIC, ATTIC.room.z0] as Vec3, // 远端山墙整面
  record: [-2.62, Y_ATTIC, -6.0] as Vec3, // -X 低檐
  objects: [2.62, Y_ATTIC, -6.0] as Vec3, // +X 低檐
};
// 写字台：远端山墙窗前，偏 +X 一侧（让出正中approach 书墙的通道）。属 zone-bookshelf 的舞台道具。
export const DESK: Vec3 = [1.05, Y_ATTIC, -10.35];

const walk = makeWalk({
  support: (_x, z) => atticFloorY(z),
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
    { cx: DESK[0], cz: DESK[2], r: 0.62 }, // 写字台
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
    dimensions: { w: 6, h: 6, d: 18 },
    palette: { base: "#241a12", accent: "#ffb257", floor: "#1a130d" },
    // 雨夜阁楼默认心境：雨。四心境切换在 Stage 里消费（暖灯醇度 / 窗外冷度 / 雨势）。
    mood: { lighting: "rainy", intensity: 1, fog: 0.02 },
  },
  zones: [
    { id: "zone-bookshelf", type: "bookshelf", position: SPOT.bookshelf, rotation: [0, 0, 0], label: "书架 · 思考" },
    { id: "zone-objects", type: "objects", position: SPOT.objects, rotation: [0, -Math.PI / 2, 0], label: "檐下陈列 · 珍视之物" },
    { id: "zone-record", type: "record", position: SPOT.record, rotation: [0, Math.PI / 2, 0], label: "黑胶角 · 影音" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// 种子内容：印记正式稿·场景 A（12 thought + 5 object + 2 track）。
// id / ageDays / 标题 / 正文 一字不改（见 references/imprint/IMPRINT.md）。
// 落盘后即普通 Entry，用户可增删改；删光不再生（仅世界从未保存过时注入一次）。
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
  // —— 书架 · 思考 ——
  { id: "attic-t1", zoneId: "zone-bookshelf", type: "thought", ageDays: 68,
    title: "做东西的人先得住进去",
    body: "功能列表是给评委看的。我想做的东西，是我自己愿意在里面待到后半夜的那种。如果我自己都不想进去，加多少功能都是空房子。" },
  { id: "attic-t2", zoneId: "zone-bookshelf", type: "thought", ageDays: 55,
    title: "AI 能替我做什么",
    body: "它能替我搬砖，替我把想法铺成代码，快得吓人。但\"我到底想要什么\"这件事，它替不了。我试过把这个问题也丢给它，得到的答案很漂亮，却不是我的。想清楚，还是得自己来。" },
  { id: "attic-t3", zoneId: "zone-bookshelf", type: "thought", ageDays: 49,
    title: "把内心做成房子的念头",
    body: "这个念头最早是雨天冒出来的：如果心里的东西都有地方放——想法上架，旧物进柜，歌放在唱机上——那\"我\"就不只是一团情绪，而是一个可以推门进去打扫、也可以邀人来坐的地方。" },
  { id: "attic-t4", zoneId: "zone-bookshelf", type: "thought", ageDays: 41,
    title: "雨天为什么好",
    body: "雨把外面的世界调成静音，把里面的调大。窗上的水痕往下爬的速度，正好是我想事情的速度。" },
  { id: "attic-t5", zoneId: "zone-bookshelf", type: "thought", ageDays: 36,
    title: "第七级楼梯",
    body: "上阁楼的楼梯第七级会响。我没修。晚上上来的时候它响一声，像这房子在说：知道了，你回来了。" },
  { id: "attic-t6", zoneId: "zone-bookshelf", type: "thought", ageDays: 29,
    title: "关于生长",
    body: "我着迷的不是\"完成\"，是\"长着\"。一个笔记本用到一半和崭新时不一样。我希望我做的东西也这样——三个月后回来，它认得我，我也认得它变了。" },
  { id: "attic-t7", zoneId: "zone-bookshelf", type: "thought", ageDays: 24,
    title: "B 面第二首",
    body: "唱片比播放列表好的地方：你得起身、翻面、放针。B 面第二首常常是被埋没的那首好歌——流媒体时代没有 B 面，也就没有这种被迫的耐心。" },
  { id: "attic-t8", zoneId: "zone-bookshelf", type: "thought", ageDays: 17,
    title: "钢琴退步了",
    body: "今天弹了会儿琴，左手明显生了。奇怪的是并不难过。手指会忘，谱子不会。有些东西只要还放在够得着的地方，就不算失去。" },
  { id: "attic-t9", zoneId: "zone-bookshelf", type: "thought", ageDays: 13,
    title: "香气是时间机器",
    body: "闻到雪松混一点烟草味，就回到某个冬天的自习室。香水瓶里装的不是气味，是坐标。" },
  { id: "attic-t10", zoneId: "zone-bookshelf", type: "thought", ageDays: 9,
    title: "想清楚再动手",
    body: "急着动手的时候，往往是因为不敢再想下去了。想清楚很疼，但只疼一次；没想清楚，会一直疼。" },
  { id: "attic-t11", zoneId: "zone-bookshelf", type: "thought", ageDays: 4,
    title: "关于\"灵魂\"这个词",
    body: "说\"作品要有灵魂\"听起来玄。其实很具体：就是你能从一百个相似的东西里认出它，像在人群里认出一个背影。细节不是装饰，是指纹。" },
  { id: "attic-t12", zoneId: "zone-bookshelf", type: "thought", ageDays: 1,
    title: "爵士与容错",
    body: "喜欢爵士是因为它把错音变成转调。写代码写砸的那天听 Bill Evans 会好受些——原来高手也是一边错一边把错弹成自己的。" },

  // —— 檐下陈列 · 珍视之物 ——
  { id: "attic-o1", zoneId: "zone-objects", type: "object", ageDays: 72, primitive: "box", color: "#2b2b30",
    title: "陪了六年的耳机",
    body: "皮已经起皮，海绵换过两次。用它听过的歌比和任何人说过的话都多。左耳有一点偏松——是我总单手摘它的习惯磨的。它认得我的头型。" },
  { id: "attic-o2", zoneId: "zone-objects", type: "object", ageDays: 58, primitive: "box", color: "#e8e2d4",
    title: "翻散架的琴谱",
    body: "一本《哥德堡变奏曲》，第 13 变奏那页有咖啡渍。买它的时候野心很大，六年只练到第五变奏。没关系，它等得起。" },
  { id: "attic-o3", zoneId: "zone-objects", type: "object", ageDays: 44, primitive: "cylinder", color: "#8a6f4d",
    title: "剩三分之一的香水",
    body: "雪松调。舍不得用完，于是重要的日子才喷——结果它反过来定义了哪些日子重要。" },
  { id: "attic-o4", zoneId: "zone-objects", type: "object", ageDays: 27, primitive: "box", color: "#5a4a3a",
    title: "边角磨圆的诗选",
    body: "李商隐。\"留得枯荷听雨声\"那页折了角——折角的时候我大概十六岁，现在依然觉得他说得对。" },
  { id: "attic-o5", zoneId: "zone-objects", type: "object", ageDays: 11, primitive: "box", color: "#ded6c2",
    title: "2019 年的票根",
    body: "那晚的萨克斯手即兴了十二分钟，全场没人看手机。票根上的字快磨没了，那十二分钟没有。" },

  // —— 黑胶角 · 影音 ——
  { id: "attic-r1", zoneId: "zone-record", type: "track", ageDays: 31,
    title: "雨夜循环的那张",
    body: "封套磨白了的钢琴三重奏。雨天写东西只放它——不是因为最好听，是因为它不打扰。好的背景乐像好的朋友：在，但不缠人。" },
  { id: "attic-r2", zoneId: "zone-record", type: "track", ageDays: 7,
    title: "凌晨的电台",
    body: "大学时熬夜听的 lo-fi 电台，现在自己攒了一份。鼓点上的灰是故意的——太干净的声音留不住人。" },
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

export const atticData: SceneData = {
  style: "attic",
  label: "雨夜阁楼",
  tagline: "斜顶阁楼，雨敲天窗，一盏暖灯洇开半张桌面",
  defaultWorld,
  makeSeed,
  spawn: { position: [0, 0, 5.1], yaw: 0 }, // 门厅，面朝 -Z 望向楼梯
  eye: ATTIC_EYE,
  walk,
  // 相机聚焦锚点（按 zone.type；position=看向中心，ry=正面朝向）。y 用绝对世界坐标（含阁楼层高）。
  zoneAnchors: {
    bookshelf: { position: [-1.1, Y_ATTIC + 1.5, -9.2], ry: 0 }, // 远端山墙书墙，朝 -Z
    objects: { position: [1.9, Y_ATTIC + 1.1, -6.0], ry: -Math.PI / 2 }, // +X 檐下
    record: { position: [-1.9, Y_ATTIC + 1.0, -6.0], ry: Math.PI / 2 }, // -X 檐下
  },
  focus: {
    bookshelf: { center: [-1.1, Y_ATTIC + 1.3, -10.7], radius: 2.5 },
    objects: { center: [2.5, Y_ATTIC + 0.75, -6.0], radius: 1.25 },
    record: { center: [-2.5, Y_ATTIC + 0.62, -6.0], radius: 1.15 },
  },
};
