import { useEffect, useMemo, useRef, useState } from "react";
import { useWorld } from "../store/useWorld";
import { tidePhase } from "../theme";
import type { Entry } from "../config/types";

// ─────────────────────────────────────────────────────────────────────────────
// MemoryScope — 望远镜"看记忆"目镜叠层。
//
// 凑近望远镜（PlayerControls 已把相机送到目镜后、望向夜空），从圆形目镜里望出去：
// 你写下的每一段思考（含导入的旧日记）是夜空里的一颗暖星，沿时间铺成一条"记忆星河"。
// 同一股把脚下水面缓缓抬落的**潮汐**，也载着你在自己的时间轴上前后穿行（#4 时间旅行）——
// 落潮回到最早、涨潮来到最近；也可以直接拖时间刻度手动穿越。对准中心的那颗星就是
// 你此刻"看着"的记忆，点它即可读到原文。
//
// 纯数据驱动：只读 type==="thought" 的 Entry，绝不把内容写死。星河可由数据完整重建。
// ─────────────────────────────────────────────────────────────────────────────

function hash01(id: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return ((h >>> 0) % 100000) / 100000;
}

interface Star {
  entry: Entry;
  ti: number; // 归一时间 0..1（最早→最近）
  vy: number; // 纵向散布 -0.9..0.9
  jx: number; // 横向抖动 -1..1（同期记忆散成星座、不叠成一条竖线）
  ph: number; // 闪烁相位
}

const WINDOW = 0.085; // 聚焦半宽（时间归一单位）：|ti-p| 在此内的记忆最亮
const fmtDate = (t: number) => new Date(t).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

export default function MemoryScope() {
  const thoughts = useWorld((s) => s.entries);

  // 记忆星：thought，按时间升序 → 归一时间。useMemo 里 filter（zustand v5 选择器规矩）。
  const stars = useMemo<Star[]>(() => {
    const list = thoughts.filter((e) => e.type === "thought").sort((a, b) => a.createdAt - b.createdAt);
    if (!list.length) return [];
    const t0 = list[0].createdAt;
    const t1 = list[list.length - 1].createdAt;
    const span = Math.max(1, t1 - t0);
    return list.map((e) => ({
      entry: e,
      ti: list.length === 1 ? 0.5 : (e.createdAt - t0) / span,
      vy: (hash01(e.id, 7) * 2 - 1) * 0.9,
      jx: hash01(e.id, 31) * 2 - 1,
      ph: hash01(e.id, 19) * Math.PI * 2,
    }));
  }, [thoughts]);

  const range = useMemo(() => {
    if (!stars.length) return null;
    return { t0: stars[0].entry.createdAt, t1: stars[stars.length - 1].entry.createdAt };
  }, [stars]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const pRef = useRef(0.5); // 聚焦时间 0..1
  const autoRef = useRef(true); // 随潮汐漂移
  const screenPos = useRef<{ x: number; y: number; star: Star }[]>([]);
  const startT = useRef<number>(0);

  const [selected, setSelected] = useState<Entry | null>(null);
  const [auto, setAuto] = useState(true);
  const [eraLabel, setEraLabel] = useState("");
  const [aimTitle, setAimTitle] = useState("");
  const selRef = useRef<Entry | null>(null);
  selRef.current = selected;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let labelAccum = 0;
    // 用挂载时刻做相位基准，避免依赖被禁的 Date.now()/rAF 起点漂移（这里用 performance.now）。
    startT.current = performance.now() / 1000;

    const draw = () => {
      const now = performance.now() / 1000;
      const t = now - startT.current;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = rect.width, H = rect.height;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;

      // 聚焦时间 p：随潮汐（与水面同一股潮汐相位）自动漂移，或手动拖动。读记忆卡时暂停漂移。
      if (autoRef.current && !selRef.current) pRef.current = tidePhase(t);
      const p = pRef.current;

      // 极淡的星云底：中心一圈暖光，四周入夜。
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
      bg.addColorStop(0, "rgba(30,34,54,0.35)");
      bg.addColorStop(0.5, "rgba(10,14,30,0.18)");
      bg.addColorStop(1, "rgba(2,3,10,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const SPREAD = W * 2.6; // 时间→水平像素
      const BAND = H * 0.30;
      screenPos.current = [];
      const pts: { x: number; y: number; b: number }[] = [];
      let aim: { star: Star; d: number } | null = null;

      const JIT = W * 0.11; // 横向抖动幅度（保时间轴为主，同期记忆散开成星座）
      for (const st of stars) {
        const d = st.ti - p;
        const x = cx + d * SPREAD + st.jx * JIT;
        if (x < -40 || x > W + 40) continue;
        const y = cy + st.vy * BAND + Math.sin(t * 0.6 + st.ph) * 3;
        const b = Math.exp(-((d / WINDOW) ** 2));
        pts.push({ x, y, b });
        screenPos.current.push({ x, y, star: st });
        if (!aim || Math.abs(d) < Math.abs(aim.d)) aim = { star: st, d };

        // 光晕
        const alpha = 0.16 + 0.84 * b;
        const size = 1.1 + 3.4 * b;
        const g = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
        g.addColorStop(0, `rgba(255,224,166,${0.5 * alpha})`);
        g.addColorStop(0.4, `rgba(255,158,82,${0.22 * alpha})`);
        g.addColorStop(1, "rgba(255,158,82,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size * 6, 0, Math.PI * 2);
        ctx.fill();
        // 星核
        ctx.fillStyle = `rgba(255,240,214,${Math.min(1, alpha * 1.1)})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 记忆之线：按时间把相邻的星串起来（一条淡淡的、串起一生的线）。
      if (pts.length > 1) {
        ctx.strokeStyle = "rgba(217,180,122,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();
      }

      // 中心准星：一圈很轻的瞄环，指示"你正看着这颗"。
      ctx.strokeStyle = "rgba(217,180,122,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.stroke();
      if (aim) {
        const a = aim as { star: Star; d: number };
        const x = cx + a.d * SPREAD + a.star.jx * JIT;
        const y = cy + a.star.vy * BAND;
        ctx.strokeStyle = "rgba(255,224,166,0.6)";
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 手柄跟随 p（自动漂移时不触发 React 重渲，直接改样式）。
      if (handleRef.current) handleRef.current.style.left = `${(p * 100).toFixed(2)}%`;

      // 节流更新纪元/瞄准标签（~5Hz）。
      labelAccum += 1;
      if (labelAccum >= 12 && range) {
        labelAccum = 0;
        setEraLabel(fmtDate(range.t0 + (range.t1 - range.t0) * p));
        setAimTitle(aim ? (aim as { star: Star }).star.entry.title : "");
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stars, range]);

  // 点击目镜：命中最近的星（26px 内）→ 读这段记忆。
  const onCanvasPointer = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best: { d: number; star: Star } | null = null;
    for (const sp of screenPos.current) {
      const d = Math.hypot(sp.x - mx, sp.y - my);
      if (d < 26 && (!best || d < best.d)) best = { d, star: sp.star };
    }
    if (best) setSelected(best.star.entry);
  };

  // 拖时间刻度：手动穿越（关掉随潮汐）。
  const scrubTo = (clientX: number, trackEl: HTMLElement) => {
    const rect = trackEl.getBoundingClientRect();
    pRef.current = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (autoRef.current) { autoRef.current = false; setAuto(false); }
  };
  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e.clientX, e.currentTarget);
  };
  const onTrackMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons) scrubTo(e.clientX, e.currentTarget);
  };
  const toggleAuto = () => {
    const v = !autoRef.current;
    autoRef.current = v;
    setAuto(v);
  };

  const empty = stars.length === 0;

  return (
    <div className="scope-overlay">
      {/* 目镜圆窗 */}
      <div className="scope-porthole">
        <canvas ref={canvasRef} className="scope-canvas" onPointerDown={onCanvasPointer} />
        <div className="scope-vignette" aria-hidden />
        <div className="scope-ring" aria-hidden />
        {empty && (
          <div className="scope-empty">
            夜空还很干净。<br />先到写作台写下一段思考——它会成为这里的一颗星。
          </div>
        )}
      </div>

      {/* 眉题 */}
      <div className="scope-masthead">
        <p className="scope-eyebrow">THE MEMORY SCOPE · 看记忆</p>
        <h2 className="scope-title">{eraLabel || "记忆星河"}</h2>
        {!empty && <p className="scope-aim">{aimTitle ? `◎ ${aimTitle}` : "把某颗星移到准星中央"}</p>}
      </div>

      {/* 时间刻度 + 随潮汐 */}
      {!empty && (
        <div className="scope-dial">
          <button className={`scope-tide${auto ? " on" : ""}`} onClick={toggleAuto}>
            {auto ? "◐ 随潮汐漂移" : "◑ 手动穿越"}
          </button>
          <div className="scope-track" onPointerDown={onTrackDown} onPointerMove={onTrackMove}>
            <div className="scope-track-line" aria-hidden />
            <div ref={handleRef} className="scope-handle" aria-hidden />
            <span className="scope-t0">{range ? fmtDate(range.t0) : ""}</span>
            <span className="scope-t1">最近</span>
          </div>
          <p className="scope-hint">同一股潮汐载你在时间里前后穿行 · 点星读记忆 · ESC 离开目镜</p>
        </div>
      )}

      {/* 读记忆卡 */}
      {selected && (
        <div className="scope-card">
          <div className="scope-card-date">{fmtDate(selected.createdAt)}</div>
          <h3 className="scope-card-title">{selected.title || "无题"}</h3>
          <p className="scope-card-body">{selected.body}</p>
          <button className="scope-card-close" onClick={() => setSelected(null)}>回到星河</button>
        </div>
      )}
    </div>
  );
}
