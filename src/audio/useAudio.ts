import { create } from "zustand";
import { audioEngine } from "./engine";

// 声场的 UI 状态（瞬态，不持久化）。与世界 store 解耦，避免把 AudioContext 引入
// 数据层 / 单测。引擎持有真实音频图；这里只镜像可见状态供 UI 订阅。
export interface TrackInfo {
  id: string;
  title: string;
  sub: string;
}

interface AudioState {
  started: boolean;
  musicPlaying: boolean;
  muted: boolean;
  /** 留声机曲库（PD/CC0，离线打包）。 */
  tracks: TrackInfo[];
  /** 当前曲目下标。 */
  currentTrack: number;
  start: () => Promise<void>;
  setMusic: (on: boolean) => void;
  toggleMusic: () => void;
  toggleMute: () => void;
  /** 点选某曲目播放（并确保在放）。 */
  playTrack: (i: number) => void;
  /** 下一首 / 上一首。 */
  nextTrack: () => void;
  prevTrack: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  started: false,
  musicPlaying: false,
  muted: false,
  tracks: audioEngine.trackList.map((t) => ({ id: t.id, title: t.title, sub: t.sub })),
  currentTrack: 0,

  start: async () => {
    if (get().started) return;
    // 引擎自动换曲（放完接下一首）时回写当前曲目，UI 高亮跟随。
    audioEngine.setOnTrackChange((i) => set({ currentTrack: i }));
    await audioEngine.start();
    audioEngine.setMusicPlaying(true);
    set({ started: true, musicPlaying: true, currentTrack: audioEngine.currentTrack });
  },

  setMusic: (on) => {
    audioEngine.setMusicPlaying(on);
    set({ musicPlaying: on });
  },
  toggleMusic: () => get().setMusic(!get().musicPlaying),

  toggleMute: () => {
    const m = !get().muted;
    audioEngine.setMuted(m);
    set({ muted: m });
  },

  playTrack: (i) => {
    audioEngine.playTrack(i);
    audioEngine.setMusicPlaying(true);
    set({ currentTrack: i, musicPlaying: true });
  },
  nextTrack: () => {
    audioEngine.next();
    audioEngine.setMusicPlaying(true);
    set({ currentTrack: audioEngine.currentTrack, musicPlaying: true });
  },
  prevTrack: () => {
    audioEngine.prev();
    audioEngine.setMusicPlaying(true);
    set({ currentTrack: audioEngine.currentTrack, musicPlaying: true });
  },
}));

// 开发期 HMR：模块替换前拆掉旧引擎（定时器 + AudioContext），避免重载累积。
if (import.meta.hot) import.meta.hot.dispose(() => audioEngine.dispose());
