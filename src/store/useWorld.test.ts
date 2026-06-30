import { describe, it, expect, beforeEach, vi } from "vitest";

// 隔离持久化：store 逻辑测试不关心落盘。
vi.mock("../data/db", () => ({ saveDebounced: vi.fn() }));

import { useWorld } from "./useWorld";
import { defaultWorld } from "../config/defaultWorld";

const reset = () =>
  useWorld.setState({
    world: defaultWorld,
    entries: [],
    focusedZoneId: null,
    selectedEntryId: null,
    playingTrackId: null,
  });

describe("store: 内容 CRUD 与时间戳（生长的基础）", () => {
  beforeEach(reset);

  it("addEntry stamps id + timestamps and appends", () => {
    const { addEntry } = useWorld.getState();
    const e = addEntry({ zoneId: "zone-bookshelf", type: "thought", title: "t", body: "b" });
    expect(e.id).toBeTruthy();
    expect(e.createdAt).toBeGreaterThan(0);
    expect(e.updatedAt).toBe(e.createdAt);
    expect(useWorld.getState().entries).toHaveLength(1);
  });

  it("updateEntry patches body and bumps updatedAt, keeps id/createdAt", () => {
    const { addEntry, updateEntry } = useWorld.getState();
    const e = addEntry({ zoneId: "z", type: "thought", title: "t", body: "b" });
    updateEntry(e.id, { body: "b2" });
    const after = useWorld.getState().entries[0];
    expect(after.id).toBe(e.id);
    expect(after.createdAt).toBe(e.createdAt);
    expect(after.body).toBe("b2");
    expect(after.updatedAt).toBeGreaterThanOrEqual(e.createdAt);
  });

  it("deleteEntry removes and clears selection if it was selected", () => {
    const { addEntry, deleteEntry, selectEntry } = useWorld.getState();
    const e = addEntry({ zoneId: "z", type: "object", title: "o", body: "" });
    selectEntry(e.id);
    deleteEntry(e.id);
    expect(useWorld.getState().entries).toHaveLength(0);
    expect(useWorld.getState().selectedEntryId).toBeNull();
  });
});

describe("store: 漫游 / 聚焦", () => {
  beforeEach(reset);

  it("gotoEntry focuses the entry's zone and selects it", () => {
    const { addEntry, gotoEntry } = useWorld.getState();
    const e = addEntry({ zoneId: "zone-objects", type: "object", title: "o", body: "" });
    gotoEntry(e.id);
    expect(useWorld.getState().focusedZoneId).toBe("zone-objects");
    expect(useWorld.getState().selectedEntryId).toBe(e.id);
  });

  it("focusZone clears selection; clearFocus resets both", () => {
    const { focusZone, clearFocus, selectEntry } = useWorld.getState();
    selectEntry("x");
    focusZone("zone-record");
    expect(useWorld.getState().focusedZoneId).toBe("zone-record");
    expect(useWorld.getState().selectedEntryId).toBeNull();
    clearFocus();
    expect(useWorld.getState().focusedZoneId).toBeNull();
  });

  it("setMood updates room mood (data-driven ambiance)", () => {
    const { setMood } = useWorld.getState();
    setMood({ lighting: "rainy", intensity: 1, fog: 0.6 });
    expect(useWorld.getState().world.room.mood.lighting).toBe("rainy");
  });
});
