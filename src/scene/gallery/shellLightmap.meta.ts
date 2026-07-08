// 由 tools/bake/install.mjs 从烘焙产物自动生成——不要手改。
// scale = 各通道 sqrt 编码前的 99.7 分位定标（运行时乘回得到真实辐照度）。
export const LIGHTMAP_META = {
  warmScale: 1,
  moonScale: 1,
  skyScale: 1,
  res: 0, // 0 = 尚未烘焙（BakedShell 据此拒绝挂载，回退程序化渲染）
  encode: "sqrt",
} as const;
