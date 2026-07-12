import { useEffect, useRef } from "react";
import { useAudio } from "../../audio/useAudio";
import { audioEngine } from "../../audio/engine";

// 雾中山居的声床（照 attic 的环境声床模式：独立 HTMLAudioElement 循环 + 跟随 useAudio.started +
// 卸载即停 + 压掉 loft 水床）。三层：
//   · 雨打瓦（主雨声床，随心境音量）
//   · 竹叶风（更轻的氛围叠加层）
//   · 古琴《平沙落雁》（zone-record「古琴」的琴音；跟随 useAudio.musicPlaying —— 契约同「唱机在放」）
//
// TODO（下一 wave）：真正的「按场景曲库」——把古琴接进 engine 的空间化音乐总线（HRTF panner @ 古琴位），
//   并在进入本场景时切走 loft 留声机曲库（现留声机音乐总线仍全局播放，跨场景会有极轻的钢琴渗音）。
//   本 wave 先用最简循环播放 + 契约一致的开关。

function url(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}audio/courtyard/${file}`;
}

const GUQIN_VOL = 0.5;

/** rainVol / windVol：心境调制的目标音量（0..1）。 */
export function useCourtyardAudio(rainVol: number, windVol: number) {
  const started = useAudio((s) => s.started);
  const muted = useAudio((s) => s.muted);
  const musicPlaying = useAudio((s) => s.musicPlaying);

  // 目标音量的可变引用（心境 / 开关变动即时反映，不重建元素）。
  const rainT = useRef(rainVol);
  const windT = useRef(windVol);
  rainT.current = rainVol;
  windT.current = windVol;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const musicRef = useRef(musicPlaying);
  musicRef.current = musicPlaying;

  useEffect(() => {
    if (!started) return;
    audioEngine.setWaterGain(0); // 压掉 loft 水床（本场景不在水上）

    const rain = new Audio(url("rain-roofs-loop.mp3"));
    const wind = new Audio(url("bamboo-wind.mp3"));
    const guqin = new Audio(url("guqin-pingsha-luoyan.ogg"));
    for (const el of [rain, wind, guqin]) {
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      void el.play().catch(() => { /* 自动播放被拒：已开声场理应有手势，忽略 */ });
    }

    let alive = true;
    const id = setInterval(() => {
      if (!alive) return;
      const m = mutedRef.current;
      const targets: [HTMLAudioElement, number][] = [
        [rain, m ? 0 : rainT.current],
        [wind, m ? 0 : windT.current],
        [guqin, m || !musicRef.current ? 0 : GUQIN_VOL],
      ];
      for (const [el, target] of targets) {
        const cur = el.volume;
        if (Math.abs(cur - target) < 0.02) {
          el.volume = target;
        } else {
          el.volume = Math.max(0, Math.min(1, cur + Math.sign(target - cur) * 0.03));
        }
      }
    }, 60);

    return () => {
      alive = false;
      clearInterval(id);
      for (const el of [rain, wind, guqin]) {
        try { el.pause(); el.src = ""; } catch { /* ignore */ }
      }
      audioEngine.setWaterGain(audioEngine.baseWaterGain); // 恢复水床，交还给 loft
    };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps
}
