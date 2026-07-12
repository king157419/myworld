// ─────────────────────────────────────────────────────────────────────────
// 核心契约 / Core contract.
//
// 不可动原则（来自 PRD §2.1）：整个世界由数据完整描述，渲染层只读这份数据。
// The world is fully described by data; the renderer only *reads* it.
//
// 持久化时把"结构"(WorldConfig) 与"内容"(Entry[]) 分开：内容是高频追加项。
// 一份 SavedWorld 就是某一时刻世界的完整快照——导出它即可在别处完整重建。
// ─────────────────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];

// 联合类型一律由 const 数组派生：io.ts 校验直接复用同一份数组，加一个成员只改这一处。

/**
 * 房间风格 = 场景选择器（每个 style 是一个独立世界 / 一座可走进去的场景）。
 *   loft      = 潮汐图书馆（历史名保持；旧存档的 style 就是 loft，零迁移）
 *   attic     = 雨夜阁楼（占位舞台，后续轮建成品）
 *   courtyard = 雾中山居（占位舞台，后续轮建成品）
 *   study     = 预留，未接场景
 * io.ts 的守门与此同源：数组放宽一个成员，导入校验自动跟随。
 */
export const ROOM_STYLES = ["loft", "attic", "courtyard", "study"] as const;
export type RoomStyle = (typeof ROOM_STYLES)[number];

/** 心境：驱动光照 / 天气 / 配色。MVP 由用户手选，后期可由 AI / 内容聚合推导。 */
export const MOODS = ["warm", "cool", "neutral", "rainy"] as const;
export type Mood = (typeof MOODS)[number];

export interface Room {
  style: RoomStyle;
  dimensions: { w: number; h: number; d: number };
  /** 十六进制颜色字符串，如 "#caa472"。 */
  palette: { base: string; accent: string; floor: string };
  mood: { lighting: Mood; intensity: number; fog: number };
}

/** MVP 三个功能区。 */
export const ZONE_TYPES = ["bookshelf", "objects", "record"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export interface Zone {
  id: string;
  type: ZoneType;
  /** 区在房间内的位置。相机飞入时据此 + rotation 计算"正面"。 */
  position: Vec3;
  /** 绕 Y 轴的朝向（弧度）。默认 0 = 正面朝向初始相机（+Z）。 */
  rotation?: Vec3;
  label: string;
}

export const ENTRY_TYPES = ["thought", "object", "track", "person"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const PRIMITIVES = ["box", "cylinder", "sphere"] as const;
export type Primitive = (typeof PRIMITIVES)[number];

/**
 * 一条内容。所有"用户投入"都是 Entry：思考、物件、音轨……
 * createdAt 是"生长"与"时间旅行"的基础——每条内容都活在时间轴上。
 */
export interface Entry {
  id: string;
  zoneId: string;
  type: EntryType;
  title: string;
  /** 思考正文 / 物件描述 / 音轨说明 / 人物小传。 */
  body: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  mood?: Mood;
  // 类型特有的可选字段：
  primitive?: Primitive; // object：用代码生成的几何体
  color?: string; // object：几何体颜色
  modelUrl?: string; // object：可选 GLB（MVP 不用，预留）
  audioUrl?: string; // track：音频地址
}

export interface WorldConfig {
  version: string;
  owner: { name?: string };
  createdAt: number;
  updatedAt: number;
  room: Room;
  zones: Zone[];
}

/**
 * 持久化 / 导出的完整单元：结构 + 内容。
 * 这就是"世界可由保存的数据完整重建"的那份"保存的数据"。
 */
export interface SavedWorld {
  /** 文件格式版本，便于将来迁移。 */
  format: string;
  exportedAt: number;
  world: WorldConfig;
  entries: Entry[];
}

export const SAVE_FORMAT = "lingjing.save.v1";
