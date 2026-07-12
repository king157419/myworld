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

// 评审 R12·C3：一批向下/背光的深色面（屋顶底面、瓦垄、台基、门圈、架框、湖石）在弱天光下塌成纯黑。
// 给这些深色材质一层「极低强度」的同色自发光地板——深色仍是深色，但绝不再是纯黑（受光 standard 材质）。

/** 黛瓦：受光的深色屋面（雨湿 → 低粗糙微反光），不是纯黑。 */
export const tileMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.tileWet, roughness: 0.46, metalness: 0.08, emissive: new THREE.Color("#1a2224"), emissiveIntensity: 0.12 });
/** 瓦垄 / 瓦脊：更暗一档。 */
export const ridgeMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.ridge, roughness: 0.5, metalness: 0.06, emissive: new THREE.Color("#141a1b"), emissiveIntensity: 0.12 });
/** 湿石：石径 / 石阶 / 池缘（微反光）。 */
export const stoneMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.stoneWet, roughness: 0.55, metalness: 0.06 });
/** 暗石：台基 / 立缘 / 门圈 / 湖石。 */
export const stoneDarkMat = new THREE.MeshStandardMaterial({ color: "#343b37", roughness: 0.7, emissive: new THREE.Color("#1b211e"), emissiveIntensity: 0.1 });
/** 深旧木：柱 / 梁 / 架框（含博古架顶板）。 */
export const woodMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.wood, roughness: 0.82, emissive: new THREE.Color("#241a12"), emissiveIntensity: 0.12 });
/** 暖木：接灯光的木件（矮几 / 层板 / 琴身）。 */
export const woodWarmMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.woodWarm, roughness: 0.7, metalness: 0.05 });
/** 暖纸：灯罩 / 摊开的纸。 */
export const paperMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.paper, roughness: 0.9, side: THREE.DoubleSide });

/** 带灰带渍的宣白墙纹理（浏览器端生成；墙根渍痕 + 斑驳，绝非纯白）。
 *  评审 R12·C4：旧版等距竖雨痕 + 高频平铺让墙读作「波纹铁皮」。改法——
 *  渍痕主体改成低频不规则团块（大而稀的灰斑），竖淌痕减到 3 条且不等距/不通顶、对比压低，
 *  墙根渍痕收敛（配合 Shell 里竖向 repeat=1，不再横向分层结带）。 */
export function makeXuanTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  // 底：带灰宣白（非纯白）
  ctx.fillStyle = COURT_PALETTE.xuan;
  ctx.fillRect(0, 0, S, S);
  // 低频不规则团块（大而稀，主导变化——不再是等距条带）
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 40 + Math.random() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.04 + Math.random() * 0.08;
    g.addColorStop(0, `rgba(120,128,120,${a})`);
    g.addColorStop(1, "rgba(120,128,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 细粒斑驳（小而多，压低对比）
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 8 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.03 + Math.random() * 0.05;
    g.addColorStop(0, `rgba(110,120,112,${a})`);
    g.addColorStop(1, "rgba(110,120,112,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 墙根水渍：底部一带轻压暗（收敛透明度；竖向 repeat=1 → 只出现在墙根一次）
  const wg = ctx.createLinearGradient(0, S, 0, S * 0.62);
  wg.addColorStop(0, "rgba(70,78,72,0.28)");
  wg.addColorStop(1, "rgba(70,78,72,0)");
  ctx.fillStyle = wg;
  ctx.fillRect(0, S * 0.62, S, S * 0.38);
  // 三道下淌雨痕：不等距、起止随机、不通顶、对比压低（不再等距通顶结成竖棱）
  ctx.strokeStyle = "rgba(88,96,90,0.1)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const x = 60 + Math.random() * (S - 120);
    const y0 = 80 + Math.random() * 160;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (Math.random() - 0.5) * 24, y0 + 120 + Math.random() * 200);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
