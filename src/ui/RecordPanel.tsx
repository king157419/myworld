import { useEffect, useState } from "react";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import { useZoneEntries } from "./useZoneEntries";
import EntryList from "./EntryList";

// 黑胶角面板：唱机放的是一套离线打包的公有领域 / CC0 钢琴夜曲（空间化在留声机位、走近变响、
// 放完自动接下一首，可点选切换）——播放/暂停/切换在此。下面"听歌记忆"是你自己收藏的曲子。
export default function RecordPanel({ zoneId }: { zoneId: string }) {
  const selectedEntryId = useWorld((s) => s.selectedEntryId);
  const addEntry = useWorld((s) => s.addEntry);
  const updateEntry = useWorld((s) => s.updateEntry);
  const deleteEntry = useWorld((s) => s.deleteEntry);
  const selectEntry = useWorld((s) => s.selectEntry);
  const tracks = useZoneEntries(zoneId, "track");

  const musicPlaying = useAudio((s) => s.musicPlaying);
  const toggleMusic = useAudio((s) => s.toggleMusic);
  const repertoire = useAudio((s) => s.tracks);
  const currentTrack = useAudio((s) => s.currentTrack);
  const playTrack = useAudio((s) => s.playTrack);
  const nextTrack = useAudio((s) => s.nextTrack);
  const prevTrack = useAudio((s) => s.prevTrack);
  const now = repertoire[currentTrack];

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
        {/* 正在播放（真实曲库）*/}
        <div className={`now-playing${musicPlaying ? " on" : ""}`}>
          <div className="np-disc" aria-hidden />
          <div className="np-meta">
            <div className="np-title">{now ? now.title : "—"}</div>
            <div className="np-sub">{now ? now.sub : "留声机曲库 · 公有领域"}</div>
          </div>
          <div className="np-controls">
            <button className="np-skip" onClick={prevTrack} title="上一首" aria-label="上一首">‹‹</button>
            <button className="primary np-btn" onClick={toggleMusic} aria-pressed={musicPlaying}>
              {musicPlaying ? "暂停" : "播放"}
            </button>
            <button className="np-skip" onClick={nextTrack} title="下一首" aria-label="下一首">››</button>
          </div>
        </div>

        {/* 曲库：点选切换（放完自动接下一首）*/}
        <EntryList headLabel="曲目单" count={repertoire.length} emptyText="">
          {repertoire.map((t, i) => (
            <button
              key={t.id}
              className={`list-item${i === currentTrack ? " active" : ""}`}
              onClick={() => playTrack(i)}
            >
              <span className="title">
                {i === currentTrack && musicPlaying ? "♪ " : ""}{t.title}
              </span>
              <span className="date">{t.sub}</span>
            </button>
          ))}
        </EntryList>

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

        <EntryList headLabel="听歌记忆" count={tracks.length} emptyText="还没有收藏的曲子。">
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
