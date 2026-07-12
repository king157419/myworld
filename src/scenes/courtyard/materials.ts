import * as THREE from "three";

// 雾中山居共用材质（模块级单例）。色域锁死：灰绿—宣白—墨黑，纸灯是唯一暖点。
// 满分定义的三大硬色：宣白墙（带灰带渍、绝非 #FFFFFF）、黛瓦（雨湿微反光的墨黑蓝）、
// 深墨绿水池——皆从材质就分好家；饱和红/蓝一律不出现。
//
// 注：带渍宣白墙的 canvas 纹理在 Shell 里按需生成（浏览器端 useMemo），本文件只放纯色材质，
// 保持模块加载对单测环境无副作用（不碰 canvas）。

export const COURT_PALETTE = {
  // 宣白（墙）：带灰，绝不纯白
  xuan: "#c3c7bf",
  xuanShade: "#a7ada4", // 墙根水渍暗一档
  // 黛瓦（墨黑蓝）：受光的深色，不是纯黑贴片
  tile: "#242b2c",
  tileWet: "#2e3739",
  ridge: "#1b2122",
  // 石（径 / 阶 / 缘）：湿润带青
  stone: "#3b423e",
  stoneWet: "#454d48",
  stoneDark: "#2c322f",
  moss: "#3c4a38", // 瓦缝 / 石缝苔绿
  // 木（柱 / 框 / 架）：深旧木，接灯光偏暖
  wood: "#2c241a",
  woodWarm: "#463522",
  // 纸与灯（唯一暖点）
  paper: "#e7d3a2",
  lampWarm: "#ffb060",
  lampCore: "#ffe6bd",
  glowAmber: "#ff9a44",
  // 植物（灰绿）
  bamboo: "#55654f",
  bambooLeaf: "#455842",
  pine: "#33402f",
  // 水
  poolDeep: "#0c1912",
  poolSheen: "#1b2d23",
} as const;

/** 黛瓦：受光的深色屋面（雨湿 → 低粗糙微反光），不是纯黑。 */
export const tileMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.tileWet, roughness: 0.46, metalness: 0.08 });
/** 瓦垄 / 瓦脊：更暗一档。 */
export const ridgeMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.ridge, roughness: 0.5, metalness: 0.06 });
/** 湿石：石径 / 石阶 / 池缘（微反光）。 */
export const stoneMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.stoneWet, roughness: 0.55, metalness: 0.06 });
/** 暗石：台基 / 立缘。 */
export const stoneDarkMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.stoneDark, roughness: 0.7 });
/** 深旧木：柱 / 梁 / 架框。 */
export const woodMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.wood, roughness: 0.82 });
/** 暖木：接灯光的木件（矮几 / 层板 / 琴身）。 */
export const woodWarmMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.woodWarm, roughness: 0.7, metalness: 0.05 });
/** 暖纸：灯罩 / 摊开的纸。 */
export const paperMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.paper, roughness: 0.9, side: THREE.DoubleSide });

/** 带灰带渍的宣白墙纹理（浏览器端生成；墙根渍痕 + 斑驳，绝非纯白）。 */
export function makeXuanTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  // 底：带灰宣白（非纯白）
  ctx.fillStyle = COURT_PALETTE.xuan;
  ctx.fillRect(0, 0, 256, 256);
  // 斑驳灰渍（随机低透明度色块）
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + Math.random() * 0.12;
    g.addColorStop(0, `rgba(120,128,120,${a})`);
    g.addColorStop(1, "rgba(120,128,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 墙根水渍：底部一带压暗（v 方向 0 = 底）
  const wg = ctx.createLinearGradient(0, 256, 0, 150);
  wg.addColorStop(0, "rgba(70,78,72,0.5)");
  wg.addColorStop(1, "rgba(70,78,72,0)");
  ctx.fillStyle = wg;
  ctx.fillRect(0, 150, 256, 106);
  // 几道下淌的雨痕
  ctx.strokeStyle = "rgba(88,96,90,0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const x = 20 + Math.random() * 216;
    ctx.beginPath();
    ctx.moveTo(x, 40 + Math.random() * 40);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
