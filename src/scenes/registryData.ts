import type { Entry, RoomStyle, Vec3, WorldConfig, ZoneType } from "../config/types";
import type { TrackMeta } from "../audio/engine";
import type { WalkFn } from "./walkKit";
import { loftData } from "./loft/data";
import { atticData } from "./attic/data";
import { courtyardData } from "./courtyard/data";

// ─────────────────────────────────────────────────────────────────────────
// 场景注册表 · 数据部分（**无 THREE 依赖**）。
//
// 为什么和 registry.tsx 分家：Stage 是 3D 组件（拖进整套 three）。而 store 的 switchScene、
// PlayerControls、DockControls、以及各测试只需要"场景数据"（出生点/视高/行走求解器/锚点/聚焦/
// 默认世界/种子）——把这些放这里，它们就能零 three 依赖地取用，store 单测也不必加载渲染栈。
// registry.tsx 再把 Stage 拼进来，供 Experience 用。
//
// 这一层没有任何模块 import useWorld → 可被 useWorld 安全静态引用（无循环依赖）。
// ─────────────────────────────────────────────────────────────────────────

/** 相机聚焦锚点：看向的中心 + 正面朝向（对齐 theme.ts 的 ZONE_ANCHORS 消费方式）。 */
export interface ZoneAnchor {
  position: Vec3;
  ry: number;
}
/** 聚焦取景包围球（对齐 theme.ts 的 FOCUS 消费方式）。 */
export interface FocusSphere {
  center: Vec3;
  radius: number;
}

/**
 * 场景音频档：进入该场景时由 useSceneAudio 统一应用（引擎三旋钮：水床增益 / 音乐总线曲库 /
 * 空间化锚点）。取代旧的"各场景 mount 改、unmount 恢复 loft"模式——那个模式在三场景两两
 * 切换时会经由 loft 兜一圈（白白重拉曲库字节、瞬时错位）。这里只是数据，应用方在 audio 层。
 */
export interface SceneAudio {
  /** 环境水床增益（loft 的镜面水 0.22；无水场景 0）。 */
  waterGain: number;
  /** 音乐总线曲库（空间化在 musicPos，走近变响；RecordPanel 曲目单同步展示）。 */
  tracks: TrackMeta[];
  /** 音乐空间化锚点（留声机/唱机/古琴的世界坐标）。 */
  musicPos: Vec3;
  /** 曲库响度配平（不同来源录音响度不一，默认 1）。 */
  musicGain?: number;
}

/** 一个场景 = 一份独立世界（可各自导出导入重建）+ 走动/聚焦/内容所需的一切数据。 */
export interface SceneData {
  style: RoomStyle;
  label: string;
  tagline?: string;
  /** 首次进入该场景的默认世界（room.style 与本 style 一致；三个 zones）。 */
  defaultWorld: WorldConfig;
  /** 首次进入该场景注入的种子内容。 */
  makeSeed: (now: number) => Entry[];
  /** 出生点位置与初始朝向（yaw）。切场景时玩家瞬移到此。 */
  spawn: { position: Vec3; yaw: number };
  /** 视高（相机眼睛离地）。 */
  eye: number;
  /** 是否有镜面水面（脚步涟漪）。占位场景无水则省略。 */
  water?: boolean;
  /** 本场景的纯函数行走求解器（签名对齐 scene/walk.ts 的 resolveMove）。 */
  walk: WalkFn;
  /** 相机聚焦锚点（按 zone.type 索引；id 是用户数据，type 描述舞台几何）。 */
  zoneAnchors: Record<ZoneType, ZoneAnchor>;
  /** 聚焦取景包围球（按 zone.type 索引）。 */
  focus: Record<ZoneType, FocusSphere>;
  /** 场景音频档（水床/曲库/空间化锚点），进场时统一应用。 */
  audio: SceneAudio;
}

/** UI 展示顺序 / 已接场景集合（study 预留未接，不在此列）。 */
export const SCENE_ORDER = ["loft", "attic", "courtyard"] as const;
export type SceneStyle = (typeof SCENE_ORDER)[number];

export const SCENE_DATA: Record<SceneStyle, SceneData> = {
  loft: loftData,
  attic: atticData,
  courtyard: courtyardData,
};

/** 把任意 style 安全解析到已接场景（未知/未接 → loft）。 */
export function resolveScene(style: string): SceneStyle {
  return (SCENE_ORDER as readonly string[]).includes(style) ? (style as SceneStyle) : "loft";
}
