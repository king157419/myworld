import { EffectComposer, Bloom, Vignette, Noise, BrightnessContrast, HueSaturation, ToneMapping, SMAA } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

// 后处理：出电影感。SMAA 抗锯齿（比 MSAA×4 便宜得多）+ Bloom（暖光泛光）+ 色彩分级 + AgX + 暗角 + 细颗粒。
// AgX 仍放在 post 末端：星点/水面/光点都是 toneMapped={false} 的加色材质，post 这道是它们唯一的色调压缩——
// 移到 renderer 反而压不到它们、会更容易过曝。Bloom 阈值已抬高，只让真正的高光（月、主星、灯）泛光。
// 景深(DOF)从常驻档移除：第一人称走动里它几乎只是糊远景，却是最贵的两道之一——这是"不丝滑"的大头之一。
// 低端降级：去掉颗粒，Bloom 收一点。
export default function PostFX({ low = false }: { low?: boolean }) {
  if (low) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <SMAA />
        <Bloom intensity={0.55} luminanceThreshold={0.84} luminanceSmoothing={0.9} mipmapBlur radius={0.68} />
        <HueSaturation saturation={0.1} hue={0} />
        <BrightnessContrast brightness={0.02} contrast={0.1} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette eskil={false} offset={0.36} darkness={0.42} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.92} mipmapBlur radius={0.76} />
      <HueSaturation saturation={0.1} hue={0} />
      <BrightnessContrast brightness={0.03} contrast={0.1} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette eskil={false} offset={0.36} darkness={0.45} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.1} />
    </EffectComposer>
  );
}
