// 由 tools/bake/install.mjs 从烘焙产物自动生成——不要手改。
// scale = 各通道 sqrt 编码前的 99.7 分位定标（运行时乘回得到真实辐照度）。
export const LIGHTMAP_META = {
  warmScale: 0.014833659457042899,
  moonScale: 0.0001065405764747997,
  skyScale: 0.1878003478050232,
  res: 2048,
  encode: "sqrt",
} as const;
