// ─────────────────────────────────────────────────────────────────────────
// 灵境声场：真实音频文件版（CC0 / CC-BY / PD，离线打包进仓库）。
//
//   · 环境水声（water-ambient.ogg，全局，轻增益，循环）
//   · 留声机曲库（多首 PD/CC0 夜曲，空间化在 GRAMOPHONE 位 → 走近变响；放完自动接下一首，可切换）
//   · 远雷（由天气层在闪电后触发，用合成噪声，轻量）
//
// 首个用户手势后 start()；fetch + decodeAudioData 懒加载。
// 公开 API 与旧合成版保持完全兼容（PlayerControls / Hud / RecordPanel 无需改动）。
// ─────────────────────────────────────────────────────────────────────────

import { GRAMOPHONE } from "../theme";

type Vec = [number, number, number];

// 留声机曲库（全部 PD / CC0，离线打包进 public/audio；署名见 public/audio/CREDITS.md）。
// 一首放完自动接下一首（成一套"夜的曲目单"），也可在面板里点选/切换。
export interface TrackMeta {
  id: string;
  title: string;
  sub: string;
  file: string;
}
export const TRACKS: TrackMeta[] = [
  { id: "nocturne-op9-2", title: "夜曲 · 作品9之2", sub: "肖邦 · Frank Levy（PD）", file: "music-nocturne.mp3" },
  { id: "nocturne-op9-1", title: "夜曲 · 作品9之1", sub: "肖邦 · V. Chaimovich（CC0）", file: "music-nocturne-op9no1.ogg" },
  { id: "nocturne-cminor", title: "升c小调夜曲 · 遗作", sub: "肖邦 · Aaron Dunn（CC0）", file: "music-nocturne-cminor.ogg" },
  { id: "gymnopedie-1", title: "Gymnopédie No.1", sub: "萨蒂 · R. Alciatore（PD）", file: "music-gymnopedie1.ogg" },
];

/** 用 BASE_URL 拼接 public/ 下的相对路径，兼容开发服务器与生产构建。 */
function audioUrl(filename: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? `${base}audio/${filename}` : `${base}/audio/${filename}`;
}

/** 创建 PannerNode 并设初始位置。 */
function makePanner(ctx: AudioContext, [x, y, z]: Vec): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = "HRTF";
  p.distanceModel = "inverse";
  p.refDistance = 2;
  p.maxDistance = 20;
  p.rolloffFactor = 1.4;
  setPannerPos(p, x, y, z, ctx.currentTime);
  return p;
}

/** 更新 PannerNode 位置（兼容新旧 API）。 */
function setPannerPos(p: PannerNode, x: number, y: number, z: number, t: number) {
  if (p.positionX) {
    p.positionX.setValueAtTime(x, t);
    p.positionY.setValueAtTime(y, t);
    p.positionZ.setValueAtTime(z, t);
  } else {
    (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }
}

/** fetch + decode，失败静默（不阻断渲染循环）。 */
async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[AudioEngine] 加载失败 (${res.status}): ${url}`);
      return null;
    }
    const ab = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  } catch (e) {
    console.warn("[AudioEngine] decodeAudioData 失败:", url, e);
    return null;
  }
}

/** 短噪声缓冲，用于雷声（本地合成，无需外部文件）。 */
function makeNoiseBuf(ctx: AudioContext, seconds = 3): AudioBuffer {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;

  // —— 音乐总线（留声机空间化）+ 曲库 ——
  private musicBus!: GainNode;
  private musicPanner!: PannerNode;
  private musicSource: AudioBufferSourceNode | null = null;
  private trackBufs: (AudioBuffer | null)[] = [];
  private currentIndex = 0;
  private onTrackChange?: (i: number) => void;

  // —— 环境水声总线（全局）——
  private waterSource: AudioBufferSourceNode | null = null;
  private waterGain!: GainNode;

  // —— 雷声所需噪声缓冲（轻量，本地合成）——
  private noiseBuf: AudioBuffer | null = null;

  private musicOn = false;
  private muted = false;
  private vol = 0.85;


  get ready(): boolean {
    return this.ctx !== null;
  }
  get playing(): boolean {
    return this.musicOn;
  }
  get isMuted(): boolean {
    return this.muted;
  }

  // ── 启动 ──────────────────────────────────────────────────────────────

  /** 首个用户手势后调用：建图 + 拉取音频文件 + 启动环境声。幂等。 */
  async start(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    await ctx.resume();

    // —— 主线：压限 → 输出 ——
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // —— 环境水声总线（全局，进 master）——
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.22;
    this.waterGain.connect(this.master);

    // —— 音乐总线（→ PannerNode @ GRAMOPHONE → master）——
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0; // 默认静音，setMusicPlaying(true) 后渐起
    this.musicPanner = makePanner(ctx, GRAMOPHONE);
    this.musicBus.connect(this.musicPanner).connect(this.master);

    // 异步加载音频，不 await（不阻塞 start() 返回，加载完成后自动开始播放）
    void this.loadAndPlay(ctx);
  }

  /** 加载环境水声 + 整套曲库并启动播放（首曲）。 */
  private async loadAndPlay(ctx: AudioContext): Promise<void> {
    // 噪声缓冲（雷声用，轻量，立即生成）
    this.noiseBuf = makeNoiseBuf(ctx, 3);

    // 并行拉取：水声 + 全部曲目
    const [waterBuf, ...trackBufs] = await Promise.all([
      loadBuffer(ctx, audioUrl("water-ambient.ogg")),
      ...TRACKS.map((t) => loadBuffer(ctx, audioUrl(t.file))),
    ]);
    this.trackBufs = trackBufs;

    // —— 环境水声（循环，全局）——
    if (waterBuf) {
      this.startWaterLoop(ctx, waterBuf);
    }

    // —— 曲库：从当前曲目起播（放完自动接下一首）——
    this.playCurrent();
    if (this.musicOn) {
      this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
      this.musicBus.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    }
  }

  private startWaterLoop(ctx: AudioContext, buf: AudioBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.waterGain);
    src.start();
    this.waterSource = src;
  }

  /** 起播当前曲目：停掉旧源、从缓冲新建源，放完自动接下一首。 */
  private playCurrent() {
    if (!this.ctx) return;
    if (this.musicSource) {
      this.musicSource.onended = null; // 主动切换：别让 onended 误触发自动下一首
      try { this.musicSource.stop(); } catch { /* 已停止 */ }
      this.musicSource = null;
    }
    const buf = this.trackBufs[this.currentIndex];
    if (!buf) { this.onTrackChange?.(this.currentIndex); return; } // 尚未加载完
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = false;
    src.connect(this.musicBus);
    src.onended = () => { if (this.musicSource === src) this.next(); }; // 自然播完 → 下一首
    src.start();
    this.musicSource = src;
    this.onTrackChange?.(this.currentIndex);
  }

  // ── 曲库控制 ──────────────────────────────────────────────────────────
  get trackList(): TrackMeta[] { return TRACKS; }
  get currentTrack(): number { return this.currentIndex; }
  setOnTrackChange(cb: (i: number) => void): void { this.onTrackChange = cb; }

  /** 点选某曲目播放（i 越界忽略）。 */
  playTrack(i: number): void {
    if (i < 0 || i >= TRACKS.length) return;
    this.currentIndex = i;
    this.playCurrent();
  }
  next(): void { this.playTrack((this.currentIndex + 1) % TRACKS.length); }
  prev(): void { this.playTrack((this.currentIndex - 1 + TRACKS.length) % TRACKS.length); }

  // ── 远雷（天气层在闪电后延迟调用） ────────────────────────────────────

  /** 远雷：合成噪声脉冲，无需外部文件。 */
  thunder(intensity = 1): void {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * intensity, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 3.2);
  }

  // ── 控制 ──────────────────────────────────────────────────────────────

  /** 开关音乐（渐入/渐出音乐总线增益）。 */
  setMusicPlaying(on: boolean): void {
    this.musicOn = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.4 : 0.6);
  }

  /** 全局静音 / 取消静音。 */
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * 每帧由 PlayerControls 调用，更新 AudioListener 位姿。
   * 使用 setTargetAtTime 平滑过渡，避免阶跃拉链音。
   */
  setListener(pos: Vec, forward: Vec, up: Vec = [0, 1, 0]): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    const k = 0.02; // 平滑时间常数（秒），约 20ms
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos[0], t, k);
      l.positionY.setTargetAtTime(pos[1], t, k);
      l.positionZ.setTargetAtTime(pos[2], t, k);
      l.forwardX.setTargetAtTime(forward[0], t, k);
      l.forwardY.setTargetAtTime(forward[1], t, k);
      l.forwardZ.setTargetAtTime(forward[2], t, k);
      l.upX.setTargetAtTime(up[0], t, k);
      l.upY.setTargetAtTime(up[1], t, k);
      l.upZ.setTargetAtTime(up[2], t, k);
    } else {
      const ll = l as unknown as {
        setPosition(x: number, y: number, z: number): void;
        setOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void;
      };
      ll.setPosition(pos[0], pos[1], pos[2]);
      ll.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
    }
  }

  /** 释放所有资源（定时器 + AudioContext）。HMR 和卸载时调用。 */
  dispose(): void {
    try {
      this.waterSource?.stop();
      this.musicSource?.stop();
    } catch {
      // 已停止的节点 stop() 会抛出，忽略
    }
    this.waterSource = null;
    this.musicSource = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

// 单例 + React 取用钩子在 useAudio.ts。
export const audioEngine = new AudioEngine();
