import { useState } from "react";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import EnterOverlay from "./EnterOverlay";
import Reticle from "./Reticle";
import DockControls from "./DockControls";
import BookEditor from "./BookEditor";
import ObjectForm from "./ObjectForm";
import RecordPanel from "./RecordPanel";
import RecentPanel from "./RecentPanel";

// HUD 编排：入场页（EnterOverlay）→ 漫游层（Reticle + 提示 + DockControls）→
// 聚焦层（返回键 + 幕布 + 按 zone.type 分发的面板）。各块的内部状态在各自文件里。
export default function Hud() {
  const entered = useWorld((s) => s.entered);
  const enter = useWorld((s) => s.enter);
  const entriesCount = useWorld((s) => s.entries.length);
  const focusedZoneId = useWorld((s) => s.focusedZoneId);
  const zone = useWorld((s) => s.world.zones.find((z) => z.id === s.focusedZoneId) ?? null);
  const clearFocus = useWorld((s) => s.clearFocus);
  const startAudio = useAudio((s) => s.start);

  const [showRecent, setShowRecent] = useState(false);

  const doEnter = async () => {
    await startAudio();
    enter();
    (document.querySelector("canvas") as HTMLCanvasElement | null)?.requestPointerLock?.();
  };

  if (!entered) return <EnterOverlay onEnter={doEnter} />;

  return (
    <div className="hud">
      {/* 漫游层 */}
      {!focusedZoneId && (
        <>
          <Reticle />
          <div className="controls-hint">
            {entriesCount === 0
              ? "走到写字台前，写下第一段思考。"
              : "WASD 移动 · 鼠标环视 · 准心对准物件点击"}
          </div>
          <DockControls onToggleRecent={() => setShowRecent((v) => !v)} />
        </>
      )}

      {/* ── 聚焦层：返回键（右上角）+ 透明幕布（点击面板外侧退出）── */}
      {focusedZoneId && (
        <button className="back" onClick={clearFocus} aria-label="返回漫游（ESC）">
          <span className="back-chevron" aria-hidden>‹</span>
          <span className="back-label">返回漫游</span>
          <span className="back-keycap" aria-label="ESC 键">ESC</span>
        </button>
      )}
      {focusedZoneId && <div className="focus-backdrop" onClick={clearFocus} aria-hidden />}

      {/* 左侧面板（z-index:2 在幕布之上）*/}
      {zone && (
        <aside className="dock" aria-label={zone.type === "bookshelf" ? "书房" : zone.type === "objects" ? "物件博物馆" : "黑胶角"}>
          {zone.type === "bookshelf" && <BookEditor zoneId={zone.id} />}
          {zone.type === "objects" && <ObjectForm zoneId={zone.id} />}
          {zone.type === "record" && <RecordPanel zoneId={zone.id} />}
        </aside>
      )}

      {/* 最近面板（右侧）：聚焦时不叠加——否则和左侧面板双 dock 撞在一起、关闭键还被盖住 */}
      {showRecent && !focusedZoneId && (
        <aside className="dock right" aria-label="最近添加">
          <RecentPanel onClose={() => setShowRecent(false)} />
        </aside>
      )}
    </div>
  );
}
