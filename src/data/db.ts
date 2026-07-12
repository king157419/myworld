import Dexie, { type Table } from "dexie";
import type { Entry, WorldConfig } from "../config/types";

// 本地优先持久化（IndexedDB，经 Dexie 封装）。
//
// 多场景（v2）：每个场景（= world.room.style）是一份独立世界，各自可导出导入重建。
//   · worlds 行以 style 作主键（loft / attic / courtyard …）。
//   · entries 每行附一个 scene 字段（= 所属场景 style），按场景作用域读写；
//     Entry 类型不含 scene——写入时加、读出时剥掉，渲染层看到的永远是纯 Entry。
//   · meta 存 lastScene，启动时据此回到上次所在的场景。
interface WorldRow {
  id: string; // = world.room.style
  world: WorldConfig;
}
// 落盘用的 entry 行：在 Entry 之上多一个场景归属字段（不进 Entry 契约）。
type StoredEntry = Entry & { scene: string };
interface MetaRow {
  key: string;
  value: string;
}

class LingjingDB extends Dexie {
  worlds!: Table<WorldRow, string>;
  entries!: Table<StoredEntry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("lingjing");
    // v1（历史）：单世界 "main"，entries 无 scene。
    this.version(1).stores({
      worlds: "id",
      entries: "id, zoneId, createdAt",
    });
    // v2：多场景。给 entries 加 scene 索引、新增 meta 表，并迁移旧数据：
    //   · 旧世界行 "main" → 改主键为 "loft"（历史唯一场景就是潮汐图书馆）。
    //   · 旧 entries 全部补 scene = "loft"。
    this.version(2)
      .stores({
        worlds: "id",
        entries: "id, zoneId, createdAt, scene",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const worlds = tx.table<WorldRow, string>("worlds");
        const main = await worlds.get("main");
        if (main) {
          await worlds.put({ id: "loft", world: main.world });
          await worlds.delete("main");
        }
        await tx
          .table("entries")
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            e.scene = "loft";
          });
      });
  }
}

export const db = new LingjingDB();

const LAST_SCENE_KEY = "lastScene";

/** 场景键从世界结构派生：一个世界属于哪个场景，由它的 room.style 决定。 */
function styleOf(world: WorldConfig): string {
  return world.room.style;
}

/** 读出时剥掉存储层附加的 scene 字段，还原为纯 Entry。 */
function stripScene(row: StoredEntry): Entry {
  const { scene: _scene, ...entry } = row;
  return entry;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: { world: WorldConfig; entries: Entry[] } | undefined;

/** 取消一个尚未触发的防抖写入。 */
export function cancelPendingSave(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  pending = undefined;
}

/**
 * 立即把整个世界写入 IndexedDB（按场景作用域，覆盖式）。
 * 场景键从 world.room.style 派生：只清当前场景的 entries 行、只覆盖当前场景的 world 行，
 * 其它场景的数据原封不动（切场景不串数据）。同时更新 meta.lastScene。
 * 先取消任何挂起的防抖写入——否则旧快照可能在直接落盘之后才触发覆盖回去。直接落盘永远是最后赢家。
 */
export async function persistNow(world: WorldConfig, entries: Entry[]): Promise<void> {
  cancelPendingSave();
  const style = styleOf(world);
  await db.transaction("rw", db.worlds, db.entries, db.meta, async () => {
    await db.worlds.put({ id: style, world });
    await db.entries.where("scene").equals(style).delete();
    if (entries.length) {
      await db.entries.bulkPut(entries.map((e) => ({ ...e, scene: style })));
    }
    await db.meta.put({ key: LAST_SCENE_KEY, value: style });
  });
}

/** 防抖写入：合并高频改动，停顿后落盘一次（场景由快照自带的 world.room.style 决定）。 */
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

/** 立即把挂起的防抖写入刷盘（页面隐藏 / 卸载前、切换场景前调用，避免丢失最近改动）。 */
export async function flushSave(): Promise<void> {
  if (!timer && !pending) return;
  if (timer) clearTimeout(timer);
  timer = undefined;
  const p = pending;
  pending = undefined;
  if (p) await persistNow(p.world, p.entries);
}

/**
 * 读取某个场景的世界。没有则 world 为 undefined，由调用方回退该场景的 defaultWorld + 种子。
 * entries 已剥掉 scene 字段（还原为纯 Entry）。
 */
export async function loadWorld(style: string): Promise<{ world?: WorldConfig; entries: Entry[] }> {
  const row = await db.worlds.get(style);
  const stored = await db.entries.where("scene").equals(style).toArray();
  return { world: row?.world, entries: stored.map(stripScene) };
}

/** 启动时读取上次所在的场景 style；没有（全新用户 / 刚迁移）返回 undefined。 */
export async function readLastScene(): Promise<string | undefined> {
  const row = await db.meta.get(LAST_SCENE_KEY);
  return row?.value;
}
