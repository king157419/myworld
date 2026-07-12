import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAudio } from "../../audio/useAudio";
import { TRACKS, type TrackMeta } from "../../audio/engine";
import { useWorld } from "../../store/useWorld";

// 雨夜阁楼的声音接线（上一 wave 留下的收尾）：
//   1) 唱机曲库换成三首 Kevin MacLeod 爵士（CC BY 4.0，署名见 public/audio/CREDITS.md）——
//      走 engine 既有曲库机制（按需解码 / 自动接续 / 坏轨跳过 / 空间化留声机），离场恢复 loft 夜曲。
//   2) musicPlaying 时叠加低音量黑胶底噪 vinyl-crackle（CC0）循环。
//   3) 行走经过第 7 级踏步区间触发一次木地板吱呀（floor-creak，CC0），防抖、重复经过再响不连发——
//      对应个人印记 attic-t5「第七级楼梯会响」的彩蛋。

/** public/audio/attic/ 下相对路径拼 BASE_URL（兼容 dev / 生产子路径）。 */
function atticAudioUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}audio/attic/${file}`;
}

// 阁楼唱机曲库：三首爵士（file 走 attic/ 子目录）。空间化在 GRAMOPHONE 位（走近变响），放完自动接续。
export const ATTIC_TRACKS: TrackMeta[] = [
  { id: "jazz-late-night-radio", title: "深夜电台", sub: "Kevin MacLeod (incompetech.com) · CC BY 4.0", file: "attic/jazz-late-night-radio.mp3" },
  { id: "jazz-sidewalk-shade", title: "Sidewalk Shade", sub: "Kevin MacLeod (incompetech.com) · CC BY 4.0", file: "attic/jazz-sidewalk-shade.mp3" },
  { id: "jazz-backbay-lounge", title: "Backbay Lounge", sub: "Kevin MacLeod (incompetech.com) · CC BY 4.0", file: "attic/jazz-backbay-lounge.mp3" },
];

/** 进 attic → 唱机曲库切爵士；离场（Stage 卸载）→ 恢复 loft 默认夜曲。 */
export function useAtticLibrary(): void {
  const setLibrary = useAudio((s) => s.setLibrary);
  useEffect(() => {
    setLibrary(ATTIC_TRACKS);
    return () => setLibrary(TRACKS);
  }, [setLibrary]);
}

/** 黑胶底噪：musicPlaying（且已开声场、未静音）时叠一层低音量 crackle 循环。 */
export function useVinylCrackle(): void {
  const started = useAudio((s) => s.started);
  const playing = useAudio((s) => s.musicPlaying);
  const muted = useAudio((s) => s.muted);
  const elRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!started) return;
    const el = new Audio(atticAudioUrl("vinyl-crackle.mp3"));
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    elRef.current = el;
    void el.play().catch(() => { /* 自动播放被拒：已开声场理应有手势，忽略 */ });
    return () => {
      try { el.pause(); el.src = ""; } catch { /* ignore */ }
      elRef.current = null;
    };
  }, [started]);

  useEffect(() => {
    const el = elRef.current;
    if (el) el.volume = !muted && playing ? 0.12 : 0;
  }, [playing, muted, started]);
}

// 第 7 级踏步的 z 区间（data.ts：N=12 级，zBot=2.2→zTop=-2.6，treadDz=0.4；第 7 级 i=6 → z∈[-0.6,-0.2]）。
const CREAK_Z_LO = -0.6;
const CREAK_Z_HI = -0.2;

/** 第七级楼梯吱呀：相机 z 进入第 7 级区间触发一次；离带（带滞回）后重新武装，重复经过再响不连发。 */
export function StairCreak(): null {
  const armed = useRef(true);
  const elRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = new Audio(atticAudioUrl("floor-creak-single.mp3"));
    el.preload = "auto";
    el.volume = 0.5;
    elRef.current = el;
    return () => {
      try { el.pause(); el.src = ""; } catch { /* ignore */ }
      elRef.current = null;
    };
  }, []);

  useFrame((state) => {
    const s = useWorld.getState();
    if (!s.entered || s.focusedZoneId) return; // 只在漫游时（非入场/聚焦飞行）判定
    const z = state.camera.position.z;
    const inBand = z > CREAK_Z_LO && z < CREAK_Z_HI;
    if (inBand) {
      if (armed.current) {
        armed.current = false;
        const el = elRef.current;
        if (el) { try { el.currentTime = 0; void el.play().catch(() => {}); } catch { /* ignore */ } }
      }
    } else if (z > CREAK_Z_HI + 0.12 || z < CREAK_Z_LO - 0.12) {
      armed.current = true; // 滞回：离带一段距离才重新武装，避免边界抖动连发
    }
  });

  return null;
}
