import { describe, it, expect, beforeEach } from "vitest";
import { useWorld } from "./useWorld";
import { db } from "../data/db";
import { defaultWorld } from "../config/defaultWorld";

// 场景切换往返：loft → attic → loft → attic，内容各归各的场景、不串场景、不丢失。
// 用真实 fake-indexeddb（本文件**不** mock db，与 useWorld.test.ts 隔离）。

async function clearDb() {
  await db.worlds.clear();
  await db.entries.clear();
  await db.meta.clear();
}

describe("store.switchScene：多场景往返不串不丢", () => {
  beforeEach(async () => {
    await clearDb();
    // 复位到 loft 初始态。
    useWorld.setState({ world: defaultWorld, entries: [], focusedZoneId: null, selectedEntryId: null });
  });

  it("loft 与 attic 各自独立：切走再切回内容还在、不混入对方", async () => {
    // 1) loft 场景写一条内容。
    const loftEntry = useWorld.getState().addEntry({ zoneId: "zone-bookshelf", type: "thought", title: "loft 的思考", body: "只属于 loft" });
    expect(useWorld.getState().world.room.style).toBe("loft");

    // 2) 切到 attic：应刷盘 loft、加载 attic（首次 → 种子 + 落盘）。
    await useWorld.getState().switchScene("attic");
    const afterAttic = useWorld.getState();
    expect(afterAttic.world.room.style).toBe("attic");
    // attic 只有它自己的种子，绝无 loft 那条。
    expect(afterAttic.entries.some((e) => e.id === loftEntry.id)).toBe(false);
    expect(afterAttic.entries.length).toBeGreaterThan(0);
    // 印记正式稿种子 id 形如 attic-t1 / attic-o1 / attic-r1（都以 attic- 起头）。
    expect(afterAttic.entries.every((e) => e.id.startsWith("attic-"))).toBe(true);

    // 3) 在 attic 写一条内容。
    const atticEntry = useWorld.getState().addEntry({ zoneId: "zone-objects", type: "object", title: "attic 的物件", body: "只属于 attic" });

    // 4) 切回 loft：loft 那条还在，且没有 attic 的任何东西。
    await useWorld.getState().switchScene("loft");
    const backLoft = useWorld.getState();
    expect(backLoft.world.room.style).toBe("loft");
    expect(backLoft.entries.some((e) => e.id === loftEntry.id)).toBe(true);
    expect(backLoft.entries.some((e) => e.id === atticEntry.id)).toBe(false);
    expect(backLoft.entries.some((e) => e.id.startsWith("attic-"))).toBe(false);

    // 5) 再切到 attic：attic 的种子 + 第 3 步写的那条都在（持久化了、没丢）。
    await useWorld.getState().switchScene("attic");
    const backAttic = useWorld.getState();
    expect(backAttic.world.room.style).toBe("attic");
    expect(backAttic.entries.some((e) => e.id === atticEntry.id)).toBe(true);
    expect(backAttic.entries.some((e) => e.id === loftEntry.id)).toBe(false);
  });

  it("切到同一场景是空操作（不重置内容）", async () => {
    const e = useWorld.getState().addEntry({ zoneId: "zone-bookshelf", type: "thought", title: "x", body: "y" });
    await useWorld.getState().switchScene("loft"); // 已在 loft
    expect(useWorld.getState().entries.some((x) => x.id === e.id)).toBe(true);
    expect(useWorld.getState().world.room.style).toBe("loft");
  });
});
