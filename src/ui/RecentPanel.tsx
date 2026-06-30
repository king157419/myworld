import { useMemo } from "react";
import type { EntryType } from "../config/types";
import { useWorld } from "../store/useWorld";

const TYPE_LABEL: Record<EntryType, string> = {
  thought: "思考",
  object: "物件",
  track: "音轨",
  person: "人物",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

// "最近添加" / 时间线：把累积的内容按时间倒序铺开——生长的最小可见形态。
// 点击任意一条 → 飞到它所在的功能区并选中。
export default function RecentPanel({ onClose }: { onClose: () => void }) {
  const entries = useWorld((s) => s.entries);
  const gotoEntry = useWorld((s) => s.gotoEntry);

  const recent = useMemo(() => [...entries].sort((a, b) => b.createdAt - a.createdAt), [entries]);

  return (
    <div className="panel">
      <div className="panel-masthead">
        <p className="panel-eyebrow">CHRONICLE — 时间线</p>
        <h2 className="panel-title">最近添加</h2>
      </div>

      <div className="panel-body">
        <p className="panel-hint">你往这个世界里放进的一切，按时间排开。</p>

        {recent.length === 0 && (
          <div className="empty">世界还很空。去书房写下第一段吧。</div>
        )}

        <div className="list">
          {recent.map((e) => (
            <button
              key={e.id}
              className="list-item"
              onClick={() => {
                gotoEntry(e.id);
                onClose();
              }}
            >
              <span className="tag">{TYPE_LABEL[e.type]}</span>
              <span className="title">{e.title || "无题"}</span>
              <span className="date">{timeAgo(e.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
