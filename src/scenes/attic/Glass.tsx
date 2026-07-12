import { useMemo } from "react";
import * as THREE from "three";
import { GlowSprite } from "../../scene/gallery/glow";
import { ATTIC_PALETTE } from "./materials";
import { glassVert } from "./rainGlass";

// 窗上的雨（满分锚点 ref_rain_window_night_6）：玻璃上可辨认的单颗水珠 + 缓慢下滑的拉丝，
// 珠子边缘被室内暖灯催出高光、玻璃底色是青蓝夜——冷底暖斑。窗外还看得见雨丝落下。
// v1 全程序化 shader，零贴图、离线自给。玻璃材质工厂在 rainGlass.ts（本文件只做组件 + 雨丝层）。

// 窗外雨丝：一层滚动竖直短线，透过玻璃可见。
const rainVert = glassVert;
const rainFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uRain;
  float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
  void main(){
    vec2 uv = vUv;
    float cols = 46.0;
    float col = floor(uv.x*cols);
    float fx = fract(uv.x*cols);
    float rnd = h(vec2(col, 3.0));
    float on = step(0.45, h(vec2(col,7.0)));
    float speed = 0.7 + rnd*1.1;
    float y = fract(uv.y*2.2 - uTime*speed - rnd*7.0);
    float dash = smoothstep(0.5,0.5-0.16, abs(y-0.5));
    float thin = smoothstep(0.5,0.0, abs(fx-0.5));
    float a = on*dash*thin*0.22*uRain;
    gl_FragColor = vec4(vec3(0.72,0.8,1.0), a);
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

/** 天窗：屋顶斜面上开的一扇（含窗框 + 雨蚀玻璃 + 窗外冷夜 + 一层雨丝）。 */
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
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* 天窗外的夜天（微亮的冷云，让天窗透出冷光；浅偏移，紧贴玻璃后免被屋顶挡掉） */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[w * 1.1, h * 1.1]} />
        <meshBasicMaterial color={"#2a3a5c"} toneMapped={false} />
      </mesh>
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

/** 山墙窗（写字台前）：雨蚀玻璃 + 冷夜 + 远处暖色 bokeh 斑 + 雨丝。 */
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
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* 冷夜底（浅偏移，紧贴玻璃后免被山墙挡掉） */}
      <mesh position={[0, 0, -0.075]}>
        <planeGeometry args={[w * 1.1, h * 1.1]} />
        <meshBasicMaterial color={ATTIC_PALETTE.nightCold} toneMapped={false} />
      </mesh>
      {/* 远灯化成的暖色 bokeh（冷底暖斑）——低不透明、离散几点 */}
      {[
        [-0.5, -0.35, "#ffb257", 0.5],
        [0.42, -0.1, "#ffcf8a", 0.36],
        [0.12, 0.4, "#ff9b46", 0.3],
        [-0.3, 0.28, "#ffd9a0", 0.26],
      ].map((b, i) => (
        <GlowSprite key={i} position={[b[0] as number, b[1] as number, -0.055]} color={b[2] as string} scale={0.42} opacity={b[3] as number} />
      ))}
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
