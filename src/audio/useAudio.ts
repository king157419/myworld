import { create } from "zustand";
import { audioEngine, type TrackMeta } from "./engine";

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
  /** 按场景切换曲库（loft 夜曲 / attic 爵士）：同步 UI 曲目单 + 引擎换库起播。 */
  setLibrary: (tracks: TrackMeta[]) => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  started: false,
  musicPlaying: false,
  muted: false,
  tracks: audioEngine.trackList.map((t) => ({ id: t.id, title: t.title, sub: t.sub })),
  currentTrack: 0,

  start: async () => {
    // 可重入：已启动时再调仍会 await engine.start() → resume 被挂起的 AudioContext
    //（之前 started 早退让 resume 路径永远不可达）。
    const first = !get().started;
    if (first) {
      // 引擎换曲/坏轨跳过/全库失败时回报（下标, 是否可听），UI 跟随真实状态。
      audioEngine.setOnTrackChange((i, audible) => set({ currentTrack: i, musicPlaying: audible }));
    }
    await audioEngine.start();
    if (first) {
      audioEngine.setMusicPlaying(true);
      set({ started: true, musicPlaying: true, currentTrack: audioEngine.currentTrack });
    }
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

  // 切歌是异步的（按需解码 + 坏轨跳过），最终落到哪一首由 onTrackChange 回报——
  // 这里只表达意图（确保在放），不抢先写 currentTrack。
  playTrack: (i) => {
    audioEngine.setMusicPlaying(true);
    set({ musicPlaying: true });
    audioEngine.playTrack(i);
  },
  nextTrack: () => {
    audioEngine.setMusicPlaying(true);
    set({ musicPlaying: true });
    audioEngine.next();
  },
  prevTrack: () => {
    audioEngine.setMusicPlaying(true);
    set({ musicPlaying: true });
    audioEngine.prev();
  },

  // 曲库随场景切换。立即镜像 UI 曲目单（RecordPanel 的"曲目单"跟着变），引擎异步换库起播；
  // 换库后落到哪一首由 onTrackChange 回报。已在同一库时引擎侧空操作。
  setLibrary: (tracks) => {
    set({ tracks: tracks.map((t) => ({ id: t.id, title: t.title, sub: t.sub })), currentTrack: 0 });
    void audioEngine.setLibrary(tracks);
  },
}));

// 开发期 HMR：模块替换前拆掉旧引擎（定时器 + AudioContext），避免重载累积。
if (import.meta.hot) import.meta.hot.dispose(() => audioEngine.dispose());
