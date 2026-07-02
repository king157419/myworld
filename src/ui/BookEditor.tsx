import { useEntryForm } from "./useEntryForm";
import EntryList from "./EntryList";

function makeTitle(body: string): string {
  const firstLine = body.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 16) || "无题";
}

// 书房面板：写思考 → 放进书架（书脊+1）；点书脊/列表项 → 展开重读、可编辑、可删。
// 视觉方向：书页，不是浮动卡片。表单生命周期在 useEntryForm。
export default function BookEditor({ zoneId }: { zoneId: string }) {
  const { items: thoughts, draft, setDraft, editingId, save, reset, remove, selectEntry } = useEntryForm<string>({
    zoneId,
    type: "thought",
    empty: "",
    fromEntry: (e) => e.body,
    toPatch: (d) => {
      const body = d.trim();
      return body ? { title: makeTitle(body), body } : null;
    },
  });

  return (
    <div className="panel">
      {/* 两行制眉头 */}
      <div className="panel-masthead">
        <p className="panel-eyebrow">THE STUDY — 思考</p>
        <h2 className="panel-title">书房</h2>
      </div>

      {/* 正文区：书页 */}
      <div className="panel-body">
        <p className="panel-hint">
          {editingId ? "正在编辑一段旧的思考。" : "写下此刻，它会成为书架上新的一本。"}
        </p>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="写下此刻的一段……"
          rows={7}
          aria-label="思考内容"
        />

        {/* 操作按钮：文字排版型，按重要度排列 */}
        <div className="row">
          <button className="primary" onClick={save} disabled={!draft.trim()}>
            {editingId ? "保存修改" : "放进书架"}
          </button>

          {editingId && (
            <>
              <button className="secondary" onClick={reset}>写新的一段</button>
              <button className="danger" onClick={remove}>删除这本</button>
            </>
          )}
        </div>

        {/* 索引列表 */}
        <EntryList headLabel="书架" count={thoughts.length} emptyText="还是空的。写下第一段吧。">
          {thoughts.map((t) => (
            <button
              key={t.id}
              className={`list-item${t.id === editingId ? " active" : ""}`}
              onClick={() => selectEntry(t.id)}
              aria-pressed={t.id === editingId}
            >
              <span className="title">{t.title}</span>
              <span className="date">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</span>
            </button>
          ))}
        </EntryList>
      </div>
    </div>
  );
}
