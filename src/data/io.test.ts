import { describe, it, expect } from "vitest";
import { serializeWorld, parseSavedWorld, ImportError } from "./io";
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
