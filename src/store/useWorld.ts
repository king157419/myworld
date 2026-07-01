import { create } from "zustand";
import type { Entry, WorldConfig } from "../config/types";
import { defaultWorld } from "../config/defaultWorld";
import { saveDebounced } from "../data/db";

// 唯一真相源。渲染层只订阅、不直接改世界结构；所有写入走这些 action。
// 每次改动后防抖落盘——刷新页面世界依然在。

type NewEntry = Omit<Entry, "id" | "createdAt" | "updatedAt">;

interface WorldState {
  world: WorldConfig;
  entries: Entry[];

  // —— UI / 漫游状态（不属于世界结构、不持久化，但放一起方便订阅）——
  /** 是否已点击"进入"（开声场 + 解锁第一人称）。瞬态。 */
  entered: boolean;
  enter: () => void;
  focusedZoneId: string | null;
  selectedEntryId: string | null;
  /** 准心当前对准的功能区（第一人称提示用），瞬态。 */
  hoveredZoneId: string | null;
  /** 对准的功能区是否已进入可交互距离（远处只提示名字、近了才能按 ENTER）。瞬态。 */
  hoveredInReach: boolean;
  setHovered: (id: string | null, inReach: boolean) => void;

  // —— 漫游 ——
  focusZone: (id: string) => void;
  clearFocus: () => void;
  selectEntry: (id: string | null) => void;
  /** 跳到某条内容所在的功能区并选中它（"最近添加"点击用）。 */
  gotoEntry: (id: string) => void;

  // —— 内容 CRUD ——
  addEntry: (e: NewEntry) => Entry;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  deleteEntry: (id: string) => void;

  // —— 世界结构（MVP 仅心境会改）——
  setMood: (mood: WorldConfig["room"]["mood"]) => void;

  // —— 启动 / 导入时整体替换 ——
  hydrate: (world: WorldConfig, entries: Entry[]) => void;
}

function persist(get: () => WorldState) {
  const s = get();
  saveDebounced(s.world, s.entries);
}

function touchWorld(world: WorldConfig, now: number): WorldConfig {
  return { ...world, updatedAt: now };
}

export const useWorld = create<WorldState>((set, get) => ({
  world: defaultWorld,
  entries: [],
  entered: false,
  focusedZoneId: null,
  selectedEntryId: null,
  hoveredZoneId: null,
  hoveredInReach: false,

  enter: () => set({ entered: true }),
  setHovered: (id, inReach) =>
    set((s) => (s.hoveredZoneId === id && s.hoveredInReach === inReach ? s : { hoveredZoneId: id, hoveredInReach: inReach })),

  focusZone: (id) => set({ focusedZoneId: id, selectedEntryId: null }),
  clearFocus: () => set({ focusedZoneId: null, selectedEntryId: null }),
  selectEntry: (id) => set({ selectedEntryId: id }),

  gotoEntry: (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    set({ focusedZoneId: entry.zoneId, selectedEntryId: id });
  },

  addEntry: (e) => {
    const now = Date.now();
    const entry: Entry = { ...e, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    set((s) => ({ entries: [...s.entries, entry], world: touchWorld(s.world, now) }));
    persist(get);
    return entry;
  },

  updateEntry: (id, patch) => {
    const now = Date.now();
    set((s) => ({
      entries: s.entries.map((x) =>
        x.id === id ? { ...x, ...patch, id: x.id, updatedAt: now } : x,
      ),
      world: touchWorld(s.world, now),
    }));
    persist(get);
  },

  deleteEntry: (id) => {
    set((s) => ({
      entries: s.entries.filter((x) => x.id !== id),
      selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId,
      world: touchWorld(s.world, Date.now()),
    }));
    persist(get);
  },

  setMood: (mood) => {
    set((s) => ({ world: { ...touchWorld(s.world, Date.now()), room: { ...s.world.room, mood } } }));
    persist(get);
  },

  hydrate: (world, entries) =>
    set({ world, entries, focusedZoneId: null, selectedEntryId: null }),
}));

// 注意（zustand v5 基于 useSyncExternalStore）：选择器若每次都返回新数组/对象，
// 会触发 "getSnapshot should be cached" 循环。因此按 zone 过滤一律在组件里用 useMemo
// 做（见 ui/useZoneEntries），不在选择器里 filter。
