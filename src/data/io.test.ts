import { describe, it, expect } from "vitest";
import { serializeWorld, parseSavedWorld, parseEntryBatch, ImportError } from "./io";
import { defaultWorld } from "../config/defaultWorld";
import type { Entry } from "../config/types";

const sampleEntries: Entry[] = [
  {
    id: "e1",
    zoneId: "zone-bookshelf",
    type: "thought",
    title: "雨夜",
    body: "今天很累，喜欢雨夜、旧书和爵士乐。",
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: "e2",
    zoneId: "zone-objects",
    type: "object",
    title: "耳机",
    body: "陪了三年。",
    primitive: "box",
    color: "#334455",
    createdAt: 2000,
    updatedAt: 2500,
  },
];

describe("io: 导出再导入完整复现", () => {
  it("round-trips world + entries without loss", () => {
    const json = serializeWorld(defaultWorld, sampleEntries, 12345);
    const restored = parseSavedWorld(json);
    expect(restored.world).toEqual(defaultWorld);
    expect(restored.entries).toEqual(sampleEntries);
    expect(restored.exportedAt).toBe(12345);
  });

  it("preserves type-specific fields (primitive/color)", () => {
    const json = serializeWorld(defaultWorld, sampleEntries, 1);
    const restored = parseSavedWorld(json);
    const obj = restored.entries.find((e) => e.id === "e2");
    expect(obj?.primitive).toBe("box");
    expect(obj?.color).toBe("#334455");
  });

  it("accepts the new scene styles (attic / courtyard)（守门随 ROOM_STYLES 同源放宽）", () => {
    for (const style of ["attic", "courtyard"] as const) {
      const world = { ...defaultWorld, room: { ...defaultWorld.room, style } };
      const json = serializeWorld(world, [], 1);
      expect(parseSavedWorld(json).world.room.style).toBe(style);
    }
  });
});

describe("io: 非法输入被拒绝（守门）", () => {
  it("rejects non-JSON", () => {
    expect(() => parseSavedWorld("nonsense{")).toThrow(ImportError);
  });

  it("rejects missing world", () => {
    expect(() => parseSavedWorld(JSON.stringify({ entries: [] }))).toThrow(ImportError);
  });

  it("rejects room with missing dimensions/palette/mood (would crash renderer)", () => {
    const bad = { world: { ...defaultWorld, room: {} }, entries: [] };
    expect(() => parseSavedWorld(JSON.stringify(bad))).toThrow(ImportError);
  });

  it("rejects illegal zones", () => {
    const bad = {
      world: { ...defaultWorld, zones: [{ id: "x", type: "nope", position: [0, 0, 0], label: "x" }] },
      entries: [],
    };
    expect(() => parseSavedWorld(JSON.stringify(bad))).toThrow(ImportError);
  });

  it("rejects entry with illegal type (would become an invisible orphan)", () => {
    const bad = {
      world: defaultWorld,
      entries: [{ id: "a", zoneId: "zone-bookshelf", type: "ghost", title: "t", body: "b" }],
    };
    expect(() => parseSavedWorld(JSON.stringify(bad))).toThrow(ImportError);
  });

  it("rejects entry whose zoneId does not exist in zones", () => {
    const bad = {
      world: defaultWorld,
      entries: [{ id: "a", zoneId: "zone-nope", type: "thought", title: "t", body: "b" }],
    };
    expect(() => parseSavedWorld(JSON.stringify(bad))).toThrow(ImportError);
  });

  it("rejects duplicate entry ids (bulkPut would silently merge them)", () => {
    const dup = (id: string): Entry => ({
      id,
      zoneId: "zone-bookshelf",
      type: "thought",
      title: "t",
      body: "b",
      createdAt: 1,
      updatedAt: 1,
    });
    const bad = { world: defaultWorld, entries: [dup("same"), dup("same")] };
    expect(() => parseSavedWorld(JSON.stringify(bad))).toThrow(ImportError);
  });

  it("normalizes missing title/body and timestamps instead of crashing", () => {
    const data = {
      world: defaultWorld,
      entries: [{ id: "e", zoneId: "zone-bookshelf", type: "thought" }],
    };
    const restored = parseSavedWorld(JSON.stringify(data));
    expect(restored.entries[0].title).toBe("");
    expect(restored.entries[0].body).toBe("");
    expect(restored.entries[0].createdAt).toBe(0);
    expect(restored.entries[0].updatedAt).toBe(0);
  });
});

describe("io: parseEntryBatch（本地收件箱内容批）", () => {
  const zoneIds = new Set(defaultWorld.zones.map((z) => z.id));

  it("accepts { format, entries } wrapper and bare arrays", () => {
    const wrapped = JSON.stringify({ format: "lingjing.entries.v1", entries: sampleEntries });
    expect(parseEntryBatch(wrapped, zoneIds)).toEqual(sampleEntries);
    const bare = JSON.stringify(sampleEntries);
    expect(parseEntryBatch(bare, zoneIds)).toEqual(sampleEntries);
  });

  it("rejects entries pointing at unknown zones", () => {
    const bad = JSON.stringify([{ ...sampleEntries[0], zoneId: "zone-ghost" }]);
    expect(() => parseEntryBatch(bad, zoneIds)).toThrow(ImportError);
  });

  it("rejects duplicate ids and illegal types", () => {
    const dup = JSON.stringify([sampleEntries[0], sampleEntries[0]]);
    expect(() => parseEntryBatch(dup, zoneIds)).toThrow(ImportError);
    const badType = JSON.stringify([{ ...sampleEntries[0], type: "dream" }]);
    expect(() => parseEntryBatch(badType, zoneIds)).toThrow(ImportError);
  });

  it("rejects files without an entries array", () => {
    expect(() => parseEntryBatch(JSON.stringify({ hello: 1 }), zoneIds)).toThrow(ImportError);
    expect(() => parseEntryBatch("not json{", zoneIds)).toThrow(ImportError);
  });
});
