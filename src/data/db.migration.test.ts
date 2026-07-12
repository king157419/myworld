import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { defaultWorld } from "../config/defaultWorld";

// db v2 迁移：旧 v1 库（单世界 "main"、entries 无 scene）升级到 v2 后——
//   · 世界行 "main" 改主键为 "loft"（历史唯一场景就是潮汐图书馆）。
//   · 所有旧 entries 补 scene = "loft"，且 loadWorld("loft") 读出时剥掉 scene 还原为纯 Entry。
// 用 fake-indexeddb（setup.ts 注入）真实往返：先造一个 v1 库落数据，再用真实 db（v2）打开触发 upgrade。

describe("db v2 迁移：旧 main 世界 → loft，entries 补 scene", () => {
  beforeEach(async () => {
    await Dexie.delete("lingjing");
  });

  it("迁移旧世界行主键与旧 entries 的 scene 归属", async () => {
    // 1) 造一个 v1 库并落入旧数据（"main" 世界 + 无 scene 的 entries）。
    const v1 = new Dexie("lingjing");
    v1.version(1).stores({ worlds: "id", entries: "id, zoneId, createdAt" });
    await v1.open();
    await v1.table("worlds").put({ id: "main", world: defaultWorld });
    await v1.table("entries").bulkPut([
      { id: "m1", zoneId: "zone-bookshelf", type: "thought", title: "旧思考", body: "内容", createdAt: 1, updatedAt: 1 },
      { id: "m2", zoneId: "zone-objects", type: "object", title: "旧物件", body: "", createdAt: 2, updatedAt: 2 },
    ]);
    v1.close();

    // 2) 用真实 db（声明了 v1+v2）打开 → 触发 v2 upgrade。
    const { db, loadWorld } = await import("./db");
    await db.open();

    // 世界行：main → loft
    expect(await db.worlds.get("main")).toBeUndefined();
    const loftRow = await db.worlds.get("loft");
    expect(loftRow).toBeDefined();
    expect(loftRow?.world.room.style).toBe("loft");

    // entries：底层行都带上 scene = "loft"
    const rows = await db.entries.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => (r as { scene?: string }).scene === "loft")).toBe(true);

    // loadWorld("loft") 读出时剥掉 scene，还原为纯 Entry
    const { world, entries } = await loadWorld("loft");
    expect(world?.room.style).toBe("loft");
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.id === "m1")).not.toHaveProperty("scene");
  });
});
