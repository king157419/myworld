import { useMemo } from "react";
import * as THREE from "three";
import { GlowSprite } from "../../scene/gallery/glow";
import { ATTIC_PALETTE } from "./materials";
import { glassVert, makeNightSkyMaterial } from "./rainGlass";

// 窗上的雨（满分锚点 ref_rain_window_night_6）：玻璃上小而密、大小混杂的水珠（实心亮点+暗边缘）+
// 偶发 2-3 条蜿蜒下滑的拉丝；窗外是暗蓝灰的夜（云渐变、非发光蓝屏），远灯化成极小的暖 bokeh。
// v1 全程序化 shader，零贴图、离线自给。玻璃 + 夜空面材质工厂在 rainGlass.ts（本文件只做组件 + 雨丝层）。

// 窗外夜空的暗蓝灰（比旧版纯蓝暗 ~4×，去 LED 感；上深下略提亮）。
const SKY_TOP = "#070a11";
const SKY_BOT = "#0d1119";

// 窗外雨丝：一层稀疏、几乎不可见的细短下坠（只作"外面在下雨"的暗示，不再是满屏竖条纹）。
const rainVert = glassVert;
const rainFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uRain;
  float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
  void main(){
    vec2 uv = vUv;
    float cols = 20.0;
    float col = floor(uv.x*cols);
    float fx = fract(uv.x*cols);
    float rnd = h(vec2(col, 3.0));
    float on = step(0.72, h(vec2(col,7.0)));   // 稀疏：仅少数列有雨丝
    float speed = 0.8 + rnd*1.1;
    float y = fract(uv.y*3.0 - uTime*speed - rnd*7.0);
    float dash = smoothstep(0.5,0.5-0.08, abs(y-0.5)); // 短段（非满屏直条）
    float thin = smoothstep(0.35,0.0, abs(fx-0.5));
    float a = on*dash*thin*0.06*uRain;                 // 几乎不可见
    gl_FragColor = vec4(vec3(0.66,0.75,0.92), a);
  }
`;

function makeRainOutsideMaterial(rainUniform: { value: number }, timeUniform: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: rainVert,
    fragmentShader: rainFrag,
    uniforms: { uTime: timeUniform, uRain: rainUniform },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** 天窗：屋顶斜面上开的一扇（含窗框 + 雨蚀玻璃 + 窗外暗夜 + 一层雨丝 + 一两点远处暖 bokeh）。 */
export function Skylight({
  material,
  rainUniform,
  timeUniform,
  position,
  rotation,
  size = [1.1, 1.5],
  coldMul = 1,
  low = false,
}: {
  material: THREE.ShaderMaterial;
  rainUniform: { value: number };
  timeUniform: { value: number };
  position: [number, number, number];
  rotation: [number, number, number];
  size?: [number, number];
  coldMul?: number;
  low?: boolean;
}) {
  const rainMat = useMemo(() => makeRainOutsideMaterial(rainUniform, timeUniform), [rainUniform, timeUniform]);
  const skyMat = useMemo(() => makeNightSkyMaterial(timeUniform, SKY_TOP, SKY_BOT), [timeUniform]);
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* 天窗外的暗夜天（云渐变，暗蓝灰；紧贴玻璃后免被屋顶挡掉） */}
      <mesh position={[0, 0, -0.05]} material={skyMat}>
        <planeGeometry args={[w * 1.1, h * 1.1]} />
      </mesh>
      {/* 远处一两点暖 bokeh（讲故事的远灯，极小、低透明） */}
      <GlowSprite position={[-0.28, 0.22, -0.045]} color={"#ffbe73"} scale={0.16} opacity={0.24} />
      <GlowSprite position={[0.24, -0.18, -0.045]} color={"#ffd39a"} scale={0.12} opacity={0.18} />
      {/* 窗外冷光源：透过天窗打进屋里的清冷天光（不投影）。low 档减灯：只留自发光冷夜面，省一盏点光 */}
      {!low && <pointLight position={[0, 0, -0.35]} color={"#7f97c4"} intensity={2.2 * coldMul} distance={5} decay={2} />}
      {/* 一层雨丝 */}
      <mesh position={[0, 0, -0.03]} material={rainMat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* 雨蚀玻璃 */}
      <mesh position={[0, 0, 0]} material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* 窗框（十字木格 + 外框） */}
      <group>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[0.05, h, 0.06]} />
          <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[w, 0.05, 0.06]} />
          <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** 山墙窗（写字台前）：雨蚀玻璃 + 暗夜 + 远处暖色 bokeh 斑 + 雨丝。 */
export function GableWindow({
  material,
  rainUniform,
  timeUniform,
  position,
  rotation = [0, 0, 0],
  size = [1.5, 1.7],
  coldMul = 1,
}: {
  material: THREE.ShaderMaterial;
  rainUniform: { value: number };
  timeUniform: { value: number };
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
  coldMul?: number;
}) {
  const rainMat = useMemo(() => makeRainOutsideMaterial(rainUniform, timeUniform), [rainUniform, timeUniform]);
  const skyMat = useMemo(() => makeNightSkyMaterial(timeUniform, SKY_TOP, SKY_BOT), [timeUniform]);
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* 暗夜底（云渐变；紧贴玻璃后免被山墙挡掉） */}
      <mesh position={[0, 0, -0.075]} material={skyMat}>
        <planeGeometry args={[w * 1.1, h * 1.1]} />
      </mesh>
      {/* 远灯化成的暖色 bokeh（冷底暖斑）——收到 1~2 点、极小、低透明（不再一堆大斑） */}
      <GlowSprite position={[-0.42, -0.28, -0.055]} color={"#ffbe73"} scale={0.2} opacity={0.26} />
      <GlowSprite position={[0.34, 0.12, -0.055]} color={"#ffd39a"} scale={0.14} opacity={0.18} />
      {/* 雨丝 */}
      <mesh position={[0, 0, -0.035]} material={rainMat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* 雨蚀玻璃 */}
      <mesh position={[0, 0, 0]} material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* 窗外清冷天光（打进写字台一侧，与暖台灯形成双色平衡） */}
      <pointLight position={[0, 0.1, -0.4]} color={"#8ba2cc"} intensity={3.0 * coldMul} distance={6} decay={2} />
      {/* 木窗框：外框 + 中挺 */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.06, h + 0.08, 0.07]} />
        <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[w + 0.08, 0.06, 0.07]} />
        <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
      </mesh>
      {[-w / 2 - 0.02, w / 2 + 0.02].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.02]}>
          <boxGeometry args={[0.08, h + 0.16, 0.08]} />
          <meshStandardMaterial color={ATTIC_PALETTE.woodDark} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
