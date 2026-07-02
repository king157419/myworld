import { useMemo } from "react";
import * as THREE from "three";
import { COURT_CENTER } from "../theme";

// 星光柱（Starfall）：一根从天顶垂落到广场中心的极淡光柱——"星光落下来的地方"。
// 思绪光点沉在它脚下的水域，整个广场因此有了一根可仰望的脊柱。
// 舞台灯光逻辑而非天文模拟：低月负责水面月路，顶光柱负责空间的纵向存在感，二者并存。
// 实现：开口圆台 + 假体积 shader——视线越贴中轴（|dot(N,V)| 越大）穿过的"介质"越厚越亮，
// 底部淡入（贴水不生硬）、顶部淡出（融进夜空）。一次加色绘制，低端也画得起。

const vert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vH;
  void main(){
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vH = uv.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const frag = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vH;
  uniform vec3 uColor;
  uniform float uAlpha;
  void main(){
    vec3 V = normalize(cameraPosition - vWorld);
    float chord = abs(dot(normalize(vNormal), V));            // 圆柱侧面：视线越贴中轴，弦越长越亮
    float vert = smoothstep(0.0, 0.18, vH) * smoothstep(1.0, 0.45, vH); // 底淡入、顶淡出
    gl_FragColor = vec4(uColor, uAlpha * chord * chord * vert);
  }
`;

const BEAM_H = 26;

export default function Starfall({ visible = true }: { visible?: boolean }) {
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color("#9fb3e8") }, uAlpha: { value: 0.045 } }),
    [],
  );
  return (
    <mesh
      visible={visible}
      position={[COURT_CENTER[0], BEAM_H / 2, COURT_CENTER[2]]}
      renderOrder={5}
      frustumCulled={false}
    >
      {/* 上窄下宽的开口圆台：光从高处收束着落下来。
          BackSide（只画远壁）：DoubleSide 前后两壁加色叠一倍直接过亮，且人走进光柱里也仍能看见它 */}
      <cylinderGeometry args={[1.0, 1.9, BEAM_H, 28, 1, true]} />
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
