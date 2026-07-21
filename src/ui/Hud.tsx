import { useEffect, useRef, useState } from "react";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";
import EnterOverlay from "./EnterOverlay";
import Reticle from "./Reticle";
import DockControls from "./DockControls";
import BookEditor from "./BookEditor";
import ObjectForm from "./ObjectForm";
import RecordPanel from "./RecordPanel";
import RecentPanel from "./RecentPanel";
import MemoryScope from "./MemoryScope";

// HUD 编排：入场页（EnterOverlay）→ 漫游层（Reticle + 提示 + DockControls）→
// 聚焦层（返回键 + 幕布 + 按 zone.type 分发的面板）。各块的内部状态在各自文件里。
export default function Hud() {
  const entered = useWorld((s) => s.entered);
  const enter = useWorld((s) => s.enter);
  const entriesCount = useWorld((s) => s.entries.length);
  const focusedZoneId = useWorld((s) => s.focusedZoneId);
  const zone = useWorld((s) => s.world.zones.find((z) => z.id === s.focusedZoneId) ?? null);
  const clearFocus = useWorld((s) => s.clearFocus);
  const telescopeActive = useWorld((s) => s.telescopeActive);
  const closeTelescope = useWorld((s) => s.closeTelescope);
  const editorDirty = useWorld((s) => s.editorDirty);
  const style = useWorld((s) => s.world.room.style);
  const startAudio = useAudio((s) => s.start);

  const [showRecent, setShowRecent] = useState(false);

  // 切场景黑幕：style 变化瞬间盖上纯黑，下一拍 0.6s 淡出——盖住"一帧换了整个世界"的瞬跳。
  // 首挂载不放（入场页/boot 提示已经盖着）。用内联过渡而非样式表，避免依赖 CSS 文件改动。
  const [veil, setVeil] = useState(false);
  const veilFirst = useRef(true);
  useEffect(() => {
    if (veilFirst.current) {
      veilFirst.current = false;
      return;
    }
    setVeil(true);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVeil(false)));
    return () => cancelAnimationFrame(raf);
  }, [style]);

  // 关闭编辑面板前的丢稿确认（Esc 路径在 input.ts 做同样的事；这里管暗幕与返回键）。
  const requestClose = () => {
    if (editorDirty && !window.confirm("有未保存的内容，确定离开吗？")) return;
    clearFocus();
  };

  const doEnter = async () => {
    await startAudio();
    enter();
    (document.querySelector("canvas") as HTMLCanvasElement | null)?.requestPointerLock?.();
  };

  if (!entered) return <EnterOverlay onEnter={doEnter} />;

  return (
    <div className="hud">
      {/* 漫游层（聚焦某区 / 凑望远镜看记忆时都收起）*/}
      {!focusedZoneId && !telescopeActive && (
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

      {/* ── 聚焦层：返回键（右上角）+ 透明幕布（点击面板外侧退出；有未保存草稿先确认）── */}
      {focusedZoneId && (
        <button className="back" onClick={requestClose} aria-label="返回漫游（ESC）">
          <span className="back-chevron" aria-hidden>‹</span>
          <span className="back-label">返回漫游</span>
          <span className="back-keycap" aria-label="ESC 键">ESC</span>
        </button>
      )}
      {focusedZoneId && <div className="focus-backdrop" onClick={requestClose} aria-hidden />}

      {/* ── 望远镜"看记忆"层：返回键 + 目镜叠层（不占用侧栏面板/数据契约）── */}
      {telescopeActive && (
        <button className="back" onClick={closeTelescope} aria-label="离开目镜（ESC）">
          <span className="back-chevron" aria-hidden>‹</span>
          <span className="back-label">离开目镜</span>
          <span className="back-keycap" aria-label="ESC 键">ESC</span>
        </button>
      )}
      {telescopeActive && <MemoryScope />}

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

      {/* 切场景黑幕（内联样式，见上方 veil 注释）。pointer-events 永远放行。 */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          pointerEvents: "none",
          zIndex: 40,
          opacity: veil ? 1 : 0,
          transition: veil ? "none" : "opacity 0.6s ease",
        }}
      />
    </div>
  );
}
