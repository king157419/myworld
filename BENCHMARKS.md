# BENCHMARKS — 潮汐图书馆视觉/手感标杆与重实现配方

> 一座暖灯读书回廊浮在映满星空的镜面水上，第一人称漫游。
> 技术栈：React Three Fiber 9 + React 19 + three 0.185 + @react-three/drei 10 + @react-three/postprocessing 3 + zustand，**全程离线**。

## 本文用途与内化原则

本文档把每一项「真机审计弱点（W1–W7）」对应到行业标杆作品与可落地的 R3F 配方。它不是抄袭清单，而是一份**技法地图**：标杆告诉我们"好在哪、为什么可信"，配方告诉我们"在我们这套栈里怎么用最少的钱做出同等观感"。

**内化原则（强约束，逐条执行）：**

1. **只借技法，不搬作品。** 对有辨识度的成品场景/资产（Bruno Simon、Henry Heffernan、Codrops 的 Susurrus/Windland/Fan-Museum、Three.js Journey 课程示例等）——**绝不整段搬运、绝不克隆**其几何/贴图/外观。读其原理、重写其数学。
2. **许可分级，离线优先。** 可直接用的：MIT（drei、camera-controls、ecctrl、react-three-rapier、pmndrs/postprocessing 的 Zlib）、CC0（Poly Haven HDRI、@pmndrs/assets）。所有 HDRI / blue-noise / cookie / normal map 一律**打进离线资产包，禁止引 CDN**。
3. **最轻路径优先，按 ROI 排序。** 先做"低 effort、高收益、连带修多个弱点"的层（统一氛围底座、接地三件套、碰撞滑动），把 Blender 烘焙、自写 raymarching 这类 high-effort 收尾留到观感证明值得时再上。
4. **每层可独立验证。** 沿用 MEMORY 的隐藏 tab 验证流程（DevBridge + resize-event + advance() 推帧 + canvas→local 截图接收器，避免 preview 在隐藏 tab hang），逐层截图对比，确认每加一层暗部对比没被冲平。

---

## W1 — 灯具是扁平 2D 圆盘"棒棒糖"

**目标：** 把贴片圆盘换成可信的 3D 灯具几何 + 物理自发光 + 选择性辉光。

> ⚠️ 前置认知：后处理 Bloom **救不了** 2D 圆盘——辉光加在贴片上只会让它变成"会发光的贴片"，更暴露廉价。**必须先换 3D 灯具几何**，辉光才有意义。W1 本质是建模 + 材质活，后处理只是配套。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪（只取哪一招） |
|---|---|---|---|---|
| Henry Heffernan Portfolio | https://github.com/henryjeff/portfolio-website | Henry Heffernan | MIT（保留版权声明） | "暖暗室内 + 自发光屏幕"的取舍范例：只有 CRT/小灯是真高光（emissive>1），房间其余靠氛围光。对应我们"灯芯发光、灯罩/金属不发光"的纪律。学方法不抄外观。 |
| drei `<Bloom mipmapBlur>` + selective bloom | https://github.com/pmndrs/postprocessing | pmndrs（vanruesc） | Zlib（可商用） | 让"谁发光"由材质把颜色抬出 0–1 决定，而非靠图层。mipmapBlur 的辉光比固定 kernel 更软更便宜。 |

### 我们怎么重实现

1. **建真灯具网格**：灯柱 + 灯罩 + 灯泡三段。
   - 灯泡：`meshStandardMaterial` 的 `emissive={PALETTE.lampCore}` + `emissiveIntensity={1.8~3.0}`（核心高、外圈衰减低）。
   - 灯罩：半透明 + 适度透射（`MeshPhysicalMaterial` 的 `transmission` / `thickness`），让灯罩透出暖光而不发糊。
2. **选择性辉光（材质侧决定，不用 SelectiveBloom 图层）**：
   ```tsx
   <Bloom intensity={0.8} luminanceThreshold={0.98} luminanceSmoothing={0.28} mipmapBlur radius={0.8} />
   ```
   阈值抬到 ~1.0：默认什么都不泛光，只有灯芯/月/喉光这类 `emissiveIntensity>1` 的材质越过阈值发辉。
3. **金属/灯柱不进 bloom**：albedo 留在 0–1、emissive=0，靠 IBL 出高光（见 W3）。

### Pitfalls
- **顺序错**：先上 bloom 不换几何 = 廉价更明显。先建模。
- emissive + Bloom 的 three 坑（mrdoob/three.js #24703）：直接全屏 Bloom 可能把不该亮的点亮或 emissive 不被拾取 → 用精确 `luminanceThreshold` 或单独 layer 圈定。
- `luminanceSmoothing` 太小（默认 0.025）+ 阈值≈1 → 高光边缘硬、走动时大亮面闪烁；给 0.2–0.35 软过渡。

### Effort：**中**（主要是建模/材质工时，技术风险低）

---

## W2 — 一切都漂浮、互不相连（无落地感/实体感）

**目标：** 用"接地三件套 + 一体化烘焙 + 构图地脉"把碎片焊成一座建筑。根因是缺三样：接触阴影、统一光环境、贯穿的实体基座。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪 |
|---|---|---|---|---|
| Susurrus — A Cozy Watercolor World | https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/ | Xianyao Wei | 教程免费可读；成品资产**仅学技法** | 几乎同构——房子浮在镜面水上的近景体验。学其三层水系统让物体"坐"在水上、用倒影做接地线索。 |
| Windland — Immersive Three.js | https://tympanus.net/codrops/2022/04/25/case-study-windland-an-immersive-three-js-experience/ | Anderson Mancini | 教程免费；starter `threejs-andy-boilerplate` 开源(MIT 系)；成品资产**仅学技法** | "把分散浮岛焊成一体"讲得最透：所有地面阴影烘进单张 2048² 纹理，运行时零阴影开销却处处有接地软影。 |
| Fan Museum（Blender→three.js） | https://tympanus.net/codrops/2025/04/08/3d-world-in-the-browser-with-blender-and-three-js/ | Andrew Woan | 文章免费；仓库 github.com/andrewwoan/codrops-fan-museum 开源（核查条款）；内含 Sketchfab 第三方模型各自许可**逐个核对** | 最完整的烘焙落地配方：4096² EXR→KTX2/WebP、单 HDRI 转 cubemap 保光向一致、noise mask+color ramp 破均匀感、增大点光 radius 出软影掩盖烘焙瑕疵。 |
| Henry Heffernan Portfolio | https://github.com/henryjeff/portfolio-website | Henry Heffernan | MIT | 可信感几乎全来自"一个封闭、连续、有地板墙角的整体盒子"，所有物件贴真实表面。支柱4（连续实体基座）最佳学习对象。 |
| drei `<AccumulativeShadows>` / `<ContactShadows>` | http://drei.docs.pmnd.rs/staging/accumulative-shadows | pmndrs | MIT | 官方 "grounding objects" 标准做法：一次性烘焙、跑完 frames 后零开销的接地软影。 |

### 我们怎么重实现（A→D，前三步即大幅缓解 W2/W5）

**步骤 A · 构图地脉（最便宜见效最快，先改空间结构）：**
- Blender 里给回廊建连续实体：环形低台座 + 立柱 + 顶部连廊横梁。书架建模为"长在台座上"（底边与台面共面、有踢脚），灯具"挂在梁上/立在台座"，书放架格内绝不悬空。
- "缝里透星空"改为"缝里透下方水光/暖光"：缝两侧给厚度（倒角），缝底放窄自发光暖条或让其映水 → 从"穿帮虚空"变"有厚度的接缝"。

**步骤 B · 接地三件套（R3F 组件，立即提升落地感）：**
- 每座浮岛（书架+灯+桌一组）外套：
  ```tsx
  <AccumulativeShadows temporal frames={60} resolution={1024} scale={岛宽*1.3}
    alphaTest={0.85} opacity={0.8} color="#1a1410" colorBlend={1.5} position={[ix, 岛面y+0.001, iz]}>
    <RandomizedLight amount={8} radius={4} ambient={0.5} intensity={1}
      position={[暖主灯dx,5,暖主灯dz]} bias={0.001} mapSize={1024} />
  </AccumulativeShadows>
  ```
  `temporal` 烘焙期会短暂掉帧 → 放进场加载界面期间跑完。
- 悬空小物（单本书/摆件）用便宜版：`<ContactShadows position={[x,底y,z]} scale={2} blur={2.5} far={1.5} opacity={0.6} resolution={512} color="#1a1410" />`。

**步骤 C · 水面存在感 + 倒影接地（同时治 W5，见下节）。**

**步骤 D · 一体化烘焙光 + 氛围（治 W4，连带帮 W3）：**
- Blender 把整座回廊 + 灯 spill + 相互 AO/软影烘到 2048²（移动）或 4096²（桌面）→ KTX2(basis)/WebP，离线打包。运行时书架/台座材质换 `MeshBasicMaterial` 贴烘焙图（或 lightMap 通道），实时光只留一两盏主暖光。
- 全局 `<Environment>` 用自制暖调 HDRI 提供 IBL；`<fogExp2 attach="fog" args={['#2a1d14', 0.015]} />` 把远处碎片融进暖雾。
- postprocessing：`<N8AO aoRadius={0.6} intensity={2} />` 在物体接缝处长出接触暗角，进一步焊成一体。

### Pitfalls
- **第一人称 + baked AO 矛盾**：烘焙阴影是死的，自由走动会从某些角度看出方向不对 → 烘焙只承担视角不敏感的软 AO/间接光，硬接触影交给运行时 ContactShadows/AccumulativeShadows。
- AccumulativeShadows 每组一个 RT，浮岛多就分批/远的不挂；MeshReflectorMaterial 每实例一遍额外渲染（drei #1777 记录会显著增 geometry/texture 计数）→ 全场只用一个大水面实例。
- **别用 `<Float>` 修饰漂浮**——那会强化散乱感。要做的是接地，不是更优雅地漂。
- 烘焙工时是硬成本：跳过 Blender 纯实时光，"焊成一体"效果显著打折——这是 effort 下限。

### Effort：**高**（三件套 med、1–2 天见效；烘焙管线 + 重建模是 high，占改造 60–70% 投入）

---

## W3 — 留声机喇叭黑洞 + 金属又平又黑

**目标：** 金属变黄铜、喇叭内壁有暖辉。根因：纯金属 `metalness=1` 没有漫反射项，只反射环境；夜景 `scene.environment` 接近全黑 → 黄铜读作"黑漆"。修法三件套：给金属一张**含亮像素的 HDRI**、`environmentRotation` 把亮斑转到金属正面、喇叭内壁 `DoubleSide` + 喉光。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪 |
|---|---|---|---|---|
| Poly Haven Night HDRI（moonlit_golf / dikhololo_night 等） | https://polyhaven.com/hdris/night | Poly Haven（Greg Zaal 等） | **CC0**（可商用/打包/无需署名） | 金属要反射的不是"光"而是"有亮斑的环境"。moonlit_golf 21 EV 硬月亮在黄铜上形成可信镜面高光，瞬间把"黑漆"变"金属"；dikhololo_night 3776K 暖银河配暖灯回廊。EXR/HDR、可离线打包。 |
| @pmndrs/assets（hdri 子集：night 等） | https://github.com/pmndrs/assets | pmndrs（HDRI 选自 Poly Haven） | **CC0**（HDRI 源 CC0；包 MIT） | 为离线量身定做：512×512 DWAB-EXR、约 100–200KB，`import '@pmndrs/assets/hdri/night.exr'` 懒加载、不进主包、不依赖 CDN。环境照明用它即可；大面积清晰反射体（喇叭）另配 1–2K 原图。 |
| drei `<Lightformer>` + `<Environment>` 假光棚 | http://drei.docs.pmnd.rs/staging/lightformer | pmndrs | MIT | 不靠真 HDRI 也能精确雕刻金属高光：`form="ring"` 在喇叭口沿造环状高光、`form="rect"` 当窗反射。进 envmap 不花光照预算，可放很多个。 |
| Henry Heffernan Portfolio | https://github.com/henryjeff/portfolio-website | Henry Heffernan | MIT | baked AO + 实时 IBL/高光叠加，物件"钉"在台面。其 CRT 自发光屏处理可迁移到喇叭喉光。 |

### 我们怎么重实现

1. **离线 IBL 骨架（治 W3+W4 地基）：**
   ```jsx
   <Environment files={suspend(night)} background={false}
     environmentIntensity={0.6}            // 夜景压低，别洗掉暖灯对比
     environmentRotation={[0, 1.2, 0]}>    // 转动让月亮亮斑扫到黄铜正面——逐度试
     <Lightformer form="rect" intensity={2} color="#ffd9a0" scale={[6,2,1]} position={[0,4,-6]} target={[0,1,0]} />
     <Lightformer form="ring" intensity={3} color="#fff0d0" scale={[2,2,1]} position={[2,2,3]} />
   </Environment>
   ```
   `background={false}`：环境只供反射/照明，背景仍用自己的星空镜面。
2. **黄铜材质分级（治平黑/塑料感）：**
   ```jsx
   <meshStandardMaterial color="#b5894a" metalness={1} roughness={0.28}
     roughnessMap={brassRoughTex} envMapIntensity={2.0} />
   ```
   抛光喇叭口 roughness≈0.15、做旧机身≈0.4、铸件底座≈0.5。需拉丝高光换 `meshPhysicalMaterial anisotropy={0.6} anisotropyRotation={…}`。**一张 roughnessMap（哪怕程序噪声）比单一糙度值真实十倍。**
3. **喇叭黑洞专修：** 内壁 `side={THREE.DoubleSide}`（或单独翻法线一层）+ 喉口放 `<pointLight intensity={3} distance={1.5} color="#ff9a5c"/>` 或一个 r=0.05 emissive 暖橙小球当喉光 → "黑洞"变"会泛光的暖喉"。

**验证：** 关所有点光只开 IBL 看黄铜是否已现高光；用 Leva 把 `environmentIntensity / envMapIntensity / environmentRotation` 接成滑杆，眼睛定夺月亮亮斑落点。

### Pitfalls
- **metalness 折中是头号错误**：金属就是 1，调 0.3–0.7 想"柔和"只会发灰发脏；要更暗用降 color 反照率或升 roughness，别动 metalness。
- 夜景 `environmentIntensity` 太高 → 把暖灯"小水洼"洗成均匀灰，戏剧性全失。夜景压到 0.4–0.8，靠 Lightformer/点光做局部对比。
- 用 drei preset（city/sunset）省事 → 白天图会让夜景穿帮发蓝/发橙；坚持夜景 HDRI。
- **忘了 `environmentRotation`**：亮斑不在金属正面，黄铜照样平黑——"明明加了 HDRI 还是黑"的常见坑。
- 512px EXR 做大面积清晰镜面反射会糊；主反射体（喇叭）单独上 1–2K 本地原图。
- 全场 DoubleSide 翻倍金属面成本且可能 z-fight；只对喇叭内壁那一段开。
- color 走 sRGB：three 0.185 默认 ColorManagement 开启，用 `#hex` 字面量交给 three 转换，别自己换算 linear 值。

### Effort：**中**

---

## W4 — 整体太暗，暖光是孤立小水洼

**目标：** 用"统一氛围底座 + 暖夜后处理栈 + 体积光"消除割裂感。核心是三层叠加：(A) 统一基础氛围（IBL + 暖雾 + tone mapping），(B) 体积介质里的光轴（god rays），(C) 灯具本体（emissive + bloom，见 W1）。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪 |
|---|---|---|---|---|
| On Shaping Light: Volumetric Lighting with Raymarching — Maxime Heckel | https://blog.maximeheckel.com/posts/shaping-light-volumetric-lighting-with-post-processing-and-raymarching/ | Maxime Heckel | 教学文章**仅学技法**（照原理重写，勿复制代码） | web 上"真·体积光 raymarching"讲得最透：屏幕 UV→世界坐标重建、沿视线 march、SDF 塑形光体、从灯光视角 shadow map 做真遮挡、Henyey-Greenstein 各向异性散射、blue noise 把 5000 步降到 100 步不出条带。对症拱廊立柱间被柱子切割的斜射丁达尔。 |
| three-good-godrays | https://github.com/Ameobea/three-good-godrays | Casey Primozic（原型 n8programs） | **Zlib**（可商用，保留出处） | 把 raymarched godrays 做成开箱即用库，明确测过 three 0.125–0.182（贴近我们 0.185）。GodraysPass 接 PointLight/DirectionalLight，真采样 shadow map 做遮挡（非假 blur）。 |
| GodRays — @react-three/postprocessing | https://react-postprocessing.docs.pmnd.rs/effects/god-rays | pmndrs（底层 vanruesc） | MIT | 就在我们栈里。声明式 `<GodRays sun={ref} .../>`，本质对光源 mesh 做放射状模糊——便宜、移动端友好。适合留声机喇叭口喉光/某盏主灯的廉价光晕（光源必须在屏幕内）。 |
| drei 体积 `<SpotLight>` + `<SpotLightShadow>` | http://drei.docs.pmnd.rs/staging/spot-light | pmndrs | MIT | `useDepthBuffer()` → 带软粒子边缘的实体暖光锥；SpotLightShadow 投 alpha cookie（窗格/书架镂空）到地面/水面，直接给"落地感"(W2)/"水面存在感"(W5)。**与 logarithmicDepthBuffer 不兼容。** |
| Three.js Journey — Post-processing with R3F | https://threejs-journey.com/lessons/post-processing-with-r3f | Bruno Simon | 付费课程**仅学技法** | 同栈 AgX+Bloom 权威配方：ToneMapping(AGX) 永远放链尾；Bloom 默认就是选择性的，由材质把颜色抬出 0–1 控制。 |
| Bruno Simon folio-2025 | https://github.com/brunosimon/folio-2025 | Bruno Simon | **MIT**（保留版权声明） | "全局氛围一致性"：用统一环境/雾/色调把所有光源缝进同一种空气里。借工程结构，不抄卡通赛车美术。 |

### 我们怎么重实现（四层，循序渐进、各层可独立验证）

**第 0 层 · 统一氛围底座（先做，最便宜收益最大）：**
- `<Canvas>` 设 `gl={{ toneMapping: THREE.NoToneMapping }}`，把 AGX 交给 post 链尾（避免双重曝光）。
- drei `<Environment>` 放离线夜色/暖室 HDRI（`environmentIntensity ~0.15–0.3`），同时修 W3 金属平黑。
- 暖色高度雾：`<fogExp2>` 不够就自定义指数高度雾（按 viewZ + 世界高度混入暖色 #2a1d12），给空气以介质让光轴有东西可散射。别盖死暗部对比。

**第 1 层 · 灯具本体（见 W1）。**

**第 2 层 · 回廊暖光锥（全在现有栈内）：**
- `const depthBuffer = useDepthBuffer({ size: 512 });` 每盏廊灯一个 `<SpotLight depthBuffer={depthBuffer} volumetric angle={0.5} attenuation={5} anglePower={4} distance={6} color="#ffd9a0" />`，朝下/朝水面。
- `<SpotLightShadow>` 投一张镂空 cookie（书架镂空/廊柱间隙 alpha 图）到地面与水面，直接加分 W2/W5。

**第 3 层 · 真丁达尔光轴（只挑 1–2 个主光做，不要全场）：**
- 路线 A（省力）：装 three-good-godrays，`new GodraysPass(pointLight, camera, { density, maxDensity, raymarchSteps:60, distanceAttenuation, color, blur:true })` 接进 EffectComposer。注意 pass 顺序与 gamma（库默认 gammaCorrection 开，与 @react-three/postprocessing 串联要实测，防双重 gamma 发灰）；先自测它在 three 0.185 能跑。
- 路线 B（最可控）：按 Heckel 原理自写 postprocessing Effect（`wrapEffect`）：depth + projectionMatrixInverse/viewMatrixInverse 重建世界坐标 → march ≈64 步 → 采样主灯 shadow map 判遮挡 → Henyey-Greenstein 前向散射 → blue noise 按 frame 抖动去条带 → 半分辨率 RT + bilateral blur 升回。

**暖夜后处理栈（落到 `src/scene/PostFX.tsx`）：**
```tsx
<Bloom intensity={0.8} luminanceThreshold={0.98} luminanceSmoothing={0.28} mipmapBlur radius={0.8} />
<HueSaturation saturation={0.15} />
<BrightnessContrast brightness={0.02} contrast={0.14} />
<Vignette eskil={false} offset={0.34} darkness={0.55} />
<Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.08} /> {/* 低端关掉 */}
<ToneMapping mode={ToneMappingMode.AGX} /> {/* 永远链尾 */}
```
> AGX 偏暗偏平是**特性不是 bug**。要"先把场景照亮再让 AGX 收"——把 `Lighting.tsx` 的 directional/point/Lightformer intensity 整体上调 25–40% 给 AGX HDR 余量去滚降，再用 saturation/contrast 找回暖色。**不要事后用 BrightnessContrast 硬拉亮**（会把暗部噪点和 bloom 台阶一起拉出来）。

> ⚠️ **已踩坑修正**：`toneMapped={false}` 在走 EffectComposer 时被 three.js 忽略（只有直出屏幕才生效）。当前 PostFX 注释"星点/水面/光点靠 toneMapped=false 让 post 这道 AGX 压"语义不成立。**发光与否一律用 `emissiveIntensity` / `color>1` 控制**，由链尾 AGX 统一压。

### Pitfalls
- **顺序错**：必须先做第 0 层（tone mapping + IBL + 雾）再上体积光。先上 god rays 不配 IBL/tone mapping，暗部依旧死黑，且体积光会把场景冲成"奶雾"。
- pmndrs GodRays 根本限制：光源出屏即消失、不做真遮挡，第一人称转头穿帮、柱子切不出光条。只当单灯光晕用。
- raymarching 性能：全屏 × 高步数会卡。务必半分辨率 + blue noise dithering + raymarchSteps 48–64，只对主光做、只在镜头看得到时启用。
- 透明物体破坏 depth：镜面水/玻璃灯罩会让屏幕空间体积光在水面/灯罩处错乱，水面光轴单独处理。
- ToneMapping 不在链尾 / renderer 又开了 toneMapping → 双重曝光死黑。
- luminanceThreshold 抬到 1 但忘了给材质抬 emissive>1 → "什么都不发光"，会误判 bloom 坏了。
- **别被 star 骗**：真正解 W4 的是 raymarching+IBL+雾的组合，不是 star 最高的 blur 方案。
- 离线约束：HDRI、blue noise、cookie 全打进离线包，禁引 CDN。

### Effort：**中**（第 0 层低；路线 A 中 2–3 天；路线 B 高约 1 周，仅当 A 质感不够再上）

---

## W5 — 镜面水太透明，没有水面存在感；低头边走涟漪抽搐

**目标：** 三层叠出"水面感"——平面反射给镜子、菲涅尔做"水面 vs 玻璃地板"的根本区别、流动法线给破碎感；同时治抽搐（几乎必然是时序/精度，不是美术）。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪 |
|---|---|---|---|---|
| drei `<MeshReflectorMaterial>` | https://drei.docs.pmnd.rs/shaders/mesh-reflector-material | pmndrs（Paul Henschel 等） | MIT | 栈里的地基：Reflector RTT、各向异性 blur、depth-based blur、distortionMap、mirror 都参数化。继承 MeshStandardMaterial，可 onBeforeCompile 注入菲涅尔/世界锚定法线扰动。 |
| three.js Water2（Valve Portal2 Flow 法） | https://github.com/mrdoob/three.js/pull/12341/files | Michael Herzog (Mugen87) | MIT | 治"抽搐/重复感"权威源头：双法线 + half-offset 在两套 flow 间 lerp（一套被 reset 时另一套全显），系统性消除"同相位一直抖"的重复 artifact；fresnel 项混合反射/折射。 |
| nhtoby311 / WaterSurface | https://github.com/nhtoby311/WaterSurface | Toby Nguyen | **未声明许可**（仓库无 LICENSE）→ **仅学技法**，勿整包搬运/npm 安装 | 最对口的 R3F 参考：Simple（单法线）/ Complex（Water2 双法线+flowMap）两档 + RippleFX/FluidFX 交互层。它锁 R3F8/three0.162，**只读 shader 别 `npm i`**（会与我们 R3F9/three0.185 冲突）。 |
| Codrops — Stylized Water with R3F (2025) | https://tympanus.net/codrops/2025/03/04/creating-stylized-water-effects-with-react-three-fiber/ | Thalles Lopes | 教程**仅学技法** | 轻量、不靠昂贵平面反射也有水面感的替代路线：CSM 扩 MeshStandardMaterial，Perlin+smoothstep 浪纹，distance-based 水色渐变，**共享 `uWaterLevel` uniform** 在所有"入水物件"上画同步泡沫条——给 W2 落地感的低成本做法（不读深度缓冲）。 |
| Susurrus（见 W2） | — | Xianyao Wei | 仅学技法 | 低分辨率 MeshReflectorMaterial 保氛围+性能，其上叠一层独立 shader 平面跑涟漪（与反射**解耦**）——正好规避涟漪抽搐的时序竞争。 |

### 我们怎么重实现（做成 `<TideWater />`，先 1+2 看俯/平视差异再叠 3+4）

1. **基底反射（drei，直接用）：**
   ```jsx
   <mesh rotation-x={-Math.PI/2} position-y={WATER_Y}>
     <planeGeometry args={[60,60,1,1]} />
     <MeshReflectorMaterial ref={matRef}
       resolution={1024}                  // 暗场景别低于1024，512会闪
       mirror={0.65}                       // 不要1，纯镜面像抛光大理石不像水
       mixStrength={3} mixBlur={1} blur={[300,100]}   // 各向异性：横向更虚像水平反光
       minDepthThreshold={0.9} maxDepthThreshold={1.1} depthScale={1}
       reflectorOffset={0.07}              // 防自闪/z-fight
       roughness={1} metalness={0} color="#0b1622" /> {/* 深暗水体底色 */}
   </mesh>
   ```
2. **注入菲涅尔（命门）+ 世界锚定细法线（onBeforeCompile）：** `fres = pow(1.0 - dot(V, up), 3.0)`，在深水色 `vec3(0.02,0.05,0.07)` 与反射色间 mix → 俯视看深暗水、平视看暖灯长倒影。`uTime` 用 `clock.elapsedTime % 100.0` 钳住防大数精度抖。
3. **双法线 offset 流动（治抖，Water2 法）：** `worldUV = vWPos.xz * 0.15`（世界锚定，相机平移水纹不跟屏幕滑），`ph = fract(uTime*0.04)`，两套法线 `mix(nA, nB, abs(0.5-ph)*2.0)`，扰动幅度 **0.02–0.05**（小幅度是关键）。
4. **交界泡沫/落地感（同打 W2）：** DepthTexture 在水面与入水物件相交处 `foam = 1.0 - smoothstep(0.0, uFoamDepth, sceneDepth - fragDepth)` 画亮边；低成本替代学 Codrops 用共享 `uWaterLevel`。

### Pitfalls
- **性能陷阱（最重要）**：MeshReflectorMaterial 每帧重渲整场景到 RTT，回廊+书架+大量暖灯下 resolution=1024+blur 是全场最大开销。浅水不需要完美镜面——先 512/无 blur 验证；慢速漫游可隔帧更新或站定才高分辨率。
- **抽搐别只调美术（必查 4 项）**：扰动 uv 是否锚到世界坐标（锚屏幕=一动就滑/抖）、时间项是否 `fract()`/取模（大数 float 丢精度=高频跳）、扰动幅度是否过大（>0.1 必抖）、`reflectorOffset` 是否过小导致自 z-fight 闪。**低头近看尤其暴露精度问题，必测近景。**
- **mirror=1 是假水**：没有菲涅尔的话俯视也是镜子=玻璃地板，永远做不出水面——W5 核心误区。
- onBeforeCompile 脆弱：注入点（`#include <dithering_fragment>` 等）依赖 three 0.185 shader chunk 名，升级可能失效；注入后 `material.needsUpdate=true`，用 `customProgramCacheKey` 避免错误缓存。
- DepthTexture 反算坑：开 logarithmicDepthBuffer / 正交-透视混用时反算线性距离公式不同，套错泡沫位置乱漂。
- 透明排序闪：给水面显式设 `depthWrite` 与 `renderOrder`。
- **别让水抢戏**：水是配角，mixStrength 和 normalScale 宁可保守。
- **版本不匹配**：WaterSurface 锁 R3F8，直接装会冲突——只读 shader。

### Effort：**中**（最高杠杆其实是"菲涅尔 + 暗水体色 + 世界锚定细法线"三样轻量项；平面反射先低分辨率验证再加码）

---

## W6 — 第一人称碰撞是径向夹回/弹出、不滑动

**目标：** 把"刚体物理"换成"运动学角色控制器（KCC）"，做 collide-and-slide：每帧给 desiredTranslation，控制器沿障碍法线裁剪后返回 correctedMovement，角色沿墙滑而不弹回。

> ⚠️ 诚实定位：Bruno Simon（Cannon 开车俯视）、Henry Heffernan（脚本/轨道相机）**都不是**自由第一人称沿墙滑，他们是"氛围/品质对标"。W6 的**直接代码来源是 three.js 官方 games_fps 与 Rapier KCC**。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪（取哪一招） |
|---|---|---|---|---|
| three.js 官方 games_fps（Octree + Capsule） | https://threejs.org/examples/games_fps.html | mrdoob 及贡献者 | **MIT** | W6 黄金参考：Capsule 对静态 Octree 做 capsuleIntersect，靠 `v -= (v·n)·n` 投影实现沿墙滑而非弹回；GRAVITY=30、地面阻尼 `exp(-4*dt)`、STEPS_PER_FRAME=5 子步进给无穿墙有惯性的手感。零物理引擎依赖，契合离线轻量。 |
| Rapier KinematicCharacterController（@react-three/rapier） | https://rapier.rs/docs/user_guides/javascript/character_controller/ | Dimforge（绑定 pmndrs） | Apache-2.0 / MIT | 工业级 collide-and-slide：`computeColliderMovement(desired)` 内部完成沿墙滑、`enableAutostep` 自动迈门槛/小台阶（服务 W2）、`enableSnapToGround` 贴地不飘、坡度角控制。动态物件可参与碰撞。 |
| pmndrs/ecctrl（浮空刚体控制器） | https://github.com/pmndrs/ecctrl | Erdong Chen | **MIT** | 浮空胶囊：向下射线测距 + 胡克弹簧-阻尼 `F = springK*(floatHeight-hit) - dampingC*v` 把角色悬停（默认 floatHeight 0.2 / springK 80 / dampingC 6），配 maxVelLimit/turnVelMultiplier 得 Bruno 级顺滑加减速，天然不卡台阶边缘。提供第一人称模式，可读其参数表对标调参。 |
| Bruno Simon Portfolio | https://bruno-simon.com/ | Bruno Simon | 版权所有**仅学手感/调参思路** | 物理手感反复微调直到对为止的工程态度，是打磨 W6 移动手感的品味标尺（非 FP 碰撞代码来源）。 |

### 我们怎么重实现（分阶段、可增量验证）

**第 1 阶段（最快见效，零新依赖——抄 games_fps 算法到 R3F）：**
1. 新建 `usePlayerController.js`，导入 `Capsule`、`Octree`（`three/examples/jsm/math/`，0.185 自带）。
2. 把"实体可碰撞物"（地板/书架立柱/留声机底座/浮岛着陆面）用隐藏 group 包起，`worldOctree.fromGraphNode(group)` 烘进八叉树。**只烘静态、用简化碰撞代理网格**（别用渲染高模），顺势给 W2 加实体地板。
3. 滑动关键三行（games_fps 原版）：
   ```js
   const r = worldOctree.capsuleIntersect(playerCollider);
   playerOnFloor = false;
   if (r) {
     playerOnFloor = r.normal.y >= 0.15;                       // 法线朝上=>站地
     if (!playerOnFloor) playerVelocity.addScaledVector(r.normal, -r.normal.dot(playerVelocity)); // 剔除墙面法向速度分量
     if (r.depth >= 1e-10) playerCollider.translate(r.normal.multiplyScalar(r.depth));            // 推出穿插
   }
   ```
4. 手感三件套：`GRAVITY=30`；`damping = Math.exp(-4*dt)-1`（空中再 ×0.1 保惯性）；**子步进** `const dt = Math.min(0.05, delta)/5; for(i<5){...}`。
5. 相机用 drei `<PointerLockControls/>` **只取朝向**，移动完全由 collider 驱动。
6. 抗"角落粘住"：capsuleIntersect 迭代 2–3 次。

**第 2 阶段（要更稳/动态物件/上台阶——切 Rapier KCC）：**
```js
const ctrl = world.createCharacterController(0.01);
ctrl.enableAutostep(0.4, 0.2, true);   // 自动上小台阶（配合 W2 落地感）
ctrl.enableSnapToGround(0.5);
ctrl.setMaxSlopeClimbAngle(45*DEG); ctrl.setMinSlopeSlideAngle(30*DEG);
ctrl.computeColliderMovement(collider, desiredTranslation);
rb.setNextKinematicTranslation(pos.add(ctrl.computedMovement()));
```

**第 3 阶段（要 Bruno 级丝滑——叠浮空胶囊）：** 动态刚体 + 锁旋转，向下 castRay 测 hit，浮空力 `f = springK*(floatHeight - hit) - dampingC*linvel.y`，水平移动 setLinvel 平滑插值到目标（maxVelLimit clamp）。从 ecctrl 默认起步。

**验证（必做）：** 贴墙斜按 W 确认沿墙滑而非弹回；贴内墙角按对角键确认不卡死、不抖；掠过地板边缘确认不漏地。STEPS/damping/speedDelta 做成 leva 实时调。先在隔离最小 demo 路由调通再并入主场景。

### Pitfalls
- **别用 PointerLockControls / FirstPersonControls 直接驱动位移**——它们直接写相机位置、不过碰撞，正是"弹回/穿墙"的来源。让它只负责"看向哪"。
- **必须固定 dt + 子步进**（dt=min(0.05,delta)/5）。可变 delta 跑碰撞，高/低帧率穿墙概率和涟漪同源抖动都会冒出。dt 务必 clamp 上限（0.05），否则切标签页回来一大帧瞬移穿墙。
- 滑动数学只剔除法线分量，不要再乘反弹系数（否则变弹回）。`playerOnFloor` 用 `normal.y >= 0.15` 留容差，太严缓坡上反复抖。
- **Octree 是静态的**：会动的浮岛/开合的书烘进去后碰撞不更新 → 动态物件不参与碰撞或上 Rapier。
- games_fps 原版有"静止时偶发漏检"（r166 修过）：即便 capsuleIntersect 返回 null 也别把 onFloor 持续置 false 导致一帧坠落抖动；对 onFloor 做 1–2 帧迟滞。
- Rapier autostep 官方明确"很贵"、默认关，开了要测帧；KCC 用 kinematicPosition 刚体配 `setNextKinematicTranslation`（不是 setTranslation）。
- 浮空胶囊 springK/dampingC 配不当会"果冻/低频上下弹"：先取临界阻尼附近 `dampingC ≈ 2*sqrt(springK*mass)` 再微调。
- **与 zustand 协调**：玩家位置/速度放 ref（每帧高频写），别塞进会触发 React 重渲的 store；store 只存离散状态（是否聚焦、当前楼层）。

### Effort：**中**

---

## W7 — 点击聚焦不以物件为中心；退出无转场（硬切）

**目标：** 电影感聚焦 + 平滑进出。三件事：(1) 以被点物件**真实包围盒/包围球**算取景机位（而非写死锚点 + 固定距离）；(2) 帧率无关缓动同步驱动 position + rotation，进出同一套过渡；(3) 聚焦期间禁用漫游输入，退出回进入前快照位姿。

> ⚠️ **现状硬伤（`PlayerControls.tsx`）**：聚焦飞向 `ZONE_ANCHORS[id]` 预写死锚点而非物件几何中心 → "不居中"是结构性的；`const dist=2.85` 固定取景距离 → 大留声机和小茶杯同距离必有太满/太空。进入用纯指数 lerp、position 与 rotation 用两个不同 damp 速率（5 vs 6）→ 到位时机不齐有"甩头"。

### 标杆 exemplars

| 名称 | 链接 | 作者 | 许可 | 好在哪 |
|---|---|---|---|---|
| drei `<Bounds>` / `useBounds` | https://github.com/pmndrs/drei | pmndrs | MIT | "点哪个物件就以它为中心框住"的标准答案：`useBounds().refresh(e.object).fit()`，取景距离按包围盒+FOV 自适应（`maxSize/(2·atan(fov))·margin`），position lerpVectors + rotation slerpQuaternions 同步过渡。**它的取景距离公式可整段移植**进我们手写相机。已在 node_modules、离线可用。 |
| camera-controls（yomotsu） | https://github.com/yomotsu/camera-controls | Akihiro Oyamada | MIT | 导演级 API：`fitToBox`/`fitToSphere` 一行精确框住，`setLookAt` 指定"从哪看向哪"，过渡返回 Promise 可 await 链式编排运镜节奏；`smoothTime`/`restThreshold` 调手感。v3.1.2 已装。最适合"聚焦模式"专用控制器。 |
| maath/easing（pmndrs） | https://github.com/pmndrs/maath | pmndrs | MIT | 帧率无关缓动：`damp3`(位)、`dampE`/`dampQ`(朝向)，内部 smoothDamp 有"到达时间"语义，比现用的 `1-exp(-5·dt)` 更可控、更接近临界阻尼。已装，是统一进/退曲线、消"甩头"最轻量办法，无需 GSAP。 |
| Bruno Simon Portfolio (case study) | https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b | Bruno Simon | 版权作品**仅学技法** | "聚焦不只是飞过去，还要给一个可读、有构图的停留机位"的运镜范式。节奏/构图参照，目标是区域非单物件，不可取资产。 |

### 我们怎么重实现（方案 A 最轻、不引第三套相机真相源；改动集中在聚焦分支 + store 多传 focusObject + zones 回传 object3D，约 60–120 行，无新增安装）

1. **让 zones 可交互 mesh 被点时把 Object3D 传出来**：`focusZone(id)` 改 `onFocus(id, object3D)`（或 store 存 focusObjectRef）。复用 raycaster 命中的 `hits[0].object`，无需新建拾取。
2. **移植 Bounds 取景距离公式**（替换固定 `dist=2.85`）：
   ```js
   const box = new THREE.Box3().setFromObject(target);
   const center = box.getCenter(v); const size = box.getSize(v2);
   const maxSize = Math.max(size.x, size.y, size.z);
   const fitH = maxSize / (2*Math.atan(Math.PI*camera.fov/360));
   const fitW = fitH / camera.aspect;
   const dist = MARGIN * Math.max(fitH, fitW);   // MARGIN≈1.3~1.6 留白
   // 机位 = center + 朝向*dist（朝向用"相机当前→center 的方向"保留进入感）
   ```
3. **统一进入/退出缓动（二选一）**：
   - (a) 关键帧法：记 from(进入瞬间 pos+quat)、to(机位 + lookAt(center) 的 quat)，`k=easeInOutCubic(tFocus)`，position 与 quaternion 用**同一个 k** lerp/slerp → 到位时机一致，消甩头。
   - (b) maath 法：`damp3(camera.position, goalPos, 0.5, dt)`，`lookAt(center)` 后 `dampE` 朝向；进入 smoothTime 0.5–0.7、退出 0.35。
4. **弧线飞入（可选加分）**：`CatmullRomCurve3([进入机位, center+(0,h,0), 求解机位], false, 'centripetal')`，`pos=curve.getPoint(easeInOut(tFocus))`，朝向始终 lookAt(center)，h 取物件高度 1–2 倍。
5. **退出复用已有 snapshot 回程**（现有 smootherstep 保留），只把进入对齐成同一 easing 家族。

**方案 B（要更强运镜/拉远拉近）**：聚焦模式临时挂 drei `<CameraControls>`，进入 `fitToSphere(object, true)` 或 await 链式 `rotateTo→dollyTo→fitToSphere`，退出 `setLookAt(snapshot..., true)` 再卸载。代价是做"漫游手写相机 ↔ 聚焦 camera-controls"控制权切换（聚焦时停掉 PlayerControls 写相机的 useFrame）。

**参数建议**：MARGIN 1.3–1.6；进入 0.6s、退出 0.45s；聚焦时 `camera.fov` 50→42 做压缩感（配 DOF 虚化背景），退出回 50 并 `updateProjectionMatrix()`。

### Pitfalls
- **别整包接 drei `<Bounds>`/OrbitControls 到第一人称项目**：它的 clip()/拖拽防劫持依赖 `state.controls`，我们没挂 controls，那部分会失效或乱设 near/far。**只移植取景距离公式**。
- `box.setFromObject` 前必须 `target.updateWorldMatrix(true,true)`，否则用过期世界矩阵机位会偏。漂浮书/留声机随 useFrame 起伏——**聚焦瞬间快照一次中心即可，别每帧重算导致镜头追着浮动抖**。
- position 和 rotation 用不同 damp 速率会甩头（正是现状）。务必同一 t/easing 同时驱动两者。
- 包围盒会把发光光晕 sphere/Edges/pointLight 等非实体子物件算进去 → box 过大镜头退太远。剔除 helper/light 或对该 zone 用手工 Box3。
- 不锁输入则鼠标移动仍改 yaw/pitch 打架。保持 `document.exitPointerLock` + `focusedZoneId` 守卫；触摸端 onDown 别误触发再次聚焦。
- 写 `camera.quaternion` 时 `rotation.order='YXZ'`——用 `Matrix4().lookAt` + `setFromRotationMatrix` 生成目标四元数最稳，别用欧拉硬塞。
- CatmullRomCurve3 中途点太高会"翻天"；用 `'centripetal'` 避免过冲。
- 改 fov 后退出务必复位 + `updateProjectionMatrix()`。
- 退出过渡未结束又点新物件要能**打断**当前过渡（清 exitActive 并重置 tFocus），否则两段动画叠加跳变。

### Effort：**中**

---

## 下一步优先级（技法 → 弱点映射，按 ROI 排序）

> 原则：先做"低 effort、高收益、一改连带修多个弱点"的层；high-effort 的烘焙管线 / 自写 raymarching 留到观感证明值得时收尾。

### 🔴 第一批 · 本轮先做（低 effort、高 ROI、连带多弱点）

| 优先级 | 动作 | 主修 | 连带帮 | Effort | 为什么先做 |
|---|---|---|---|---|---|
| 1 | **统一氛围底座**：NoToneMapping→post 链尾 AGX、`<Environment>` 夜景 HDRI（IBL）、`<fogExp2>` 暖雾 | W4 | W3、W2、W5 | 低（~1天） | 一层打底立刻消掉一半 W4，且 IBL 直接救 W3 金属平黑，雾把碎片融成一体帮 W2。收益最大。 |
| 2 | **碰撞滑动（games_fps 算法，零新依赖）** + 固定 dt 子步进 | W6 | W5（时序） | 中（~1天） | 手感是第一人称体验地基，纯数学零依赖，子步进思路顺带稳住涟漪时序。 |
| 3 | **接地三件套**（AccumulativeShadows/ContactShadows）+ 构图地脉（连续基座/缝里透水光） | W2 | W5 | 中（1–2天） | 把"漂浮"焊成"落地"性价比最高的一招，无需烘焙。 |
| 4 | **聚焦修正**（移植 Bounds 取景距离公式 + maath 统一缓动 + 回传 object3D） | W7 | — | 中（60–120行） | 改动小、依赖全已装、不碰碰撞几何，直接消掉"不居中 + 甩头 + 硬切"。 |

### 🟡 第二批 · 第一批见效后

| 动作 | 主修 | Effort | 说明 |
|---|---|---|---|
| **暖夜后处理栈完善**：阈值式 HDR Bloom（材质侧 emissive>1 决定泛光）+ AGX 找回饱和/对比 + Vignette/Noise；修正 `toneMapped=false` 误用 | W4、W3 | 中 | 配合第一批的 IBL 底座，让金属不白斑、暖光连成统一氛围。 |
| **3D 灯具几何 + 选择性辉光**（换掉棒棒糖贴片） | W1 | 中 | 必须在 Bloom 之前，否则辉光加在贴片上更廉价。建模工时。 |
| **喇叭黑洞专修**：内壁 DoubleSide + 喉光 emissive 环/pointLight + 黄铜 roughnessMap 分级 | W3 | 中 | 第一批 IBL 已补环境，这步收掉黑洞与塑料感。 |
| **TideWater 菲涅尔 + 双法线流动 + 世界锚定**（治抽搐核心） | W5 | 中 | 最高杠杆是轻量的菲涅尔+暗水体色+细法线；平面反射先低分辨率验证再加码。 |

### 🟢 第三批 · high-effort 收尾（观感证明值得再上）

| 动作 | 主修 | Effort | 说明 |
|---|---|---|---|
| **Blender 一体化烘焙光照/AO**（2048²/4096² → KTX2/WebP，运行时 MeshBasicMaterial/lightMap） | W2、W4 | 高（占改造 60–70%） | "焊成一体"的工业终极手段，但工时是硬成本。 |
| **真丁达尔光轴**：路线 A（three-good-godrays，先验证 0.185）或路线 B（自写 raymarching Effect） | W4 | 中（A 2–3天）/ 高（B ~1周） | 只挑 1–2 主光做；先 A，质感不够再 B。 |
| **Rapier KCC / 浮空胶囊**（autostep 上台阶、动态物件碰撞、Bruno 级丝滑） | W6 | 中 | 仅当 games_fps 版手感/动态碰撞不够时升级。 |

**总路径建议：** 先走第一批 1→2→3→4 拿到"统一暖氛围 + 落地 + 顺滑移动 + 居中聚焦"的可玩骨架（已大幅缓解 W2/W3/W4/W5/W6/W7），再按第二批补灯具/喇叭/水面细节，最后视效果决定是否上第三批的烘焙与 raymarching。

---

# 第十轮追加 · 内化台账（2026-07-01）

> 六域并行研究（相机手感/物品精致度/镜面水完整回收；体积光/远景/标杆挖掘三域因进程中断部分回收）。
> 本节记录：这一轮**实际内化落地**的技法 → 出处/许可；以及研究员给出但**留给下一轮**的高价值配方。

## 已内化（本轮落地，代码在案）

| 技法 | 落地处 | 出处 / 许可 |
|---|---|---|
| 真平面反射水（MeshReflectorMaterial）+ 保留几何镜像星空做底衬的"三明治"结构 | `scene/Water.tsx` 高配路径；研究员独立推荐同构方案（Susurrus 案例实证低清反射可行） | drei MIT；Codrops Susurrus 文章为思路参考 |
| "黑镜"材质配方：metal 1 + 暗 albedo 染黑 specular，反射交给 RT | `Water.tsx`（本轮页内实验收敛出的参数,已注释成文） | 自研参数 |
| 帧率无关指数阻尼统一相机缓动（1-exp(-λ·dt)） | 第八轮已内化,本轮扩展到速度惯性/步伐包络/FOV | rorydriscoll.com 思路参考 |
| 非对称加减速时间常数（起步慢/停步快）+ 速度驱动微动效 | `PlayerControls.tsx` ACCEL_RATE 9 / DECEL_RATE 12 | Bruno Simon portfolio case study 思路参考 |
| FOV kick 克制剂量（满速 +2.6°,阻尼过渡） | `PlayerControls.tsx` FOV_RUN | zigurous 文档思路参考,自行实现 |
| 位置式 head bob（绝不转 pitch,横移做肩部平移不做 roll） | `PlayerControls.tsx` bob/sway | 生物力学文献口径的公开思路 |
| 假体积光柱：开口圆台 + |dot(N,V)| 弦长近似 + 上下淡出,BackSide 防双面叠加 | `scene/Starfall.tsx` | 论坛常见技法,自研 shader |
| 径向渐变 Sprite 光晕替代加色球（无多边形轮廓穿帮） | `scene/gallery/glow.tsx`,灯笼/台灯/光点晕圈/灯塔共用 | 自研,CanvasTexture 程序生成 |
| 远景剪影 + 场景雾 = 免费大气透视;实例化群岛 1 draw | `scene/Vista.tsx` | 通用环境美术手法 |
| 倒角显精致（RoundedBox/轮廓圆角) + "一件物品 ≥3 部件" + 微故事簇（墨水瓶/待读书堆） | BookWall/Lectern 既有+本轮扩展 | drei/three MIT;Level Design Book 方法论 |
| 黑胶高金属低粗糙——靠掠射沟纹反光被认出,哑黑侧看=黑洞 | `zones/RecordPlayer.tsx` + GLB mat23 | 自研参数 |

## 研究员给出、本轮未落（下一轮候选,按 ROI 排序）

1. **涟漪 → distortionMap 管线**（水研究员）：把脚步涟漪渲进 FBO 喂 MeshReflectorMaterial 的 distortionMap——倒影被真实打碎,而不是只画光环。drei MIT,自研 FBO 代码。
2. **共享程序噪声图 = roughnessMap+bumpMap 的"旧物感"**（物件研究员）：一张 256px fBm 图喂全部手搓件,高光碎化,零资产近零开销。
3. **MeshPhysicalMaterial 三件套**：clearcoat(漆木/陶瓷)、sheen(布面书)、anisotropy(黄铜喇叭)。three MIT。
4. **2:1 Lissajous head bob + 波谷落脚事件直连涟漪**（相机研究员）："脚落下的瞬间星海泛起涟漪+相机微沉"——与核心幻觉锁相。
5. **Henry Heffernan 关键帧相机 + 不对称贝塞尔**（聚焦运镜"快起慢收",repo MIT 已核实 LICENSE）。
6. **three.js examples 水法线贴图**（MIT,可打包）做月光 glint 微扰,不弯折倒影。

## 第十轮标杆清单(三路并行挖掘 → 汇总去重,2026-07-01)

### Equinox – A WebGL Space Adventure(Little Workshop,Awwwards SOTD + Developer Award 2024-05,FWA SOTM)
- 链接:https://equinox.space
- 好在哪:第一人称叙事探索的标杆:氛围靠『漆黑宇宙外景 vs 暖色舱内光』的照明强对比 + 随剧情演进的配乐/旁白节奏推进,而不是堆特效;交互按移动端单指模式整体重设计;概念/建模/WebGL/配乐全部 in-house,像一部可走动的短片,靠 pacing(节奏)而非画质取胜。
- 可内化 → 轴:①为沉浸而设计的第一人称相机与极简输入(视线引导、缓动转头)→ 相机丝滑;②内暖外冷的照明脚本化对比 → 渲染美。可内化做法:给回廊内/水面外定义两套色温脚本,过门时插值。
- 开源/拆解:闭源,仅观感参照(制作说明见 https://www.littleworkshop.fr/projects/equinox/)

### Igloo Inc(Abeto,Awwwards Site of the Year 2024)
- 链接:https://www.igloo.inc
- 好在哪:冰体为『容器内程序化晶体生长』算法 + raymarching 折射;Houdini VDB 体积数据走自研导出器+压缩,最终体积比一张普通网页图还小;UI 全部在 WebGL 内渲染,文字 scramble 用 SDF 纹理偏移做、不触发 DOM 重排;KTX2 压缩纹理 + requestIdle 加载,重画面下桌面/移动 LCP≈1s。
- 可内化 → 轴:①体积数据离线烘焙+自定义压缩格式(VDB→浏览器友好格式)→ 渲染美,且天然满足『资产可打包/离线』约束;②SDF 文本与 shader 化 UI 细节 → 物件精致度。
- 开源/拆解:站点闭源,但有官方逐点技术拆解:https://www.awwwards.com/igloo-inc-case-study.html 与 https://www.webgpu.com/showcase/igloo-inc-procedural-crystals/

### Messenger(Vicente Lucendo + Michael Sungaila / Abeto 发行,Awwwards SOTD 2025)
- 链接:https://messenger.abeto.co/
- 好在哪:小行星世界按『展开的立方体』建模再球化,失真最小、便于手工摆件;全世界颜色取样自一张 16x16 色卡图集,换一张 16x16 小图即可整世界瞬间换气氛;水面有岸线涟漪+深度渐变,角色下水衣物染色;越肩相机自动跟随+专调碰撞防窄巷穿插;自研『保轮廓 LOD』远处减面不跳变;首包约 5.7MB、全量 17.5MB(KTX2+Draco)。
- 可内化 → 轴:①16x16 色卡图集全局调色:一张微型纹理驱动全场景氛围(可做潮汐/时段变化)→ 渲染美;②保轮廓 LOD + 相机碰撞调参 → 世界广阔感/相机丝滑。
- 开源/拆解:游戏闭源,官方技术拆解:https://www.awwwards.com/messenger.html;其碰撞方案 three-mesh-bvh 开源(MIT):https://github.com/gkjohnson/three-mesh-bvh

### Gen-02 / Samsy 的沉浸式世界(Samuel Honigstein,Awwwards SOTD + Developer Award 2025-10)
- 链接:https://samsy.ninja/
- 好在哪:自写 WebGPU 渲染管线;开场是四面环水的小岛+樱花树,靠水面反射把场景边界变成『倒影里的无限』,再用实例化花瓣粒子铺满空气层——小体量场景做出大氛围的教科书。注:形式是作品集,但结构是『可行走的内心世界』而非 3D 简历模板。
- 可内化 → 轴:①环水小岛构图:让水承担『世界边界→无限延伸』的错觉 → 世界广阔感(与潮汐图书馆镜面水思路同源,可对照它的倒影/雾衔接处理);②instancing + data texture 驱动大规模粒子 → 渲染美。
- 开源/拆解:闭源,仅观感参照(作者在 Medium 有 instanced rendering / data textures 技术长文,X:@Samsyyyy)

### Summer Afternoon(Vicente Lucendo,three.js forum showcase 高赞 + Awwwards SOTD)
- 链接:https://summer-afternoon.vlucendo.com/
- 好在哪:黄昏暖色『手绘渐变光』小世界的原型级作品:松弛感来自低对比渐变配色 + 自研全景实时阴影;角色物理/碰撞/跟随相机全部手写(碰撞用 three-mesh-bvh 加速);自定义几何导出器 + 纹理/着色器初始与后台双阶段加载,首屏极快。
- 可内化 → 轴:①手写跟随相机+角色物理:缓动、超调、回弹参数全部自己掌控(不是 OrbitControls 改装)→ 相机丝滑;②渐变主导的 stylized 光色 → 渲染美。
- 开源/拆解:闭源;官方 case study:https://www.awwwards.com/summer-afternoon.html;论坛帖:https://discourse.threejs.org/t/summer-afternoon/46963

### Elysium(thebenezer,three.js forum showcase 高赞,被社区称『年度最佳』)
- 链接:https://elysium.thebenezer.com/
- 好在哪:独立开发 6 个月的 stylized 开放小世界:godrays、按高度/距离渐变的 gradient fog(不是单色 FogExp2)、带深度差泡沫的风格化水、星空、随风摆动且对玩家位置有反应的草;vanilla three.js + 手写 GLSL + three-mesh-bvh,证明夜景大气全靠 shader 分层不靠资产堆量。
- 可内化 → 轴:①『渐变雾 + godrays + 星空』三层夜空大气叠法:正好是把已有的远景群岛、星光柱『缝合成一个世界』的胶水 → 世界广阔感;②深度差泡沫水岸线 → 渲染美(回帖中有现成的水深 shader 片段可抄)。
- 开源/拆解:闭源;技法讨论与水体 shader 片段见论坛帖:https://discourse.threejs.org/t/elysium-the-most-beautiful-stylized-world-on-the-web/55541

### Alfi's Adventures(Ctrlmonster,three.js forum showcase)
- 链接:https://create.viverse.com/EcxNxwe
- 好在哪:全自定义球谐(SH)PRT 烘焙光照:静态场景一身『烘焙质感』,动态角色仍能接入同一套光而不违和;全程零后处理——bloom 用叠加在物体上的透明自发光壳网格伪造,大气散射用『随视线方向变化的雾』伪造;渲染+模拟整体跑在 WebWorker/OffscreenCanvas。
- 可内化 → 轴:①SH 光探针烘焙:让可交互物件融入烘焙场景 → 渲染美 + 物件精致度;②免后处理的伪 bloom / 视向雾:低成本、离线打包与低端机友好 → 渲染美。作者给出的原理文献本身就是教程。
- 开源/拆解:闭源;论坛帖:https://discourse.threejs.org/t/alfis-adventures-three-js-game/85754;作者引用的可学习文献:https://iquilezles.org/articles/fog/ 与 https://patapom.com/blog/SHPortal/

### My Room in 3D(Bruno Simon,three.js forum showcase 高赞,repo 4.4k star)
- 链接:https://my-room-in-3d.vercel.app/
- 好在哪:『夜晚暖灯房间』的教科书实现:Blender 烘焙昼/夜两套贴图,shader 内以 uNightMix/uNeutralMix 插值切换;另用一张 lightmap 的 R/G/B 三通道分别充当电视/台灯/PC 灯的遮罩,uLightTvStrength、uLightDeskStrength、uLightPcStrength 等 uniform 独立调每盏灯的强度与色温——同时获得烘焙质感与可调灯光,运行时零实时光源开销。
- 可内化 → 轴:RGB 通道分灯 lightmap 混合:一对一命中『暖灯读书回廊』——每盏读书灯独立呼吸/调色而帧成本为零 → 物件精致度 + 渲染美,完全离线可打包。
- 开源/拆解:源码公开:https://github.com/brunosimon/my-room-in-3d(注意仓库未附 LICENSE,做法可学、代码资产不可直接搬运);论坛帖:https://discourse.threejs.org/t/my-room-in-3d-using-three-js/30732

### Edelweiss(felixmariotto,three.js forum showcase 三页热帖)
- 链接:https://felixmariotto.itch.io/edelweiss
- 好在哪:完整开源的 3D 解谜平台游戏:自写引擎 + 配套地图编辑器(Edelweiss-Editor),手绘风天空/云雾/塔楼场景;从资产组织、碰撞系统到关卡管线全链路代码可读。视觉不及前面几件,但它是本批唯一『代码+资产全套可拆』的作品。
- 可内化 → 轴:CC0 许可意味着代码与资产都可直接打包进离线项目;其『自建轻量场景编辑器』思路可复用为回廊物件摆放/烘焙管线 → 物件精致度。
- 开源/拆解:开源:https://github.com/felixmariotto/Edelweiss(许可 CC0-1.0);论坛帖:https://discourse.threejs.org/t/open-source-3d-platformer-edelweiss/12847

**最值得先内化的两件事(下一轮首选):**
① My Room in 3D 的『昼夜烘焙插值 + RGB 通道分灯 lightmap』(uNightMix + 每盏灯独立 strength/色温 uniform):与『暖灯读书回廊立在夜水上』一对一命中——烘焙一次,每盏读书灯可独立呼吸、调色而运行时零光源成本,离线打包无障碍、源码公开可逐行读,是四轴里同时抬升『渲染美+物件精致度』且落地成本最低的一件。② Elysium 的夜景大气三层叠(高度/距离渐变雾 + godrays + 星空 + 风场植被):项目已有远景群岛剪影和星光柱,眼下最缺的正是把它们缝合成同一个世界的『空气层』——渐变雾决定远景消隐的层次,godrays 给灯塔/星光柱加体积感,直接决定『世界广阔感』这条最难的轴;且论坛帖内有现成水深/雾 shader 片段可参照,纯 shader 方案不增加资产体积。

---

## 第十一轮落地回执

- **topTwo ①（My Room in 3D 的 RGB 通道分灯 lightmap）→ 已落地**，但走的是本仓库变体而非克隆：
  Bruno 的全烘焙无光材质需要场景 100% 静态；我们的数据契约（书脊/物件/转碟随用户数据变）决定了
  动态内容必须和舞台同吃实时灯 → 变体为"**间接光烘焙 + 直接光实时**"（R 暖灯反弹 / G 月光反弹 / B 天光遮蔽，
  无色辐照度 + 运行时分组调色）。“每通道一组灯、运行时独立调强”的核心思想原样内化（uNightMix → K_WARM×lampMul）。
  技法出处：my-room-in-3d（repo 无 LICENSE——学做法不搬代码，本实现从零写）。
- **topTwo ②（Elysium 渐变雾三层大气）→ 仍挂账**，下轮候选。
