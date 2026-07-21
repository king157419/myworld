import { create } from "zustand";
import type { Entry, RoomStyle, WorldConfig } from "../config/types";
import { defaultWorld } from "../config/defaultWorld";
import { flushSave, loadWorld, persistNow, saveDebounced } from "../data/db";
import { fetchInboxAdditions } from "../data/inbox";
import { SCENE_DATA, resolveScene } from "../scenes/registryData";

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
  /** 编辑面板是否有未保存草稿（Esc/暗幕关闭前确认用；useEntryForm 上报）。瞬态。 */
  editorDirty: boolean;
  setEditorDirty: (d: boolean) => void;

  // —— 望远镜"看记忆"（舞台件，非 zone；与 focus 互斥）——
  /** 是否正凑在望远镜前看记忆。瞬态，不持久化。 */
  telescopeActive: boolean;
  openTelescope: () => void;
  closeTelescope: () => void;

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

  // —— 场景切换（多场景架构）——
  /** 切到另一个场景：刷盘当前 → 加载目标（无则种子+落盘）→ hydrate → 清 focus/hover。 */
  switchScene: (style: RoomStyle) => Promise<void>;

  /** 吸收当前场景的本地收件箱（public/inbox/<scene>.json，按 id 幂等）。返回新增条数。 */
  absorbInbox: () => Promise<number>;

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
  telescopeActive: false,

  enter: () => set({ entered: true }),
  setHovered: (id, inReach) =>
    set((s) => (s.hoveredZoneId === id && s.hoveredInReach === inReach ? s : { hoveredZoneId: id, hoveredInReach: inReach })),
  editorDirty: false,
  setEditorDirty: (d) => set((s) => (s.editorDirty === d ? s : { editorDirty: d })),

  // 望远镜与功能区聚焦互斥：开望远镜先清 focus，反之聚焦某区也退望远镜。
  openTelescope: () => set({ telescopeActive: true, focusedZoneId: null, selectedEntryId: null }),
  closeTelescope: () => set({ telescopeActive: false }),

  focusZone: (id) => set({ focusedZoneId: id, selectedEntryId: null, telescopeActive: false, editorDirty: false }),
  clearFocus: () => set({ focusedZoneId: null, selectedEntryId: null, editorDirty: false }),
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

  switchScene: async (style) => {
    const target = resolveScene(style);
    if (get().world.room.style === target) return;
    // 先把当前场景挂起的防抖写入刷盘（否则切走后它才触发，会写进错的场景快照？——不会：
    // 快照自带 world.room.style，落到正确场景；但仍要 flush 以免丢最近改动）。
    await flushSave();
    const loaded = await loadWorld(target);
    if (loaded.world) {
      get().hydrate(loaded.world, loaded.entries);
    } else {
      // 首次进入该场景：注入种子并落盘一次。
      const def = SCENE_DATA[target].defaultWorld;
      const seed = SCENE_DATA[target].makeSeed(Date.now());
      get().hydrate(def, seed);
      await persistNow(def, seed);
    }
    // hydrate 已清 focus/hover。水声/曲库/空间化锚点由 audio/useSceneAudio 订阅 room.style 统一切换。
    void get().absorbInbox();
  },

  absorbInbox: async () => {
    const s = get();
    const additions = await fetchInboxAdditions(s.world, s.entries);
    if (!additions.length) return 0;
    // 二次去重在 set 回调里做：fetch 是异步的，StrictMode 双挂载/并发 absorb
    // 都可能拿着同一批增量到达这里——以落笔瞬间的最新状态为准，绝不重复追加。
    let fresh = 0;
    set((st) => {
      const have = new Set(st.entries.map((e) => e.id));
      const add = additions.filter((e) => !have.has(e.id));
      fresh = add.length;
      return add.length ? { entries: [...st.entries, ...add] } : st;
    });
    if (!fresh) return 0;
    await persistNow(get().world, get().entries);
    console.info(`[lingjing] 收件箱吸收了 ${fresh} 条内容（${s.world.room.style}）`);
    return fresh;
  },

  // telescopeActive 必须一并清：切场景时若正看望远镜，新场景可能没有望远镜（只有 loft 有），
  // 残留 true 会让帧循环继续朝 loft 目镜的世界坐标阻尼飞行（审计确认项）。
  hydrate: (world, entries) =>
    set({
      world,
      entries,
      focusedZoneId: null,
      selectedEntryId: null,
      hoveredZoneId: null,
      hoveredInReach: false,
      telescopeActive: false,
      editorDirty: false,
    }),
}));

// 注意（zustand v5 基于 useSyncExternalStore）：选择器若每次都返回新数组/对象，
// 会触发 "getSnapshot should be cached" 循环。因此按 zone 过滤一律在组件里用 useMemo
// 做（见 ui/useZoneEntries），不在选择器里 filter。
