import { useMemo } from "react";
import type { Entry, EntryType } from "../config/types";
import { useWorld } from "../store/useWorld";

// 取某个功能区内某类内容，按时间倒序（最近在前）。
// 三个面板共用此 hook，避免各自重复 filter+sort 的 useMemo。
// 返回新数组在 useMemo 里安全（不是 zustand 选择器，见 store/useWorld 注释）。
export function useZoneEntries(zoneId: string, type: EntryType): Entry[] {
  const entries = useWorld((s) => s.entries);
  return useMemo(
    () =>
      entries
        .filter((e) => e.zoneId === zoneId && e.type === type)
        .sort((a, b) => b.createdAt - a.createdAt),
    [entries, zoneId, type],
  );
}
