import { useEffect, useRef } from "react";
import { useAudio } from "../../audio/useAudio";

// 雾中山居的环境声床（照 attic 的模式：独立 HTMLAudioElement 循环 + 跟随 useAudio.started +
// 卸载即停）。两层：
//   · 雨打瓦（主雨声床，随心境音量）
//   · 竹叶风（更轻的氛围叠加层）
// 古琴《平沙落雁》已并入场景音频档（data.ts 的 COURTYARD_TRACKS，由 audio/useSceneAudio
// 切进 engine 空间化音乐总线 → HRTF @ 古琴位，走近变响；跨场景钢琴渗音随之消失）。
// loft 水床的压/放同样由场景音频档统一应用，此处不再手动切。

function url(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}audio/courtyard/${file}`;
}

/** rainVol / windVol：心境调制的目标音量（0..1）。 */
export function useCourtyardAudio(rainVol: number, windVol: number) {
  const started = useAudio((s) => s.started);
  const muted = useAudio((s) => s.muted);

  // 目标音量的可变引用（心境 / 开关变动即时反映，不重建元素）。
  const rainT = useRef(rainVol);
  const windT = useRef(windVol);
  rainT.current = rainVol;
  windT.current = windVol;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!started) return;

    const rain = new Audio(url("rain-roofs-loop.mp3"));
    const wind = new Audio(url("bamboo-wind.mp3"));
    for (const el of [rain, wind]) {
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
      for (const el of [rain, wind]) {
        try { el.pause(); el.src = ""; } catch { /* ignore */ }
      }
    };
  }, [started]);
}
