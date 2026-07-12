# ASSETS — 素材总台账（出处 + 许可）

> 原则：运行时 100% 离线，所有素材打包进仓库。许可只收 **CC0 / CC-BY / 公有领域**
> （CC-BY 记全作者与署名格式；BY-SA 一律不收——第十二轮音频收集时已主动删除两首 BY-SA 古琴曲）。
> 参照图（references/）不进构建产物，仅作开发期评审锚。

## 一、音频（public/audio/）

### 潮汐图书馆（loft，第 5-8 轮入库）
详见 [public/audio/CREDITS.md](./public/audio/CREDITS.md)：水声 Water on Rocks（Dsw4，CC BY 3.0，Wikimedia）
+ 曲库四首（肖邦夜曲 Op.9-2/Op.9-1/升c小调遗作、萨蒂 Gymnopédie No.1——作曲家公有领域，录音 PD/CC0，Musopen/Wikimedia）。

### 第十二轮新收（_staging/audio/ → 按场景入库 public/audio/attic|courtyard/）
完整逐文件台账（时长/来源页/作者/许可/preview 直链备档/失败记录）见
[_staging/audio/MANIFEST.md](./_staging/audio/MANIFEST.md)。摘要：

| 场景 | 内容 | 许可构成 |
|---|---|---|
| 阁楼 | 室内雨声×2、深夜爵士×3（Kevin MacLeod）、黑胶底噪×2、旧钟滴答、地板吱呀 | 雨/底噪/杂音全 CC0（Freesound HQ preview）；爵士 CC BY 4.0 |
| 山居 | 雨打瓦×2、竹叶风×2、古琴《平沙落雁》+ 音乐会实录、风铃、寺钟 | 环境声全 CC0；《平沙落雁》CC BY 2.5（CharlieHuang~commonswiki，Wikimedia）；实录 CC BY 4.0（xserra，Freesound） |

**CC BY 署名义务（发布时必须带）**：
- Kevin MacLeod 三首，incompetech 官方格式：`"<Title>" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/`
- 《平沙落雁》：演奏/上传 CharlieHuang~commonswiki，CC BY 2.5，https://commons.wikimedia.org/wiki/File:Pingsha_Luoyan.ogg
- 古琴音乐会实录：xserra，CC BY 4.0，https://freesound.org/people/xserra/sounds/162029/
- 水声（已在库）：Dsw4，CC BY 3.0

## 二、3D 模型（public/models/）

| 文件 | 来源 | 许可 |
|---|---|---|
| gramophone.glb（+ Blender smart-UV/AO 改造版） | Don Carson "Gramophone"，poly.pizza | **CC-BY 3.0**（署名见 public/models/CREDITS.md） |
| gramophone_ao.png、public/lightmaps/*（壳 GLB + lightmap） | 本仓库自产（Blender 4.5.11 烘焙，tools/bake/） | 项目自有 |

其余全部程序化几何（src/scene/gallery/、src/scenes/），无外部模型。

## 三、参照图（references/，不进构建）

### 通道一 · 真实摄影（评审主锚）
- `references/attic/`（6 张）与 `references/courtyard/`（6 张）：11 张 Unsplash License（可再分发、无署名义务）+
  1 张 Wikimedia Commons **CC BY 2.0（宏村雾中倒影，作者 Luo Shaoyang，发布需署名）**。
  逐张出处/作者/锚定说明 + 电影参照（URL-only 未下载）+ 满分定义：见各目录 `SOURCES.md`。

### 通道二 · AI 生成（仅构图/氛围补充，评审以通道一为主锚）
- `references/generated/`（场景 5 张）+ `references/generated/objects/`（物件概念 5 张）：
  Codex CLI 内置 image_gen（gpt-image-2，ChatGPT OAuth，无 API key，零按张计费）。
  逐张完整提示词/参考模板/用途：见 `references/generated/PROMPTS.md`。
  注：任务原指定的 EvoLinkAI/awesome-gpt-image-2 仓库在 GitHub 不存在（404），
  实际参考 `jamez-bondos/awesome-gpt4o-images` 精选集改写，已在 PROMPTS.md 注明。
- 物件概念图（耳机/砚台/纸灯/诗集/香水）暂未走图生 3D（无已配置的免费 key），留档供人工喂给 Meshy/Tripo。

## 四、贴图

目前无外部 PBR 贴图（材质全程序化）。如后续引 ambientCG（CC0）在此登记。
