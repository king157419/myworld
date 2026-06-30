import { useEffect, useState } from "react";
import type { Primitive } from "../config/types";
import { useWorld } from "../store/useWorld";
import { useZoneEntries } from "./useZoneEntries";
import EntryList from "./EntryList";

const PRIMS: { value: Primitive; label: string }[] = [
  { value: "box", label: "方" },
  { value: "cylinder", label: "柱" },
  { value: "sphere", label: "球" },
];

// 物件博物馆面板：添加物件（标题 + 描述 + 几何体 + 颜色）→ 基座上出现它，可旋转端详。
export default function ObjectForm({ zoneId }: { zoneId: string }) {
  const selectedEntryId = useWorld((s) => s.selectedEntryId);
  const addEntry = useWorld((s) => s.addEntry);
  const updateEntry = useWorld((s) => s.updateEntry);
  const deleteEntry = useWorld((s) => s.deleteEntry);
  const selectEntry = useWorld((s) => s.selectEntry);
  const objects = useZoneEntries(zoneId, "object");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [primitive, setPrimitive] = useState<Primitive>("box");
  const [color, setColor] = useState("#caa472");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEntryId) return;
    const o = objects.find((e) => e.id === selectedEntryId);
    if (o) {
      setTitle(o.title);
      setBody(o.body);
      setPrimitive(o.primitive ?? "box");
      setColor(o.color ?? "#caa472");
      setEditingId(o.id);
    }
  }, [selectedEntryId, objects]);

  const reset = () => {
    setTitle("");
    setBody("");
    setPrimitive("box");
    setColor("#caa472");
    setEditingId(null);
    selectEntry(null);
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    if (editingId) {
      updateEntry(editingId, { title: t, body: body.trim(), primitive, color });
    } else {
      addEntry({ zoneId, type: "object", title: t, body: body.trim(), primitive, color });
    }
    reset();
  };

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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="那副陪了三年的耳机" />
        </label>
        <label className="field">
          <span>来历</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="它从哪来，为什么在乎它……" />
        </label>
        <div className="field">
          <span id="prim-label">形状</span>
          <div className="row" role="group" aria-labelledby="prim-label">
            {PRIMS.map((p) => (
              <button
                key={p.value}
                className={`chip${primitive === p.value ? " active" : ""}`}
                aria-pressed={primitive === p.value}
                onClick={() => setPrimitive(p.value)}
              >
                {p.label}
              </button>
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="颜色" />
          </div>
        </div>

        <div className="row">
          <button className="primary" onClick={save} disabled={!title.trim()}>
            {editingId ? "保存修改" : "放上基座"}
          </button>
          {editingId && (
            <>
              <button className="secondary" onClick={reset}>添加新的</button>
              <button
                className="danger"
                onClick={() => {
                  deleteEntry(editingId);
                  reset();
                }}
              >
                移除
              </button>
            </>
          )}
        </div>

        <EntryList headLabel="藏品" count={objects.length} emptyText="基座还空着。">
          {objects.map((o) => (
            <button
              key={o.id}
              className={`list-item${o.id === editingId ? " active" : ""}`}
              onClick={() => selectEntry(o.id)}
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
