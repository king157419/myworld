import { useEffect, useState } from "react";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import { useZoneEntries } from "./useZoneEntries";
import EntryList from "./EntryList";

// 黑胶角面板：唱机放的是「生成式爵士 / lo-fi」（Web Audio 实时合成，真的在响、
// 空间化、永不重复）——播放/暂停在此。唱片架里的是你的'听歌记忆'。
export default function RecordPanel({ zoneId }: { zoneId: string }) {
  const selectedEntryId = useWorld((s) => s.selectedEntryId);
  const addEntry = useWorld((s) => s.addEntry);
  const updateEntry = useWorld((s) => s.updateEntry);
  const deleteEntry = useWorld((s) => s.deleteEntry);
  const selectEntry = useWorld((s) => s.selectEntry);
  const tracks = useZoneEntries(zoneId, "track");

  const musicPlaying = useAudio((s) => s.musicPlaying);
  const toggleMusic = useAudio((s) => s.toggleMusic);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEntryId) return;
    const t = tracks.find((e) => e.id === selectedEntryId);
    if (t) {
      setTitle(t.title);
      setBody(t.body);
      setEditingId(t.id);
    }
  }, [selectedEntryId, tracks]);

  const reset = () => {
    setTitle("");
    setBody("");
    setEditingId(null);
    selectEntry(null);
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    if (editingId) updateEntry(editingId, { title: t, body: body.trim() });
    else addEntry({ zoneId, type: "track", title: t, body: body.trim() });
    reset();
  };

  return (
    <div className="panel">
      <div className="panel-masthead">
        <p className="panel-eyebrow">THE RECORD CORNER — 影音</p>
        <h2 className="panel-title">黑胶角</h2>
      </div>

      <div className="panel-body">
        <div className={`now-playing${musicPlaying ? " on" : ""}`}>
          <div className="np-disc" aria-hidden />
          <div className="np-meta">
            <div className="np-title">生成式爵士 · 雨夜</div>
            <div className="np-sub">Web Audio 实时合成 · 永不重复</div>
          </div>
          <button className="primary np-btn" onClick={toggleMusic} aria-pressed={musicPlaying}>
            {musicPlaying ? "暂停" : "播放"}
          </button>
        </div>

        <p className="panel-hint">
          {editingId ? "正在重读一段听歌的记忆。" : "记下一首歌，和它替你保存的那段心境。"}
        </p>

        <label className="field">
          <span>歌名 / 曲目</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="凌晨四点的萨克斯" />
        </label>
        <label className="field">
          <span>它让你想起</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="在哪听到、和谁、那天的天气……" />
        </label>

        <div className="row">
          <button className="primary" onClick={save} disabled={!title.trim()}>
            {editingId ? "保存修改" : "收进唱片架"}
          </button>
          {editingId && (
            <>
              <button className="secondary" onClick={reset}>记新的一首</button>
              <button className="danger" onClick={() => { deleteEntry(editingId); reset(); }}>移除</button>
            </>
          )}
        </div>

        <EntryList headLabel="唱片架" count={tracks.length} emptyText="还没有收藏的曲子。">
          {tracks.map((t) => (
            <button key={t.id} className={`list-item${t.id === editingId ? " active" : ""}`} onClick={() => selectEntry(t.id)}>
              <span className="title">{t.title}</span>
              <span className="date">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</span>
            </button>
          ))}
        </EntryList>
      </div>
    </div>
  );
}
