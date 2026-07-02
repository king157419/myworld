import type { Primitive } from "../config/types";
import { PRIMITIVES } from "../config/types";
import { useEntryForm } from "./useEntryForm";
import EntryList from "./EntryList";

const PRIM_LABELS: Record<Primitive, string> = { box: "方", cylinder: "柱", sphere: "球" };
const DEFAULT_COLOR = "#caa472";

interface ObjectDraft {
  title: string;
  body: string;
  primitive: Primitive;
  color: string;
}

// 物件博物馆面板：添加物件（标题 + 描述 + 几何体 + 颜色）→ 基座上出现它，可旋转端详。
// 表单生命周期在 useEntryForm。
export default function ObjectForm({ zoneId }: { zoneId: string }) {
  const { items: objects, draft, setDraft, editingId, save, reset, remove, selectEntry } = useEntryForm<ObjectDraft>({
    zoneId,
    type: "object",
    empty: { title: "", body: "", primitive: "box", color: DEFAULT_COLOR },
    fromEntry: (e) => ({
      title: e.title,
      body: e.body,
      primitive: e.primitive ?? "box",
      color: e.color ?? DEFAULT_COLOR,
    }),
    toPatch: (d) => {
      const title = d.title.trim();
      return title ? { title, body: d.body.trim(), primitive: d.primitive, color: d.color } : null;
    },
  });

  return (
    <div className="panel">
      <div className="panel-masthead">
        <p className="panel-eyebrow">THE MUSEUM — 物件</p>
        <h2 className="panel-title">物件博物馆</h2>
      </div>

      <div className="panel-body">
        <p className="panel-hint">放一件你珍视的东西，给它一个形状与来历。</p>

        <label className="field">
          <span>标题</span>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="那副陪了三年的耳机" />
        </label>
        <label className="field">
          <span>来历</span>
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="它从哪来，为什么在乎它……" />
        </label>
        <div className="field">
          <span id="prim-label">形状</span>
          <div className="row" role="group" aria-labelledby="prim-label">
            {PRIMITIVES.map((p) => (
              <button
                key={p}
                className={`chip${draft.primitive === p ? " active" : ""}`}
                aria-pressed={draft.primitive === p}
                onClick={() => setDraft({ ...draft, primitive: p })}
              >
                {PRIM_LABELS[p]}
              </button>
            ))}
            <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} aria-label="颜色" />
          </div>
        </div>

        <div className="row">
          <button className="primary" onClick={save} disabled={!draft.title.trim()}>
            {editingId ? "保存修改" : "放上基座"}
          </button>
          {editingId && (
            <>
              <button className="secondary" onClick={reset}>添加新的</button>
              <button className="danger" onClick={remove}>移除</button>
            </>
          )}
        </div>

        <EntryList headLabel="藏品" count={objects.length} emptyText="基座还空着。">
          {objects.map((o) => (
            <button
              key={o.id}
              className={`list-item${o.id === editingId ? " active" : ""}`}
              onClick={() => selectEntry(o.id)}
              aria-pressed={o.id === editingId}
            >
              <span className="title">{o.title}</span>
              <span className="date">{new Date(o.createdAt).toLocaleDateString("zh-CN")}</span>
            </button>
          ))}
        </EntryList>
      </div>
    </div>
  );
}
