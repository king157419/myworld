import { useRef, useState } from "react";
import { MOOD_ORDER, MOOD_PRESETS } from "../config/moods";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import { persistNow } from "../data/db";
import { downloadWorld, parseSavedWorld, ImportError } from "../data/io";
import BookEditor from "./BookEditor";
import ObjectForm from "./ObjectForm";
import RecordPanel from "./RecordPanel";
import RecentPanel from "./RecentPanel";

// 心境表单源在 config/moods.ts（Lighting/Atmosphere 消费同一份，按钮不再是视觉空操作）。
const MOODS = MOOD_ORDER.map((value) => ({ value, label: MOOD_PRESETS[value].label, fog: MOOD_PRESETS[value].fog }));

export default function Hud() {
  const entered        = useWorld((s) => s.entered);
  const enter          = useWorld((s) => s.enter);
  const world          = useWorld((s) => s.world);
  const entries        = useWorld((s) => s.entries);
  const focusedZoneId  = useWorld((s) => s.focusedZoneId);
  const hoveredZoneId  = useWorld((s) => s.hoveredZoneId);
  const hoveredInReach = useWorld((s) => s.hoveredInReach);
  const zone           = useWorld((s) => s.world.zones.find((z) => z.id === s.focusedZoneId) ?? null);
  const clearFocus     = useWorld((s) => s.clearFocus);
  const setMood        = useWorld((s) => s.setMood);
  const hydrate        = useWorld((s) => s.hydrate);

  const startAudio     = useAudio((s) => s.start);
  const musicPlaying   = useAudio((s) => s.musicPlaying);
  const toggleMusic    = useAudio((s) => s.toggleMusic);
  const nextTrack      = useAudio((s) => s.nextTrack);
  const muted          = useAudio((s) => s.muted);
  const toggleMute     = useAudio((s) => s.toggleMute);

  const [showRecent, setShowRecent] = useState(false);
  const [notice, setNotice]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const hoveredLabel = world.zones.find((z) => z.id === hoveredZoneId)?.label;

  const doEnter = async () => {
    await startAudio();
    enter();
    (document.querySelector("canvas") as HTMLCanvasElement | null)?.requestPointerLock?.();
  };

  const onExport = () => downloadWorld(world, entries, Date.now());

  const onImportFile = async (file: File) => {
    try {
      const text  = await file.text();
      const saved = parseSavedWorld(text);
      hydrate(saved.world, saved.entries);
      await persistNow(saved.world, saved.entries);
      setNotice("世界已导入并复现。");
    } catch (err) {
      setNotice(
        err instanceof ImportError
          ? `导入失败：${err.message}`
          : "导入失败：文件无法读取。"
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setNotice(""), 3500);
    }
  };

  /* ── 入场遮罩 · 题词页 ── */
  if (!entered) {
    return (
      <div className="overlay enter-overlay">
        <div className="enter-card">
          {/* 眉题：华文仿宋，像内页刊头 */}
          <span className="brand-eyebrow">潮汐图书馆　The Tide Library</span>

          {/* 大标题 — 华文中宋大字 */}
          <h1 className="brand-xl">灵境</h1>

          {/* 琥珀横线 — 左对齐 */}
          <div className="enter-rule" aria-hidden />

          {/* 场景描述 — 华文楷体，散文语感 */}
          <p className="enter-desc">
            夜里，一座暖灯的读书回廊，浮在一片映满星空的镜面水上。走上去——脚下是整片星海，每一步都荡开一圈涟漪。一墙旧书，几座浮岛，一台留声机正低低地转。
          </p>

          {/* 进入按钮 */}
          <button className="enter-btn" onClick={doEnter}>
            进入
          </button>

          {/* 出版信息行 */}
          <span className="brand-sub">INNERSCAPE · OFFLINE · PERSONAL</span>

          {/* 键位提示 */}
          <div className="enter-hint">WASD 行走 · 鼠标环视 · 建议戴耳机</div>
        </div>
      </div>
    );
  }

  /* ── 漫游 / 聚焦 HUD ── */
  return (
    <div className="hud">
      {/* 准心 + 悬停标签（仅漫游态）*/}
      {!focusedZoneId && (
        <div className="crosshair-wrap" aria-hidden>
          <div className={`crosshair${hoveredZoneId ? (hoveredInReach ? " active" : " spotted") : ""}`} />
          {/* 左右刻度（CSS 伪元素需要一个实体节点做参照）*/}
          <span className="ch-tick-lr" />
          {hoveredLabel && (
            <div className={`reticle-label${hoveredInReach ? "" : " far"}`}>
              <span className="rl-zone">{hoveredLabel}</span>
              <span className="rl-hint">{hoveredInReach ? "ENTER" : "走近"}</span>
            </div>
          )}
        </div>
      )}

      {/* 漫游提示 */}
      {!focusedZoneId && (
        <div className="controls-hint">
          {entries.length === 0
            ? "走到写字台前，写下第一段思考。"
            : "WASD 移动 · 鼠标环视 · 准心对准物件点击"}
        </div>
      )}

      {/* 底部控制簇 · 版权页条（仅漫游态）*/}
      {!focusedZoneId && (
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
          <button
            className="ctl"
            onClick={toggleMute}
            aria-pressed={muted}
            title="声音 开·关"
          >
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

          <button className="ctl" onClick={() => setShowRecent((v) => !v)}>最近</button>
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
      )}

      {/* 通知条 */}
      {notice && <div className="notice" role="status">{notice}</div>}

      {/* ── 退出按钮（右上角，解决"不知道怎么退"的问题）── */}
      {focusedZoneId && (
        <button
          className="back"
          onClick={clearFocus}
          aria-label="返回漫游（ESC）"
        >
          <span className="back-chevron" aria-hidden>‹</span>
          <span className="back-label">返回漫游</span>
          <span className="back-keycap" aria-label="ESC 键">ESC</span>
        </button>
      )}

      {/* 聚焦时的透明幕布（点击 panel 外侧退出）*/}
      {focusedZoneId && (
        <div
          className="focus-backdrop"
          onClick={clearFocus}
          aria-hidden
        />
      )}

      {/* 左侧面板（z-index:2 在幕布之上）*/}
      {zone && (
        <aside className="dock" aria-label={zone.type === "bookshelf" ? "书房" : zone.type === "objects" ? "物件博物馆" : "黑胶角"}>
          {zone.type === "bookshelf" && <BookEditor zoneId={zone.id} />}
          {zone.type === "objects"   && <ObjectForm zoneId={zone.id} />}
          {zone.type === "record"    && <RecordPanel zoneId={zone.id} />}
        </aside>
      )}

      {/* 最近面板（右侧）*/}
      {showRecent && (
        <aside className="dock right" aria-label="最近添加">
          <RecentPanel onClose={() => setShowRecent(false)} />
        </aside>
      )}
    </div>
  );
}
