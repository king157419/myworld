# tools/bake — Blender 烘焙管线（第十一轮起）

把 Blender（便携版，headless）当作**可脚本化的烘焙农场**：几何与灯位从活场景导出（不靠手抄），
Cycles 烘出实时管线做不出的光（GI 反弹 / 软接触影 / 方向性遮蔽），产物离线打包进仓库。
运行时高画质档消费烘焙产物，低画质档 / 产物缺席时逐像素回退原程序化渲染。

## 依赖

- Blender 4.5.x 便携版（本机 `D:\desk\ds\tools\blender-4.5.11-windows-x64\blender.exe`，仓库不含）。
- 有 NVIDIA 卡时自动走 OptiX，否则 CUDA → CPU 逐级回退。

## 管线（分灯 lightmap）

```bash
# 1. 起 dev server + 文件接收器（两个终端）
npm run dev
npm run bake:receiver          # 监听 127.0.0.1:5199，落盘 tools/bake/work/

# 2. 浏览器 http://localhost:5180 控制台导出活场景（重烘前先 localStorage.lj_quality='low'，
#    否则高档下静态壳不渲染、导不出来；导完删掉恢复）
await __ljExport.shell()       # -> work/shell.glb   静态壳+发光件+遮光体，名字前缀分组
await __ljExport.lights()      # -> work/lights.json 全部灯光（content 灯带 skip 标记）

# 3. headless 烘焙（RTX 4070 上 2048px/384spp 约几分钟）
<blender.exe> --background --python tools/bake/bake_shell.py -- tools/bake/work tools/bake/out 2048 384

# 4. 安装产物（public/lightmaps/*.{glb,png} + src/scene/gallery/shellLightmap.meta.ts）
npm run bake:install
```

## 通道语义（与实时光解耦，绝不双计）

| 通道 | 内容 | 实时端对应 |
| --- | --- | --- |
| R | 暖灯组间接反弹 + 自发光罩全量 | 点光直射保留；面光源实时端本就不存在 |
| G | 月光间接反弹 | 月光直射 + 阴影贴图保留 |
| B | 天光全量（≈方向性遮蔽的环境光） | 压掉平坦 ambient/hemi/IBL 漫反射（`uLmAo`） |

各通道存 **sqrt 编码的无色辐照度**（99.7 分位定标，scale 进 meta），运行时
`BakedShell.tsx` 按组调色调强，mood 可逐组呼吸（暖跟 lampMul、天光跟 hemiIntensity、月光为锚）。

## 标签契约（组件里 `userData.ljBake`）

- `static` —— 被烘焙、且高档运行时被 BakedShell 替换的静态壳（Deck / BookWall 骨架 / 灯笼杆 / 浮岛座）。
- `emitter` —— 只进 Blender 当光源（灯罩等自发光件），运行时照常渲染。
- `occluder` —— 只挡光/投影（书群、留声机、书墙立柱），不烘不换。
- `content`（灯上）—— 数据驱动的内容灯（思考数、播放态），**永不烘焙**：烘进去等于把
  某个用户状态冻成舞台，违反"世界可由数据完整重建"的契约。

## 试点脚本

`bake_gramophone.py`：单模型 AO 烘焙（smart-UV 重展 + Cycles AO + 原材质名保留导出），
用于验证工具链，产物 `gramophone.glb` + `gramophone_ao.png` 直接替换 `public/models/`。

## 重烘时机

改了 theme.ts 布局 / 灯位 / 静态件几何后需要重烘（烘焙冻结的是"舞台×灯位"的关系）。
只调 mood/强度不用重烘——那些走运行时 uniform。
