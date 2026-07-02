import { useAudio } from "../audio/useAudio";
import { useEntryForm } from "./useEntryForm";
import EntryList from "./EntryList";

interface TrackDraft {
  title: string;
  body: string;
}

// 黑胶角面板：唱机放的是一套离线打包的公有领域 / CC0 钢琴夜曲（空间化在留声机位、走近变响、
// 放完自动接下一首，可点选切换）——播放/暂停/切换在此。下面"听歌记忆"是你自己收藏的曲子。
// 表单生命周期在 useEntryForm。
export default function RecordPanel({ zoneId }: { zoneId: string }) {
  const { items: tracks, draft, setDraft, editingId, save, reset, remove, selectEntry } = useEntryForm<TrackDraft>({
    zoneId,
    type: "track",
    empty: { title: "", body: "" },
    fromEntry: (e) => ({ title: e.title, body: e.body }),
    toPatch: (d) => {
      const title = d.title.trim();
      return title ? { title, body: d.body.trim() } : null;
    },
  });

  const musicPlaying = useAudio((s) => s.musicPlaying);
  const toggleMusic = useAudio((s) => s.toggleMusic);
  const repertoire = useAudio((s) => s.tracks);
  const currentTrack = useAudio((s) => s.currentTrack);
  const playTrack = useAudio((s) => s.playTrack);
  const nextTrack = useAudio((s) => s.nextTrack);
  const prevTrack = useAudio((s) => s.prevTrack);
  const now = repertoire[currentTrack];

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
              aria-pressed={i === currentTrack}
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
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="凌晨四点的萨克斯" />
        </label>
        <label className="field">
          <span>它让你想起</span>
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="在哪听到、和谁、那天的天气……" />
        </label>

        <div className="row">
          <button className="primary" onClick={save} disabled={!draft.title.trim()}>
            {editingId ? "保存修改" : "收进唱片架"}
          </button>
          {editingId && (
            <>
              <button className="secondary" onClick={reset}>记新的一首</button>
              <button className="danger" onClick={remove}>移除</button>
            </>
          )}
        </div>

        <EntryList headLabel="听歌记忆" count={tracks.length} emptyText="还没有收藏的曲子。">
          {tracks.map((t) => (
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
