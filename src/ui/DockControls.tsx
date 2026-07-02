import { useRef, useState } from "react";
import { MOOD_ORDER, MOOD_PRESETS } from "../config/moods";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import { persistNow } from "../data/db";
import { downloadWorld, parseSavedWorld, ImportError } from "../data/io";

// 底部控制簇 · 版权页条（仅漫游态）：黑胶播放/切歌、声音、心境、最近/导出/导入。
// 心境表单源在 config/moods.ts（Lighting/Atmosphere 消费同一份，按钮不是视觉空操作）。
const MOODS = MOOD_ORDER.map((value) => ({ value, label: MOOD_PRESETS[value].label, fog: MOOD_PRESETS[value].fog }));

export default function DockControls({ onToggleRecent }: { onToggleRecent: () => void }) {
  const world = useWorld((s) => s.world);
  const entries = useWorld((s) => s.entries);
  const setMood = useWorld((s) => s.setMood);
  const hydrate = useWorld((s) => s.hydrate);

  const musicPlaying = useAudio((s) => s.musicPlaying);
  const toggleMusic = useAudio((s) => s.toggleMusic);
  const nextTrack = useAudio((s) => s.nextTrack);
  const muted = useAudio((s) => s.muted);
  const toggleMute = useAudio((s) => s.toggleMute);

  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 通知条：清掉上一个定时器再排新的——否则旧导入的 3.5s 定时器会把新导入的提示提前抹掉。
  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3500);
  };

  const onExport = () => downloadWorld(world, entries, Date.now());

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const saved = parseSavedWorld(text);
      hydrate(saved.world, saved.entries);
      await persistNow(saved.world, saved.entries);
      showNotice("世界已导入并复现。");
    } catch (err) {
      showNotice(err instanceof ImportError ? `导入失败：${err.message}` : "导入失败：文件无法读取。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="dock-controls" role="toolbar" aria-label="播放与心境控制">
        {/* 黑胶播放/暂停 */}
        <button
          className={`ctl${musicPlaying ? " on" : ""}`}
          onClick={toggleMusic}
          aria-pressed={musicPlaying}
          title="黑胶播放 / 暂停"
        >
          {musicPlaying ? "暂停" : "播放黑胶"}
        </button>
        <button className="ctl" onClick={nextTrack} title="下一首">下一首</button>

        <span className="ctl-divider" aria-hidden />

        {/* 声音开关 */}
        <button className="ctl" onClick={toggleMute} aria-pressed={muted} title="声音 开·关">
          声音 {muted ? "关" : "开"}
        </button>

        <span className="ctl-divider" aria-hidden />

        {/* 心境 */}
        <span className="mood-eyebrow" aria-hidden>心境</span>
        <div className="moods" role="group" aria-label="房间心境">
          {MOODS.map((m) => (
            <button
              key={m.value}
              className={`chip${world.room.mood.lighting === m.value ? " active" : ""}`}
              aria-pressed={world.room.mood.lighting === m.value}
              onClick={() => setMood({ lighting: m.value, intensity: 1, fog: m.fog })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <span className="ctl-divider" aria-hidden />

        <button className="ctl" onClick={onToggleRecent}>最近</button>
        <button className="ctl" onClick={onExport}>导出</button>
        <button className="ctl" onClick={() => fileRef.current?.click()}>导入</button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
          }}
        />
      </div>

      {/* 通知条 */}
      {notice && <div className="notice" role="status">{notice}</div>}
    </>
  );
}
