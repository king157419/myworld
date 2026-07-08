// 把烘焙产物安装进运行时资产位：
//   tools/bake/out/shell-baked.glb     -> public/lightmaps/shell-baked.glb
//   tools/bake/out/shell-lightmap.png  -> public/lightmaps/shell-lightmap.png
//   tools/bake/out/shell-lightmap.json -> src/scene/gallery/shellLightmap.meta.ts（生成 TS，免 resolveJsonModule）
// 用法：node tools/bake/install.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const OUT = resolve(HERE, "out");

mkdirSync(resolve(ROOT, "public", "lightmaps"), { recursive: true });
copyFileSync(resolve(OUT, "shell-baked.glb"), resolve(ROOT, "public", "lightmaps", "shell-baked.glb"));
copyFileSync(resolve(OUT, "shell-lightmap.png"), resolve(ROOT, "public", "lightmaps", "shell-lightmap.png"));

const meta = JSON.parse(readFileSync(resolve(OUT, "shell-lightmap.json"), "utf-8"));
const ts = `// 由 tools/bake/install.mjs 从烘焙产物自动生成——不要手改。
// scale = 各通道 sqrt 编码前的 99.7 分位定标（运行时乘回得到真实辐照度）。
export const LIGHTMAP_META = {
  warmScale: ${meta.warmScale},
  moonScale: ${meta.moonScale},
  skyScale: ${meta.skyScale},
  res: ${meta.res},
  encode: "sqrt",
} as const;
`;
writeFileSync(resolve(ROOT, "src", "scene", "gallery", "shellLightmap.meta.ts"), ts);
console.log("installed lightmap assets + meta");
