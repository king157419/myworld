import type { WorldConfig } from "./types";
import { PALETTE, ZONE_ANCHORS } from "../theme";

// 首次进入时的初始世界。一切都从这里读——它本身就是一份最小的"保存的数据"。
// 注意：用固定时间戳让"默认世界"确定性；用户写入内容(Entry)时才产生真正的时间戳。
//
// 建筑外壳是"舞台"，由 theme.ts 的 LAYOUT 渲染；这里的数据描述的是
// "内容如何分布"——三个功能区的 id/类型/朝向/标签。渲染层用 zone.type 去 theme 取
// 精确锚点（ZONE_ANCHORS），未命中则回退 zone.position，保持数据可重建（id 可改名）。
const GENESIS = 0;

export const defaultWorld: WorldConfig = {
  version: "2.0.0",
  owner: { name: "" },
  createdAt: GENESIS,
  updatedAt: GENESIS,
  room: {
    style: "loft",
    dimensions: { w: 18, h: 8, d: 18 },
    palette: {
      base: PALETTE.stone,
      accent: PALETTE.brass,
      floor: PALETTE.waterTint,
    },
    // 主基调：冷夜镜面水 + 暖灯回廊。
    mood: { lighting: "cool", intensity: 1, fog: 0.18 },
  },
  zones: [
    {
      id: "zone-objects",
      type: "objects",
      position: ZONE_ANCHORS.objects.position,
      rotation: [0, ZONE_ANCHORS.objects.ry, 0],
      label: "浮岛陈列 · 珍视之物",
    },
    {
      id: "zone-bookshelf",
      type: "bookshelf",
      position: ZONE_ANCHORS.bookshelf.position,
      rotation: [0, ZONE_ANCHORS.bookshelf.ry, 0],
      label: "书墙 · 思考与文字",
    },
    {
      id: "zone-record",
      type: "record",
      position: ZONE_ANCHORS.record.position,
      rotation: [0, ZONE_ANCHORS.record.ry, 0],
      label: "留声机 · 影音",
    },
  ],
};
