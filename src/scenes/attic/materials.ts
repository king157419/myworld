import * as THREE from "three";

// 雨夜阁楼共用材质（模块级单例）：同一配方不在各组件内联手抄，也省 GPU program。
// 调色：暖的木与纸（琥珀侧）× 冷的夜与玻璃（青蓝侧）——满分定义的双色平衡从材质就分好家。

export const ATTIC_PALETTE = {
  lampWarm: "#ffb257",
  lampCore: "#ffe9c2",
  glowAmber: "#ff9b46",
  brass: "#c69a52",
  paperWarm: "#e9d6a6",
  woodDark: "#241a12", // 屋架 / 深旧木
  woodWarm: "#3a2818", // 接灯光的暖木
  woodFloor: "#2c2016", // 地板
  plaster: "#2a2018", // 抹灰墙（暗，让灯洇开处更亮）
  nightCold: "#0c1526", // 窗外夜
  glassCold: "#22344f", // 玻璃冷色
} as const;

/** 深旧木：屋架 / 椽 / 书架框。 */
export const beamMat = new THREE.MeshStandardMaterial({ color: ATTIC_PALETTE.woodDark, roughness: 0.9 });

/** 暖木：接灯光的木件（写字台 / 楼梯踏板 / 层板）。 */
export const woodWarmMat = new THREE.MeshStandardMaterial({ color: ATTIC_PALETTE.woodWarm, roughness: 0.72, metalness: 0.04 });

/** 地板：略暖的旧木地。 */
export const floorMat = new THREE.MeshStandardMaterial({ color: ATTIC_PALETTE.woodFloor, roughness: 0.86 });

/** 抹灰墙 / 天花：暗，靠灯光洇出层次。 */
export const plasterMat = new THREE.MeshStandardMaterial({ color: ATTIC_PALETTE.plaster, roughness: 0.96 });

/** 黄铜：灯颈 / 唱臂 / 五金。 */
export const brassMat = new THREE.MeshStandardMaterial({ color: ATTIC_PALETTE.brass, roughness: 0.34, metalness: 1 });

/** 暖纸：灯罩 / 摊开的纸。 */
export const paperMat = new THREE.MeshStandardMaterial({
  color: ATTIC_PALETTE.paperWarm,
  roughness: 0.9,
  side: THREE.DoubleSide,
});
