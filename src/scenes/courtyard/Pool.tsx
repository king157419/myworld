import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { POOL } from "./theme";
import { COURT_PALETTE, stoneMat } from "./materials";

// 一方浅水池：深墨绿静水（复用 loft 黑镜配方——metal 1 + 暗墨绿 albedo + fog=false——但调暗调低反射强度，
// 比 loft 的镜面更「水」而非「镜」）。参照 ref_pavilion_water_rain_3：水是墨绿、映出竹影、暗部沉深。
// 雨滴在池面荡开小涟漪（过程 shader，密而小的实心水环，非发光大圈——沿用场景 A 的教训）。

// —— 雨滴涟漪叠加层（过程生成，散点小环） ——
const rippleVert = /* glsl */ `
  varying vec2 vP;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = position.xy; // 平面本地 xy
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const rippleFrag = /* glsl */ `
  precision highp float;
  varying vec2 vP;
  uniform float uTime;
  uniform float uRain;
  uniform vec3 uColor;
  float h21(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p, p+34.345); return fract(p.x*p.y); }
  void main(){
    // 网格分格，每格一颗雨滴，随机相位 → 一圈圈扩散的细环
    vec2 gv = vP * 1.6;
    float acc = 0.0;
    for(int j=-1;j<=1;j++){
      for(int i=-1;i<=1;i++){
        vec2 id = floor(gv) + vec2(float(i), float(j));
        vec2 rnd = vec2(h21(id), h21(id+7.1));
        vec2 c = id + 0.5 + (rnd-0.5)*0.7;
        float d = length(gv - c);
        float period = 1.4 + rnd.x*1.6;
        float ph = fract(uTime/period + rnd.y);
        float radius = ph*0.55;
        float ring = exp(-pow((d-radius)/0.03, 2.0)); // 细环
        float fade = (1.0-ph);
        acc += ring*fade;
      }
    }
    acc = clamp(acc, 0.0, 1.0) * uRain;
    gl_FragColor = vec4(uColor*acc, acc*0.5);
  }
`;

function Ripples({ rain }: { rain: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRain: { value: rain }, uColor: { value: new THREE.Color("#9fb0a6") } }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useFrame((s) => {
    if (mat.current) {
      (mat.current.uniforms.uTime as { value: number }).value = s.clock.elapsedTime;
      (mat.current.uniforms.uRain as { value: number }).value = rain;
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={3}>
      <circleGeometry args={[POOL.r * 0.98, 48]} />
      <shaderMaterial ref={mat} vertexShader={rippleVert} fragmentShader={rippleFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

export default function Pool({ rain = 1, low = false }: { rain?: number; low?: boolean }) {
  return (
    <group position={[POOL.cx, POOL.y, POOL.cz]}>
      {/* 池水面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={2}>
        <circleGeometry args={[POOL.r, 64]} />
        {low ? (
          <meshStandardMaterial color={COURT_PALETTE.poolDeep} roughness={0.4} metalness={0.5} envMapIntensity={0.2} />
        ) : (
          <MeshReflectorMaterial
            resolution={512}
            blur={[160, 60]}
            mixBlur={0.95}
            mixStrength={1.1}
            mixContrast={1.1}
            mirror={0.55}
            depthScale={0.5}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color={COURT_PALETTE.poolDeep}
            roughness={0.72}
            metalness={1}
            envMapIntensity={0.15}
            transparent
            opacity={0.92}
            depthWrite={false}
            fog={false}
          />
        )}
      </mesh>
      {/* 雨滴涟漪 */}
      <Ripples rain={rain} />
      {/* 石缘（磨圆湿石一圈） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={stoneMat} receiveShadow>
        <ringGeometry args={[POOL.r, POOL.r + 0.32, 48]} />
      </mesh>
    </group>
  );
}
