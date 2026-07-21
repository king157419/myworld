import { useEffect, useRef } from "react";
import { useAudio } from "../../audio/useAudio";

// 雨夜阁楼的室内雨声床：进 attic 且已开声场 → 循环播放「关窗室内听大雨」，离开（Stage 卸载）→ 停。
// 用独立 HTMLAudioElement 挂在 Stage 里（不动 engine 核心的音乐/水声图），跟随 useAudio.started。
// （loft 水床的压/放已并入场景音频档，由 audio/useSceneAudio 统一应用，此处不再手动切。）

function rainUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}audio/attic/rain-interior.mp3`;
}

/** volume: 目标音量（心境调制，0..1）。muted 时静音。 */
export function useAtticRain(volume: number) {
  const started = useAudio((s) => s.started);
  const muted = useAudio((s) => s.muted);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const volRef = useRef(volume);
  volRef.current = volume;

  // 起播 / 停播：只在「已开声场」翻真时建元素；Stage 卸载时停。
  useEffect(() => {
    if (!started) return;
    let alive = true;
    const el = new Audio(rainUrl());
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    elRef.current = el;
    void el.play().catch(() => { /* 自动播放被拒：已开声场理应有手势，忽略 */ });
    // 渐入到当前目标
    const id = setInterval(() => {
      if (!alive) return;
      const target = muted ? 0 : volRef.current;
      const v = Math.min(target, el.volume + 0.03);
      el.volume = v;
      if (v >= target) clearInterval(id);
    }, 60);
    return () => {
      alive = false;
      clearInterval(id);
      try {
        el.pause();
        el.src = "";
      } catch { /* ignore */ }
      elRef.current = null;
    };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // 音量 / 静音随心境或全局静音更新（不重建元素）。
  useEffect(() => {
    const el = elRef.current;
    if (el) el.volume = muted ? 0 : volume;
  }, [volume, muted]);
}
