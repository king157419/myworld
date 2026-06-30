import Dexie, { type Table } from "dexie";
import type { Entry, WorldConfig } from "../config/types";

// 本地优先持久化（IndexedDB，经 Dexie 封装）。
// 结构(world)单行存放；内容(entries)按 id 主键、zoneId / createdAt 建索引。
interface WorldRow {
  id: string;
  world: WorldConfig;
}

class LingjingDB extends Dexie {
  worlds!: Table<WorldRow, string>;
  entries!: Table<Entry, string>;

  constructor() {
    super("lingjing");
    this.version(1).stores({
      worlds: "id",
      entries: "id, zoneId, createdAt",
    });
  }
}

export const db = new LingjingDB();

const WORLD_KEY = "main";

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: { world: WorldConfig; entries: Entry[] } | undefined;

/** 取消一个尚未触发的防抖写入。 */
export function cancelPendingSave(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  pending = undefined;
}

/**
 * 立即把整个世界写入 IndexedDB（覆盖式：entries 整表替换，避免删除残留）。
 * 先取消任何挂起的防抖写入——否则旧快照可能在直接落盘之后才触发，把新数据覆盖回去
 * （典型：导入新世界后，导入前排下的 debounce 仍会写回旧世界）。直接落盘永远是最后赢家。
 */
export async function persistNow(world: WorldConfig, entries: Entry[]): Promise<void> {
  cancelPendingSave();
  await db.transaction("rw", db.worlds, db.entries, async () => {
    await db.worlds.put({ id: WORLD_KEY, world });
    await db.entries.clear();
    if (entries.length) await db.entries.bulkPut(entries);
  });
}

/** 防抖写入：合并高频改动，停顿后落盘一次。 */
export function saveDebounced(world: WorldConfig, entries: Entry[], delay = 400): void {
  pending = { world, entries };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    const p = pending;
    pending = undefined;
    if (p) void persistNow(p.world, p.entries);
  }, delay);
}

/** 立即把挂起的防抖写入刷盘（页面隐藏 / 卸载前调用，避免丢失最近改动）。 */
export async function flushSave(): Promise<void> {
  if (!timer && !pending) return;
  if (timer) clearTimeout(timer);
  timer = undefined;
  const p = pending;
  pending = undefined;
  if (p) await persistNow(p.world, p.entries);
}

/** 启动时读取。没有则返回 undefined，由调用方回退 defaultWorld。 */
export async function loadWorld(): Promise<{ world?: WorldConfig; entries: Entry[] }> {
  const row = await db.worlds.get(WORLD_KEY);
  const entries = await db.entries.toArray();
  return { world: row?.world, entries };
}
