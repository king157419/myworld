import * as THREE from "three";
import { PALETTE } from "../../theme";

// 回廊共用材质（模块级单例）：同一配方不再在各组件里内联手抄——
// 之前"黄铜"在 8 处出现了 4 组悄悄漂移的参数（roughness 0.26/0.28/0.3/0.36…）。
// 共享实例同时减少 GPU program 数。需要独立动画/发光强度的材质仍在组件内自持。

/** 抛光黄铜：栏杆、立柱、铜沿、望远镜镜筒等所有"硬金属"件。 */
export const brassMat = new THREE.MeshStandardMaterial({
  color: PALETTE.brass,
  roughness: 0.3,
  metalness: 1,
});

/** 柔光黄铜：车削灯杆（哑一点，回木杆的温润感）。 */
export const brassSoftMat = new THREE.MeshStandardMaterial({
  color: PALETTE.brass,
  roughness: 0.36,
  metalness: 0.9,
});

/** 深色旧木：书架层板、台面等。 */
export const woodMat = new THREE.MeshStandardMaterial({
  color: PALETTE.wood,
  roughness: 0.8,
});

/** 暖色木：立柱、坡道等要"接灯光"的木件。 */
export const woodWarmMat = new THREE.MeshStandardMaterial({
  color: PALETTE.woodWarm,
  roughness: 0.68,
  metalness: 0.05,
});

/** 暖纸：摊开的书页、纸张。 */
export const paperMat = new THREE.MeshStandardMaterial({
  color: PALETTE.paperWarm,
  roughness: 0.9,
  side: THREE.DoubleSide,
});
