import { useEffect, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../../theme";
import { useWorld } from "../../store/useWorld";
import { MOOD_PRESETS } from "../../config/moods";
import { LIGHTMAP_META } from "./shellLightmap.meta";

// 烘焙壳（高画质档）：Blender Cycles 分灯 lightmap 接管静态舞台的间接光。
// 技法内化自 Bruno Simon "My Room in 3D" 的 RGB 通道分灯（见 BENCHMARKS 第十轮 topTwo ①），
// 本仓库变体：不做全烘焙无光材质（动态内容书/道具必须和舞台同吃实时灯），只烘实时管线做不出的部分——
//   R 暖灯组间接反弹（书架间的暖洇光）· G 月光间接 · B 天光全量（≈方向性遮蔽的环境光）。
// 直接光照与阴影全部保持实时 → 数据驱动的内容和舞台受光永远一致，无双重曝光。
// 通道各存 sqrt 编码的无色辐照度，运行时按组调色调强（mood 可逐组呼吸）。
//
// 几何：tools/bake 管线从活场景导出、Blender 合并 + Lightmap UV2 后回来的静态壳，
// 高画质档替换 Deck/BookWall(骨架)/Lanterns(杆)/Pedestals 里的对应网格（各组件 baked 时跳过）。

const URL_GLB = "/lightmaps/shell-baked.glb";
const URL_LM = "/lightmaps/shell-lightmap.png";

// 运行时定标：贴图当**归一化分布**用（sqrt 解码后 0..1），绝对亮度全由这些旋钮
// 以 three 的辐照度单位艺术决定——Blender 的 W/m² 和 three 的 candela 本就不通约，
// meta 里的 scale 只作 provenance（重烘后如果分布定标漂了，回来重调这里）。
const K_WARM = 1.4; // 0.55 时 A/B 几乎不可辨——间接反弹要读得出"灯洇进木头"才算数
const K_MOON = 0.05; // 月光纯间接反弹在暗材质上≈0，本轮通道近空（p99.7=1e-4，放大即噪声）——先几乎关死
const K_SKY = 0.5;
const K_AO = 0.85; // 平坦环境光/半球光/IBL 漫反射被天光遮蔽压下去的比例

/** 烘焙产物是否可用（install.mjs 未跑过时 res=0，直接不挂载）。 */
export const hasBakedShell = LIGHTMAP_META.res > 0;

export default function BakedShell() {
  const { scene: glb } = useGLTF(URL_GLB);
  const lm = useTexture(URL_LM);
  const mood = useWorld((s) => s.world.room.mood.lighting);
  const preset = MOOD_PRESETS[mood] ?? MOOD_PRESETS.cool;

  const uniforms = useMemo(
    () => ({
      uLmWarm: { value: new THREE.Color(0, 0, 0) },
      uLmMoon: { value: new THREE.Color(0, 0, 0) },
      uLmSky: { value: new THREE.Color(0, 0, 0) },
      uLmAo: { value: K_AO },
    }),
    [],
  );

  // mood → 分组强度：暖通道跟 lampMul 呼吸，天光跟 hemiIntensity，月光是锚不动。
  useEffect(() => {
    uniforms.uLmWarm.value.set(PALETTE.lampWarm).multiplyScalar(K_WARM * preset.lampMul);
    uniforms.uLmMoon.value.set("#b7c6ea").multiplyScalar(K_MOON);
    uniforms.uLmSky.value.set("#3f5484").multiplyScalar(K_SKY * (preset.hemiIntensity / 0.92));
  }, [preset, uniforms]);

  const root = useMemo(() => {
    lm.flipY = false; // glTF UV 约定
    lm.colorSpace = THREE.NoColorSpace; // 数据贴图（编码辐照度），不做 sRGB 解码
    lm.channel = 1; // TEXCOORD_1 = Blender 里的 Lightmap 层
    lm.needsUpdate = true;
    glb.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.lightMap = lm; // 只为触发 USE_LIGHTMAP/vLightMapUv 接线；采样逻辑在补丁里
      m.lightMapIntensity = 0; // 内建叠加路径关死，防补丁失效时双计
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uLmWarm = uniforms.uLmWarm;
        shader.uniforms.uLmMoon = uniforms.uLmMoon;
        shader.uniforms.uLmSky = uniforms.uLmSky;
        shader.uniforms.uLmAo = uniforms.uLmAo;
        shader.fragmentShader =
          "uniform vec3 uLmWarm;\nuniform vec3 uLmMoon;\nuniform vec3 uLmSky;\nuniform float uLmAo;\n" +
          shader.fragmentShader.replace("#include <lights_fragment_maps>", LJ_LIGHTS_FRAGMENT_MAPS);
      };
      m.customProgramCacheKey = () => "lj-baked-shell";
      m.needsUpdate = true;
    });
    return glb;
  }, [glb, lm, uniforms]);

  return <primitive object={root} />;
}

// 替换 three 的 lights_fragment_maps：lightMap 内建叠加换成分灯解码；
// 平坦环境光（ambient/hemi 已进 irradiance）与 IBL 漫反射乘上烘焙天光遮蔽——
// "拐角处环境光会自己暗下去"，这是实时管线永远给不了的一笔。
// 注意 radiance（IBL 镜面）保持原样（three 0.185 原文），金属高光不受烘焙影响。
const LJ_LIGHTS_FRAGMENT_MAPS = /* glsl */ `
#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 ljLm = texture2D( lightMap, vLightMapUv );
		float ljAo = mix( 1.0, ljLm.b * ljLm.b, uLmAo );
		irradiance *= ljAo;
		irradiance += uLmWarm * ( ljLm.r * ljLm.r ) + uLmMoon * ( ljLm.g * ljLm.g ) + uLmSky * ( ljLm.b * ljLm.b );
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal ) * ljAo;
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif
`;

if (hasBakedShell) {
  useGLTF.preload(URL_GLB);
}
