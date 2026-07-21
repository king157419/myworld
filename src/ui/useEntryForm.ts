import { useEffect, useRef, useState } from "react";
import type { Entry, EntryType } from "../config/types";
import { useWorld } from "../store/useWorld";
import { useZoneEntries } from "./useZoneEntries";

// 三个面板（书房/物件/黑胶）共用的"选中-编辑-保存"生命周期。此前五段式模板
// （载入 effect / reset / save / 按钮分支 / 列表高亮）在三处各抄一份且已彼此漂移；
// 对生命周期的任何修正都得改三遍——历史证明不会有人真的改三遍。
//
// 载入只 key 在 selectedEntryId 上（entry 用 getState 现查）：
// 之前 effect 依赖里带着过滤出的列表数组，任何一次 entries 变化（哪怕别的面板写入）
// 都会让数组换身份、effect 重跑，把正在输入的草稿整个冲掉。

export interface EntryFormOpts<D> {
  zoneId: string;
  type: EntryType;
  /** 空草稿（开新条目时的初值）。 */
  empty: D;
  /** 选中已有条目 → 草稿。 */
  fromEntry: (e: Entry) => D;
  /** 草稿 → 落库字段；返回 null 表示当前草稿不可保存（如必填为空）。 */
  toPatch: (d: D) => (Partial<Entry> & { title: string; body: string }) | null;
}

export function useEntryForm<D>({ zoneId, type, empty, fromEntry, toPatch }: EntryFormOpts<D>) {
  const setEditorDirty = useWorld((s) => s.setEditorDirty);
  const addEntry = useWorld((s) => s.addEntry);
  const updateEntry = useWorld((s) => s.updateEntry);
  const deleteEntry = useWorld((s) => s.deleteEntry);
  const selectEntry = useWorld((s) => s.selectEntry);
  const selectedEntryId = useWorld((s) => s.selectedEntryId);
  const items = useZoneEntries(zoneId, type);

  const [draft, setDraftRaw] = useState<D>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 回调/空值走 ref：不进 effect 依赖（面板每次 render 都会新建这些函数/对象字面量）。
  const opts = useRef({ empty, fromEntry, toPatch });
  opts.current = { empty, fromEntry, toPatch };

  // 当前草稿的基线（空表单 or 正在编辑条目的原始内容），用于脏状态比较。
  const baselineRef = useRef<D>(empty);

  // 更新草稿并同步脏状态（草稿短，JSON 比较无性能顾虑）。
  const setDraft = (d: D) => {
    setDraftRaw(d);
    setEditorDirty(JSON.stringify(d) !== JSON.stringify(baselineRef.current));
  };

  useEffect(() => {
    if (!selectedEntryId) return;
    const e = useWorld
      .getState()
      .entries.find((x) => x.id === selectedEntryId && x.zoneId === zoneId && x.type === type);
    if (e) {
      const loaded = opts.current.fromEntry(e);
      baselineRef.current = loaded;
      setDraftRaw(loaded);      // 跳过脏检测，直接写原始数据
      setEditingId(e.id);
      setEditorDirty(false);    // 刚载入时不脏
    }
  }, [selectedEntryId, zoneId, type, setEditorDirty]);

  const reset = () => {
    baselineRef.current = opts.current.empty;
    setDraftRaw(opts.current.empty);
    setEditingId(null);
    selectEntry(null);
    setEditorDirty(false);
  };

  const save = () => {
    const patch = opts.current.toPatch(draft);
    if (!patch) return;
    if (editingId) updateEntry(editingId, patch);
    else addEntry({ zoneId, type, ...patch });
    reset();
  };

  const remove = () => {
    if (!editingId) return;
    if (!window.confirm("确定删除这条内容？删除后无法恢复。")) return;
    deleteEntry(editingId);
    reset();
  };

  // 列表点选时脏则确认，取消则不切换。
  const handleSelectEntry = (id: string | null) => {
    if (useWorld.getState().editorDirty) {
      if (!window.confirm("当前有未保存的修改，切换后会丢失。继续？")) return;
    }
    selectEntry(id);
  };

  // Ctrl+S / Cmd+S 快捷保存；isComposing 时跳过（输入法组合中）。
  // saveRef 保证监听器始终调用最新的 save 闭包，不进 effect 依赖。
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = save;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { items, draft, setDraft, editingId, save, reset, remove, selectEntry: handleSelectEntry };
}
