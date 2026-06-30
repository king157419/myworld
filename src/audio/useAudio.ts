import { create } from "zustand";
import { audioEngine } from "./engine";

// 声场的 UI 状态（瞬态，不持久化）。与世界 store 解耦，避免把 AudioContext 引入
// 数据层 / 单测。引擎持有真实音频图；这里只镜像可见状态供 UI 订阅。
interface AudioState {
  started: boolean;
  musicPlaying: boolean;
  muted: boolean;
  start: () => Promise<void>;
  setMusic: (on: boolean) => void;
  toggleMusic: () => void;
  toggleMute: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  started: false,
  musicPlaying: false,
  muted: false,

  start: async () => {
    if (get().started) return;
    await audioEngine.start();
    audioEngine.setMusicPlaying(true);
    set({ started: true, musicPlaying: true });
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
}));

// 开发期 HMR：模块替换前拆掉旧引擎（定时器 + AudioContext），避免重载累积。
if (import.meta.hot) import.meta.hot.dispose(() => audioEngine.dispose());
