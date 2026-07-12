import { describe, it, expect, beforeEach } from "vitest";
import { db, persistNow, loadWorld, saveDebounced, flushSave, cancelPendingSave } from "./db";
import { defaultWorld } from "../config/defaultWorld";
import type { Entry } from "../config/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const entries: Entry[] = [
  { id: "a", zoneId: "zone-bookshelf", type: "thought", title: "一", body: "第一段", createdAt: 1, updatedAt: 1 },
  { id: "b", zoneId: "zone-bookshelf", type: "thought", title: "二", body: "第二段", createdAt: 2, updatedAt: 2 },
];

describe("db: 写入后刷新仍在（IndexedDB 往返）", () => {
  beforeEach(async () => {
    await db.worlds.clear();
    await db.entries.clear();
  });

  it("persists and reloads world + entries", async () => {
    await persistNow(defaultWorld, entries);
    const { world, entries: loaded } = await loadWorld("loft");
    expect(world).toEqual(defaultWorld);
    expect(loaded.sort((x, y) => x.createdAt - y.createdAt)).toEqual(entries);
  });

  it("returns undefined world on a fresh store", async () => {
    const { world, entries: loaded } = await loadWorld("loft");
    expect(world).toBeUndefined();
    expect(loaded).toEqual([]);
  });

  it("replaces entries wholesale (no stale leftovers after delete)", async () => {
    await persistNow(defaultWorld, entries);
    await persistNow(defaultWorld, [entries[0]]); // 删掉第二条后再存
    const { entries: loaded } = await loadWorld("loft");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("a");
  });
});

describe("db: 防抖落盘的刷新与取消", () => {
  beforeEach(async () => {
    cancelPendingSave();
    await db.worlds.clear();
    await db.entries.clear();
  });

  it("flushSave writes a pending debounced save immediately", async () => {
    saveDebounced(defaultWorld, entries, 5000); // 长延时，不靠它自然触发
    await flushSave();
    const { entries: loaded } = await loadWorld("loft");
    expect(loaded).toHaveLength(2);
  });

  it("persistNow cancels a pending debounced save (import-race fix)", async () => {
    saveDebounced(defaultWorld, entries, 100); // 排一个写两条的旧快照
    await persistNow(defaultWorld, [entries[0]]); // 直接落盘一条，应取消上面的挂起写
    await wait(200); // 等过旧 debounce 的时刻
    const { entries: loaded } = await loadWorld("loft");
    expect(loaded).toHaveLength(1); // 旧快照没有回写覆盖
    expect(loaded[0].id).toBe("a");
  });
});
