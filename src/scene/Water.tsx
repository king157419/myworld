import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { R_COURT, tideOffset } from "../theme";
import { RIPPLE_MAX, rippleData } from "./ripples";

// 镜面水：一层半透明的深蓝玻璃。低头（视线接近垂直）几乎透明 → 看见水下被镜像的整片星空（星海）；
// 掠射（接近水平）菲涅尔增强 → 泛起蓝色水光。脚步涟漪叠加在上面，打碎又重聚星海。
// 水下的星空由 Sky 的镜像副本提供；暖灯的倒影由下方 MirrorBeacons 的镜像发光球提供。

const waterVert = /* glsl */ `
  varying vec3 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const waterFrag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uDeep;
  uniform vec3 uSheen;
  void main(){
    vec3 V = normalize(cameraPosition - vWorld);
    float f = pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0); // 垂直看→0；掠射→1
    // 低头(f→0)：一层深水薄纱压住镜像（避免直视镜像银河核累加成白）；掠射(f→1)：极薄 → 地平线溶进星海。
    float alpha = mix(0.22, 0.07, f);
    vec3 col = mix(uDeep, uSheen, f);
    gl_FragColor = vec4(col, alpha);
  }
`;

function WaterSurface() {
  const uniforms = useMemo(
    () => ({ uDeep: { value: new THREE.Color("#04060f") }, uSheen: { value: new THREE.Color("#0b1530") } }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={2}>
      <planeGeometry args={[120, 120]} />
      <shaderMaterial vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const RIPPLE_LIFE = 4.2;
const RIPPLE_SPEED = 1.7;
const RIPPLE_THICK = 0.42;
const rippleVert = /* glsl */ `
  varying vec2 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const rippleFrag = /* glsl */ `
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime;
  uniform vec4 uRipples[${RIPPLE_MAX}];
  uniform vec3 uColor;
  void main(){
    float acc = 0.0;
    for (int i = 0; i < ${RIPPLE_MAX}; i++){
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
      float dist = distance(vWorld, r.xy);
      float radius = age * ${RIPPLE_SPEED.toFixed(2)};
      float ring = exp(-pow((dist - radius) / ${RIPPLE_THICK.toFixed(2)}, 2.0));
      float ring2 = 0.4 * exp(-pow((dist - radius*0.6) / ${RIPPLE_THICK.toFixed(2)}, 2.0));
      float life = 1.0 - age / ${RIPPLE_LIFE.toFixed(1)};
      float near = smoothstep(8.0, 0.0, dist);
      acc += (ring + ring2) * life * life * r.w * near;
    }
    acc = clamp(acc, 0.0, 0.9); // 收一点峰值，别让波纹打成一片白
    gl_FragColor = vec4(uColor * acc, acc * 0.4);
  }
`;

function RippleOverlay() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const ripples = useMemo(() => Array.from({ length: RIPPLE_MAX }, () => new THREE.Vector4(0, 0, -999, 0)), []);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRipples: { value: ripples }, uColor: { value: new THREE.Color("#8fa9d8") } }),
    [ripples],
  );
  useFrame((s) => {
    for (let i = 0; i < RIPPLE_MAX; i++) {
      ripples[i].set(rippleData[i * 4], rippleData[i * 4 + 1], rippleData[i * 4 + 2], rippleData[i * 4 + 3]);
    }
    if (mat.current) (mat.current.uniforms.uTime as { value: number }).value = s.clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={3}>
      <planeGeometry args={[2 * R_COURT + 4, 2 * R_COURT + 4]} />
      <shaderMaterial ref={mat} vertexShader={rippleVert} fragmentShader={rippleFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

export default function Water() {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (group.current) group.current.position.y = tideOffset(s.clock.elapsedTime);
  });
  return (
    <group ref={group}>
      <WaterSurface />
      <RippleOverlay />
    </group>
  );
}
