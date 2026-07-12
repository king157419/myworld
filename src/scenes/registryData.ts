import type { Entry, RoomStyle, Vec3, WorldConfig, ZoneType } from "../config/types";
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
