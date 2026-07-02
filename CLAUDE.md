# 灵境 / Innerscape — 仓库守则（潮汐图书馆 / The Tide Library）

把一个人的内在世界，做成可以走进去、可以参观、可以停留、并**随他生长**的三维空间。
**潮汐图书馆**：一座暖灯的读书回廊，立在一片只有几厘米深、却完美映出整片星空的镜面水上。
你"走在星海上"，每一步都在星空倒影上荡开涟漪。冷的水与天 × 暖的灯与书。
> 实现细节随你发挥，但下面"不可动"的一侧必须守住。Claude Code 读本文件，Codex 读 `AGENTS.md`，二者内容相同。
> 概念/参照/满分见 [references/REFERENCES.md](./references/REFERENCES.md)；怎么做的取舍见 [DECISIONS.md](./DECISIONS.md)。

## 不可动（产品内核 / 承载性约束）

1. **内核**：把内在世界做成可走进去、并**随用户生长**的空间。今天的他和三个月后的他，空间应当不同。
2. **世界必须能从保存的数据完整重建**；渲染层只**读**这份数据，不把内容写死在组件里。
   - "舞台 vs 内容"之分：回廊/书墙/灯/水/潮汐是**舞台**（可编排）；用户投入的一切（思考/物件/音轨）是**内容**（`Entry`，数据驱动）。守的是后者。
   - 这是"生长 / 走进过去的自己 / 后期接 AI"能廉价实现的前提，是唯一硬要守住的、形状无关的原则。
   - **三个 zone id/type（bookshelf/objects/record）属于数据契约**：可换皮肤、换几何，但不要写死内容、不要破坏"按 id 数据驱动"。
3. **本地优先**，不加账号 / 不依赖任何 LLM / 不依赖任何外部下载（模型、HDRI、贴图都自给自足）。
   - 例外：**音频允许用 CC0/CC-BY 真实文件**（放 `public/audio/`，离线打包进仓库），这是本轮明确要求（不要再用振荡器合成音乐）。
4. **护城河逻辑**：竞争在"生成之后"——留人、回访、沉淀。每个功能都要回答：它增加了"用户已投入的内容"还是"回来的理由"？都不是 → 砍。

## 验收 · FLOOR（入场价，默认要做到，不当成就罗列）

多空间可上下楼 · 电影感导航 · 强烈统一艺术指导 · 考究光照+氛围+后处理 · 真实材质 · **真实可播放且空间化的音频** ·
按主题做天气/特效 · 点击有回报的互动 · 文字可写可存刷新还在 · 能流畅跑（含低端降级）。
> 状态（诚实）：舞台/导航/光照/后处理/星海镜面水/潮汐/漂浮书 已成形；**互动 zones、真实音频、入场编排、写字沉水** 待接（见 DECISIONS 弱项清单）。

## 当前实现的骨架（潮汐图书馆）

- 唯一几何真相源：`src/theme.ts` 的 LAYOUT（`R_COURT` 镜面广场 / `DECK`+`STEPS` 观星台坡道 / `PEDESTALS` 浮岛 / `BOOKWALL` 书墙弧 / `GRAMOPHONE` / `tideOffset`；`ZONE_ANCHORS`/`FOCUS` 按 **zone type** 索引——id 属于用户数据，可改名）。
- 场景：`scene/Sky`（星空穹顶+银河+星点+月+地平线辉光带，水下镜像副本＝"星海倒影"底衬）、
  `scene/Water`（高配 MeshReflectorMaterial 真平面反射——"黑镜"配方 metal 1+暗 albedo+fog=false；低配菲涅尔玻璃水零 RT；+ `scene/ripples` 脚步涟漪叠加）、
  `scene/Vista`（远景层：群岛剪影 InstancedMesh + 呼吸灯塔 + 漂流水灯——纯背景，不进碰撞/契约/theme）、`scene/Starfall`（广场中心星光柱，假体积弦长 shader，雨夜熄灭）、
  `scene/gallery/`（八件陈设一件一文件：灯笼/书墙/观星台/写作台/浮岛/漂浮书/听歌角/留声机 GLB；共用件在 `profiles.ts` 车削轮廓、`materials.ts` 单例材质、`glow.tsx` 渐变光晕 Sprite；随机一律种子化 `scene/rng.ts`）、
  `scene/Lighting`（冷月主光+暖补光+Environment；消费 mood：雾/环境光/暖灯）、`scene/Atmosphere`（薄雾+微尘+偶发落水+Starfall；消费 mood：雾色浓淡 + 雨夜远雷）、`scene/SunkenThoughts`（思绪光点：核心 InstancedMesh + 晕圈点精灵，单 useFrame，renderOrder 4 透水发光）。
- 导航/相机：`scene/PlayerControls`（帧循环五态编排；漫游有惯性/步伐包络/FOV 随速微张）+ `scene/input.ts`（DOM 输入接线）+ `scene/cameraDirector.ts`（聚焦取景/指数阻尼/避障方位选择 `computeFocusPoseClear`，纯函数有单测）+ `scene/audioListener.ts`（听者同步，位姿未变跳过）+ `scene/walk.ts`（纯函数碰撞：广场∪坡道∪观星台并集 + 台上道具圆柱碰撞，连续线性坡）。`walk.test.ts`/`cameraDirector.test.ts` 单测。
- DEV 验证：`localStorage.lj_quality="high"|"low"` 钉死画质（自动化页签 rAF 节流会让 PerformanceMonitor 误判降级，不钉死验不到高画质路径）；DevBridge 暴露 `__lj`/`__ljStore`/`__ljAudio`。
- 数据/持久化（**沿用，未改契约**）：`store/useWorld`、`config/types`(联合类型由 const 数组派生，io 校验同源)、`config/moods.ts`(心境→氛围唯一真相源)、`data/io`(校验往返)、`data/db`(IndexedDB)、`data/seed`(首次种子)。
- 数据驱动渲染：`scene/zones/*`（书脊由思考点亮、物件按 primitive/color 生成、唱片机转碟绑 `useAudio.musicPlaying`）。
- 音频：`audio/engine.ts`（水声独立起播；曲库压缩字节常驻、PCM 按需解码只留当前+下一首；坏轨自动跳；远雷合成）+ `audio/useAudio`（UI 镜像，换曲以引擎回调为准）。
- UI：`ui/Hud`（纯编排）+ `EnterOverlay`/`Reticle`/`DockControls`；三面板共用 `ui/useEntryForm` 表单生命周期。
- 后处理：`scene/PostFX`（SMAA + Bloom + 色彩分级 + AgX + 暗角 + 轻颗粒；无 DOF——第一人称走动里太贵）。

## 开发

```bash
npm install
npm run dev      # 本地开发（点「进入」开声场 + 锁定指针）
npm test         # 单测：IndexedDB 真实往返 + 漫游求解器纯函数
npm run build    # tsc 严格档 + vite 生产构建
```

## 改动前自检

- 新功能有没有让"世界可由数据完整重建"不再成立？（把**用户内容**写死进组件、绕过 store 落盘）——若是，停手重想。舞台可编排，内容必须数据驱动。
- 新内容类型 → 扩 `Entry`/`ZoneType` + `io.ts` 守门，让渲染按数据分发，别在组件里硬编码具体条目。
- 改了几何/位置？`theme.ts` 是 Gallery / walk / 相机的共用真相源——只改一处。
- zustand v5 选择器**不得**返回新数组/对象（getSnapshot 死循环）；过滤在 `useMemo` 里做。
- 改完跑 `npm run build` + `npm test`，并在浏览器里走一圈确认没崩、帧率可接受、**音频真的在响**。
