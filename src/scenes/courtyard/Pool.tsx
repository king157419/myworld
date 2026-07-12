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
        float ring = exp(-pow((d-radius)/0.02, 2.0)); // 更细的环（评审 R12·C1）
        float fade = (1.0-ph);
        acc += ring*fade;
      }
    }
    acc = clamp(acc, 0.0, 1.0) * uRain;
    // 评审 R12·C1：涟漪圈从霓虹白圈压成细灰绿——透明度降到 ~0.16，颜色改灰绿。
    gl_FragColor = vec4(uColor*acc, acc*0.16);
  }
`;

// —— 菲涅尔灰绿光泽层（评审 R12·C1：池面不许纯黑，掠射角要有最低限度的天空反射面感） ——
const sheenVert = /* glsl */ `
  varying vec3 vView;
  varying vec3 vN;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - wp.xyz);
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const sheenFrag = /* glsl */ `
  precision highp float;
  varying vec3 vView;
  varying vec3 vN;
  uniform vec3 uColor;
  void main(){
    float f = pow(1.0 - clamp(dot(vView, vN), 0.0, 1.0), 3.0);
    gl_FragColor = vec4(uColor, f * 0.4);
  }
`;

function PoolSheen() {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color("#54655b") } }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} renderOrder={2}>
      <circleGeometry args={[POOL.r * 0.995, 64]} />
      <shaderMaterial vertexShader={sheenVert} fragmentShader={sheenFrag} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Ripples({ rain }: { rain: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRain: { value: rain }, uColor: { value: new THREE.Color("#7c8a80") } }),
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
          <meshStandardMaterial color={COURT_PALETTE.poolSheen} roughness={0.34} metalness={0.55} envMapIntensity={0.25} />
        ) : (
          // 评审 R12·C1：略提 albedo（深墨绿有微光，非黑洞）+ 抬高反射强度让灰绿天空/竹影映进来。
          <MeshReflectorMaterial
            resolution={512}
            blur={[160, 60]}
            mixBlur={0.9}
            mixStrength={1.35}
            mixContrast={1.1}
            mirror={0.6}
            depthScale={0.5}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color={COURT_PALETTE.poolDeep}
            roughness={0.66}
            metalness={1}
            envMapIntensity={0.3}
            transparent
            opacity={0.92}
            depthWrite={false}
            fog={false}
          />
        )}
      </mesh>
      {/* 菲涅尔灰绿光泽（掠射面感，池面不再纯黑黑洞） */}
      <PoolSheen />
      {/* 雨滴涟漪 */}
      <Ripples rain={rain} />
      {/* 石缘（磨圆湿石一圈） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={stoneMat} receiveShadow>
        <ringGeometry args={[POOL.r, POOL.r + 0.32, 48]} />
      </mesh>
    </group>
  );
}
