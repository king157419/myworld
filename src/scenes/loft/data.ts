import type { SceneData } from "../registryData";
import { defaultWorld } from "../../config/defaultWorld";
import { makeSeed } from "../../data/seed";
import { resolveMove } from "../../scene/walk";
import { EYE, FOCUS, SPAWN, ZONE_ANCHORS } from "../../theme";

// 潮汐图书馆（loft）的场景数据 = 把现有实现原样包起来。
// theme.ts 仍是 loft 的私有真相源（几何/锚点/聚焦）；walk.ts 仍是它的碰撞求解器。
// 这里只是让注册表以统一形状取用它们——loft 切回去必须逐像素一致，故一切直接引用、零改动。
export const loftData: SceneData = {
  style: "loft",
  label: "潮汐图书馆",
  tagline: "暖灯读书回廊，立在映着星空的镜面水上",
  defaultWorld,
  makeSeed,
  spawn: { position: SPAWN, yaw: 0 },
  eye: EYE,
  water: true, // 镜面水面：脚步在星海倒影上荡开涟漪
  walk: resolveMove,
  zoneAnchors: ZONE_ANCHORS,
  focus: FOCUS,
};
