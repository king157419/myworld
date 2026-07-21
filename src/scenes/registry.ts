import { lazy, type ComponentType } from "react";
import { SCENE_DATA, SCENE_ORDER, resolveScene, type SceneData, type SceneStyle } from "./registryData";

// 场景注册表 · 完整部分（数据 + Stage 3D 组件）。只有 Experience 需要 Stage，故只有它引本模块；
// switchScene / PlayerControls / DockControls / 测试都从 registryData.ts（无 three）取数据。
//
// 原则：PlayerControls / cameraDirector 消费的场景数据（spawn/eye/walk/zoneAnchors/focus）、
// Zones 的渲染，都改为经注册表取"当前场景"的，不再直接 import theme 的 loft 数据。
// loft 的 SceneDef 就是把现有实现原样包起来（theme.ts 不动，作为 loft 私有真相源）。
//
// Stage 走 React.lazy：每场景一个独立 chunk，只在进入该场景时下载（Experience 里已有
// Suspense 包着；切场景的黑幕淡入正好盖住首次加载的空当）。

export interface SceneDef extends SceneData {
  /** 场景全部 3D 内容（含 zone 视觉）。 */
  Stage: ComponentType<{ low: boolean }>;
}

const STAGES: Record<SceneStyle, ComponentType<{ low: boolean }>> = {
  loft: lazy(() => import("./loft/Stage")),
  attic: lazy(() => import("./attic/Stage")),
  courtyard: lazy(() => import("./courtyard/Stage")),
};

export const SCENES: Record<SceneStyle, SceneDef> = {
  loft: { ...SCENE_DATA.loft, Stage: STAGES.loft },
  attic: { ...SCENE_DATA.attic, Stage: STAGES.attic },
  courtyard: { ...SCENE_DATA.courtyard, Stage: STAGES.courtyard },
};

export { SCENE_ORDER, resolveScene };
export type { SceneStyle, SceneData };
