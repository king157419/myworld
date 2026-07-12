# 生成图提示词记录 · generated references

> **全部为 AI 生成图，仅作构图 / 氛围补充参考。评审与实现以 `references/` 下的真实照片参照为主锚，本目录仅为辅助灵感。**
>
> 生成工具：Codex CLI（`codex exec`）内置 `image_gen` 工具，走 ChatGPT 账号 OAuth，模型 gpt-image 系（gpt-image-2 不支持透明背景，所有提示词均使用实心/纯色背景）。
> 提示词做功课来源：原指定的 `EvoLinkAI/awesome-gpt-image-2-API-and-Prompts` 仓库不存在（该账号无公开仓库），改用同类高质量精选集 **`jamez-bondos/awesome-gpt4o-images`**（含 OpenAI 官方 gpt-image-1 的 40 个精选案例）作为模板来源。引用的模板编号即该库 `gpt-image-1/gpt-image-1-en.md` 中的 Example 序号。
>
> 记录字段：文件名 | 完整提示词 | 参考模板 | 用途 | 状态

---

## 场景氛围补充图（`references/generated/`）

### 1. attic_desk_corner.png
- **用途**：B「雨夜阁楼」概念的写字台钩子（雨痕＝未说出口的话、案头未写完的信）氛围板。
- **参考模板**：Example 26「Fantasy Dreamscape Environment」（密集电影感场景描写手法）＋ Example 37「Cozy Living Room Addition」（cozy 室内语汇）。改写为写实、克制的雨夜案头单镜头。
- **完整提示词**：
  > A cinematic wide photograph of a cozy attic writing desk corner on a rainy night. A warm brass desk lamp casts a pool of amber light over an open sheet of unfinished letter paper with elegant handwriting trailing off mid-sentence, a fountain pen resting beside it, and a small open ink bottle. Behind the desk a dormer window with rain streaking and beading down the glass, deep midnight-blue night outside blurred with distant lights. Warm tungsten interior light contrasting the cool blue window, shallow depth of field, soft rain-blurred bokeh, moody film-still atmosphere, 35mm photography, horizontal 3:2 composition, photorealistic.
- **状态**：成功

### 2. attic_stairwell.png
- **用途**：B「雨夜阁楼」的进入序列 —— 老宅木楼梯望向顶层暖光阁楼，营造"被雨困住、往上是安全区"的情绪。
- **参考模板**：Example 26（氛围/明暗光影手法）＋ Example 37（cozy 暖调室内光）。
- **完整提示词**：
  > A cinematic photograph looking up an old wooden staircase in a dim vintage house, the top-floor attic doorway glowing with warm amber light spilling down the steps. Worn wooden handrail with aged patina, a shadowy dark stairwell, dust motes floating in a shaft of warm light from above, moody chiaroscuro lighting, atmospheric film still, vertical composition, photorealistic, 35mm.
- **状态**：成功

### 3. attic_vinyl_corner.png
- **用途**：B 概念的影音映射 —— 阁楼斜屋顶下"转不停的黑胶"角落，lo-fi 怀旧暖调。
- **参考模板**：Example 37「Cozy Living Room Addition」（cozy 室内）＋ Example 26（电影感布光）。
- **完整提示词**：
  > A cozy cinematic photograph of a vinyl record corner beneath a sloped attic ceiling. A turntable mid-spin playing a record, scattered record sleeves leaning against the wall, a warm amber wall sconce glowing beside it, a worn wooden floor. Nostalgic lo-fi mood, warm tungsten light and soft shadows, shallow depth of field, film-still atmosphere, horizontal composition, photorealistic 35mm.
- **状态**：成功

### 4. courtyard_gate_mist.png
- **用途**：D「苔庭 · 雾中山居」的入口 —— 石径穿薄雾细雨通向月洞门，水墨气质。
- **参考模板**：Example 26「Fantasy Dreamscape Environment」（辽阔氛围场景手法），改写为写实中式水墨调，去奇幻元素。
- **完整提示词**：
  > A serene atmospheric photograph of a traditional Chinese courtyard: a wet stone-slab path leads through thin drifting mist and fine drizzle toward a round moon gate. A single paper lantern glows softly, its warm halo diffusing in the fog. Muted ink-wash palette of grey-green and rice-paper white, wet stone reflections, delicate rain, a tranquil zen mood, cinematic depth, soft diffused light, horizontal 3:2 composition, photorealistic with a poetic ink-painting atmosphere.
- **状态**：成功

### 5. courtyard_study.png
- **用途**：D 概念的思考映射 —— 中式书房内景（卷轴/砚台/纸灯/窗外竹影薄雾），墨会晕开活过来的钩子的静态氛围板。
- **参考模板**：Example 18「Interior Space Reimagined」（室内空间氛围）＋ Example 26（氛围场景手法），落到水墨调。
- **完整提示词**：
  > An atmospheric photograph of a traditional Chinese scholar's study interior. A low wooden table holds an open hand-scroll, an inkstone with a brush and ink stick, and a glowing paper lamp. Beyond a lattice window, bamboo shadows and thin mist. Muted ink-wash palette, warm lamp glow against cool misty daylight, a calm meditative mood, faint wisps of incense smoke, shallow depth of field, cinematic, horizontal composition, photorealistic with a poetic ink-painting atmosphere.
- **状态**：成功

---

## 英雄物件概念图（`references/generated/objects/`，产品摄影感：单物体、干净背景、考究打光）

### 6. obj_headphones.png
- **用途**：物件陈列 —— 用了几年、皮质头梁有磨损包浆的头戴耳机。
- **参考模板**：Example 3「Minimalist Furniture Photo」（`Photo of a {item} on a … backdrop` 产品摄影骨架）＋ Example 32「Glass Vase Design」（material / presentation 结构化字段）。
- **完整提示词**：
  > Product photograph of a pair of well-used vintage over-ear headphones, the leather headband showing worn patina and gentle creasing from years of use, a brushed-metal yoke, and plush ear cushions. Presentation: clean neutral warm-grey seamless background, soft studio key light with gentle rim light, a subtle reflection, shallow depth of field, refined high-end product photography, realistic rendering, square 1:1 image.
- **状态**：成功

### 7. obj_inkstone.png
- **用途**：物件陈列 —— 端砚＋墨锭＋毛笔的文房质感。
- **参考模板**：Example 3「Minimalist Furniture Photo」（产品摄影骨架，minimalist 语汇）＋ Example 32（material/presentation 结构化字段）。
- **完整提示词**：
  > Product photograph of traditional Chinese scholar's stationery: a dark Duan inkstone with a shallow well holding glossy black ink, a single ink stick resting on it, and a bamboo-handled calligraphy brush laid beside it. Presentation: clean warm-grey seamless background influenced by minimalist aesthetic, soft directional studio light revealing the fine stone texture and the lacquered brush, a subtle shadow, realistic rendering, refined product photography, square 1:1 image.
- **状态**：成功

### 8. obj_paper_lantern.png
- **用途**：物件陈列 —— 一盏素色纸灯笼，暖光从内透出（与庭院/书房场景呼应）。
- **参考模板**：Example 8「Blown Glass Speaker」（半透明材质 / 内透光的表达）＋ Example 32（material/presentation 结构化字段）。
- **完整提示词**：
  > Product photograph of a single plain undecorated paper lantern, warm light glowing softly from within so the paper skin becomes luminous and translucent, revealing the subtle ribbing of the frame. Presentation: a dark neutral seamless background to make the glow stand out, gentle studio rim light on the paper edges, realistic rendering, refined atmospheric product photography, square 1:1 image.
- **状态**：成功

### 9. obj_poetry_book.png
- **用途**：物件陈列 —— 一本翻旧的布面精装诗集，书角磨圆。
- **参考模板**：Example 3「Minimalist Furniture Photo」（产品摄影骨架，raw-material 质感语汇）。
- **完整提示词**：
  > Product photograph of a single well-thumbed hardcover poetry book with a cloth-bound cover in a muted dusty hue, corners softened and rounded from years of handling, a slightly worn spine, and faintly yellowed pages. Presentation: clean warm-grey seamless background, soft studio key light with a gentle shadow revealing the cloth texture, shallow depth of field, refined high-end product photography, realistic rendering, square 1:1 image.
- **状态**：成功

### 10. obj_perfume.png
- **用途**：物件陈列 —— 一小瓶香水/香料瓶，玻璃质感。
- **参考模板**：Example 32「Glass Vase Design (Amber Spheres)」（`material / shape / presentation` 结构化玻璃产品摄影骨架）＋ Example 8（透明材质打光）。
- **完整提示词**：
  > Create a photo of a small glass fragrance bottle. Material: clear glass with a faint amber-tinted fragrance inside and a small brushed-metal cap. Shape: a compact rounded rectangular flacon with softly faceted shoulders that catch the light. Presentation: clean warm-grey seamless background, soft studio lighting with a bright specular highlight along the glass edge and a gentle reflection beneath, realistic rendering, refined high-end product photography, square 1:1 image.
- **状态**：成功

---

## 生成小结

- **成功 10 / 跳过 0**（2026-07-11，Codex CLI 0.144.1，`codex exec` + 内置 image_gen，ChatGPT OAuth，无 API key）。
- 所有成图均 >1MB（1.3–2.7MB），远超 100KB 验收线；场景图横/竖构图按内容，物件图方构图。
- **管线备注**：Codex 沙箱 shell 对本项目目录写入被拒（Copy-Item Access denied），image_gen 产物统一落在 `~/.codex/generated_images/<uuid>/exec-*.png`，由外层（Claude）用"时间戳守卫"（记录生成前最新 png 的 mtime → 生成后仅接受严格更新且 >100KB 的文件）逐张搬运到位，杜绝拿旧图冒充新图。
- 提示词模板来源说明：任务原指定的 `EvoLinkAI/awesome-gpt-image-2-API-and-Prompts` 在 GitHub 上不存在（clone 404，该账号无公开仓库），已改用同类精选集 `jamez-bondos/awesome-gpt4o-images`（含 OpenAI 官方 gpt-image-1 的 40 个精选案例整理翻译）作为模板来源。
