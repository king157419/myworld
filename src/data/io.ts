import type { Entry, Mood, RoomStyle, SavedWorld, Vec3, WorldConfig, Zone } from "../config/types";
import { ENTRY_TYPES, MOODS, ROOM_STYLES, SAVE_FORMAT, ZONE_TYPES } from "../config/types";

// 导出 / 导入：整个世界是一份你拥有的 JSON。
// 这同时满足"数据归我、可塞进 OneDrive/Obsidian"与"导出再导入完整复现"。
//
// parseSavedWorld 是渲染层的守门：形状不对就抛错，绝不静默放行。
// 因为渲染层信任 store 里的数据（不做防御性解构），所以非法数据一旦混入就会
// 污染世界并落盘（刷新仍在），故这里要把它彻底挡在门外。这道门也是后期 AI
// 写配置补丁时复用的同一道防线。
// 合法值数组与联合类型同源（config/types.ts），不在此手抄副本。

export function buildSavedWorld(world: WorldConfig, entries: Entry[], now: number): SavedWorld {
  return {
    format: SAVE_FORMAT,
    exportedAt: now,
    world,
    entries,
  };
}

export function serializeWorld(world: WorldConfig, entries: Entry[], now: number): string {
  return JSON.stringify(buildSavedWorld(world, entries, now), null, 2);
}

/** 触发浏览器下载一份 JSON 文件。 */
export function downloadWorld(world: WorldConfig, entries: Entry[], now: number): void {
  const json = serializeWorld(world, entries, now);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date(now).toISOString().slice(0, 10);
  a.download = `lingjing-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

class ImportError extends Error {}

/** 单条 entry 的守门 + 归一化（parseSavedWorld 与 parseEntryBatch 共用同一道防线）。 */
function cleanEntries(list: unknown[], zoneIds: Set<string>): Entry[] {
  const seen = new Set<string>();
  return list.map((e, i) => {
    if (typeof e !== "object" || e === null) throw new ImportError(`第 ${i + 1} 条内容格式错误`);
    const r = e as Record<string, unknown>;
    if (!isStr(r.id) || !isStr(r.zoneId)) throw new ImportError(`第 ${i + 1} 条内容缺少 id/zoneId`);
    if (seen.has(r.id)) throw new ImportError(`内容 id 重复：${r.id}`);
    seen.add(r.id);
    if (!ENTRY_TYPES.includes(r.type as (typeof ENTRY_TYPES)[number])) {
      throw new ImportError(`第 ${i + 1} 条内容的 type 非法：${String(r.type)}`);
    }
    if (!zoneIds.has(r.zoneId)) {
      throw new ImportError(`第 ${i + 1} 条内容指向不存在的功能区：${r.zoneId}`);
    }
    // 归一化必填字符串与时间戳；其余可选字段原样保留。
    return {
      ...(r as unknown as Entry),
      title: isStr(r.title) ? r.title : "",
      body: isStr(r.body) ? r.body : "",
      createdAt: isNum(r.createdAt) ? r.createdAt : 0,
      updatedAt: isNum(r.updatedAt) ? r.updatedAt : 0,
    };
  });
}

/**
 * 解析"内容批"文件（本地收件箱 public/inbox/<scene>.json 用）：
 * 只有 entries、没有 world——世界结构仍以当前场景为准，zoneId 必须指向给定的真实功能区。
 * 形状：{ format?: "lingjing.entries.v1", entries: [...] } 或裸数组。
 */
export function parseEntryBatch(text: string, zoneIds: Set<string>): Entry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("不是合法的 JSON 文件");
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as Record<string, unknown>).entries)
      ? ((data as Record<string, unknown>).entries as unknown[])
      : null;
  if (!list) throw new ImportError("内容批文件缺少 entries 数组");
  return cleanEntries(list, zoneIds);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every(isNum);
}

function validateZone(z: unknown): z is Zone {
  if (typeof z !== "object" || z === null) return false;
  const o = z as Record<string, unknown>;
  return (
    isStr(o.id) &&
    ZONE_TYPES.includes(o.type as (typeof ZONE_TYPES)[number]) &&
    isVec3(o.position) &&
    // rotation 可选，但一旦出现就必须是合法 Vec3（渲染层会读它做相机聚焦回退）。
    (o.rotation === undefined || isVec3(o.rotation)) &&
    isStr(o.label)
  );
}

/** 校验 room 的承载性字段——缺了它们渲染层会直接崩。 */
function validateRoom(room: unknown): asserts room is WorldConfig["room"] {
  if (typeof room !== "object" || room === null) throw new ImportError("world.room 缺失或非法");
  const r = room as Record<string, unknown>;
  if (!ROOM_STYLES.includes(r.style as RoomStyle)) throw new ImportError("world.room.style 非法");
  const d = r.dimensions as Record<string, unknown> | undefined;
  if (!d || !isNum(d.w) || !isNum(d.h) || !isNum(d.d)) {
    throw new ImportError("world.room.dimensions 缺失或非法");
  }
  const p = r.palette as Record<string, unknown> | undefined;
  if (!p || !isStr(p.base) || !isStr(p.accent) || !isStr(p.floor)) {
    throw new ImportError("world.room.palette 缺失或非法");
  }
  const m = r.mood as Record<string, unknown> | undefined;
  if (!m || !MOODS.includes(m.lighting as Mood) || !isNum(m.intensity) || !isNum(m.fog)) {
    throw new ImportError("world.room.mood 缺失或非法");
  }
}

/**
 * 解析并校验一份导入的 JSON。任何破坏"世界可由数据完整重建"的形状都被拒绝：
 * - room 的 dimensions/palette/mood 必须齐备且类型正确（否则渲染层崩溃）。
 * - 每条 entry 的 type 合法、zoneId 必须指向真实存在的功能区（否则成为永不可见的孤儿）。
 * - id 必须唯一（否则落盘时按主键去重，数量上无法"完整复现"，且 React key 冲突）。
 */
export function parseSavedWorld(text: string): SavedWorld {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("不是合法的 JSON 文件");
  }
  if (typeof data !== "object" || data === null) throw new ImportError("文件内容为空或格式错误");

  const o = data as Record<string, unknown>;
  const world = o.world as WorldConfig | undefined;

  if (!world || typeof world !== "object") throw new ImportError("缺少 world 字段");
  validateRoom(world.room);
  if (!Array.isArray(world.zones) || !world.zones.every(validateZone)) {
    throw new ImportError("world.zones 缺失或含非法功能区");
  }
  const zoneIds = new Set<string>();
  for (const z of world.zones) {
    if (zoneIds.has(z.id)) throw new ImportError(`功能区 id 重复：${z.id}`);
    zoneIds.add(z.id);
  }
  if (!Array.isArray(o.entries)) throw new ImportError("entries 必须是数组");
  const cleaned = cleanEntries(o.entries as unknown[], zoneIds);

  return {
    format: isStr(o.format) ? o.format : SAVE_FORMAT,
    exportedAt: isNum(o.exportedAt) ? o.exportedAt : 0,
    world,
    entries: cleaned,
  };
}

export { ImportError };
