import type { ReactNode } from "react";

// 列表外壳：标题+计数、空状态、列表容器。三个面板共用，统一观感。
// 列表项各面板自渲染（书/物件是可选择按钮，唱片是播放/删除行），用 children 注入。
export default function EntryList({
  headLabel,
  count,
  emptyText,
  children,
}: {
  headLabel: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <div className="list">
      <div className="list-head">
        {headLabel}（{count}）
      </div>
      {count === 0 ? <div className="empty">{emptyText}</div> : children}
    </div>
  );
}
