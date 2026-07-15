import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { DOME_R, R_COURT, tideOffset } from "../theme";
import { RIPPLE_MAX, rippleData } from "./ripples";

// 镜面水，两档实现：
// · 高配：MeshReflectorMaterial 真实平面反射——暖灯、书墙、月亮、星点全部真实倒映在脚下，
//   这是"走在星海上"的存在感来源（反射 = 每帧多渲一遍场景到 RT，低端付不起）。
//   水面保留少量透明度：沉在水下的思绪光点（SunkenThoughts，renderOrder 提到水之上）仍能透出来。
// · 低配：半透明深蓝玻璃 + 菲涅尔。"倒影"来自 Sky 在水下的镜像副本（压暗），一次绘制、零 RT。
// 两档共用：脚步涟漪叠加层，打碎又重聚星海。Sky 的镜像副本两档都保留——对平面镜而言
// "透过玻璃看见的镜像天空"与"反射出的天空"几何上重合，高配下它只是被水面遮成很淡的底衬。

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

function GlassSurface() {
  const uniforms = useMemo(
    () => ({ uDeep: { value: new THREE.Color("#04060f") }, uSheen: { value: new THREE.Color("#0b1530") } }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={2}>
      <circleGeometry args={[DOME_R, 96]} />
      <shaderMaterial vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function MirrorSurface() {
  // 反射参数：星点要保持"点"的锐度 → blur 只给很小的一档（远处微糊 = 水汽）；
  // mixStrength 是反射进面的强度；mirror 拉高让暗色水面吃满环境（夜景全靠它）。
  //
  // 涟漪 distortionMap（本轮）：把脚步涟漪场离屏渲成一张灰度贴图（红通道=环强度），
  // 按与水面 circleGeometry 相同的 UV↔世界映射对位，喂给 MeshReflectorMaterial 的
  // distortionMap——倒影的星空会在你踩出的每一圈涟漪处真实地被扯动、揉碎、再合拢，
  // 而不只是叠层加亮（叠层 RippleOverlay 仍在，负责亮环；此处负责"倒影碎裂"）。
  const { gl } = useThree();
  const rt = useMemo(
    () => new THREE.WebGLRenderTarget(256, 256, { depthBuffer: false, stencilBuffer: false }),
    [],
  );
  const dScene = useMemo(() => {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x000000); // 基线 0 → 无涟漪处零扭曲
    return s;
  }, []);
  const dCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const dRipples = useMemo(() => Array.from({ length: RIPPLE_MAX }, () => new THREE.Vector4(0, 0, -999, 0)), []);
  const dUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRipples: { value: dRipples }, uR: { value: DOME_R } }),
    [dRipples],
  );
  useMemo(() => {
    const q = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: distortVert, fragmentShader: distortFrag, uniforms: dUniforms }),
    );
    dScene.add(q);
  }, [dScene, dUniforms]);
  useEffect(() => () => rt.dispose(), [rt]);

  useFrame((s) => {
    for (let i = 0; i < RIPPLE_MAX; i++) {
      dRipples[i].set(rippleData[i * 4], rippleData[i * 4 + 1], rippleData[i * 4 + 2], rippleData[i * 4 + 3]);
    }
    dUniforms.uTime.value = s.clock.elapsedTime;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    gl.render(dScene, dCam);
    gl.setRenderTarget(prev);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={2}>
      <circleGeometry args={[DOME_R, 96]} />
      {/* 材质哲学：金属 1 + 暗蓝黑 albedo = "黑镜"——场景光的 specular 被 albedo 染暗
          （白爆的月光柱变成克制的淡蓝月路，暖点光只留暗金光潭），画面主体交给 RT 镜像；
          opacity 0.5 让水下镜像星空透出来（星海底衬），envMapIntensity 压到 0.2 防 IBL 暖罩。 */}
      <MeshReflectorMaterial
        resolution={1024}
        blur={[80, 24]}
        mixBlur={0.32}
        mixStrength={2.6}
        mixContrast={1.22}
        mirror={0.9}
        depthScale={0.6}
        minDepthThreshold={0.5}
        maxDepthThreshold={1.4}
        color="#1a2233"
        roughness={0.5}
        metalness={1}
        envMapIntensity={0.2}
        distortionMap={rt.texture}
        distortion={0.22}
        transparent
        opacity={0.5}
        depthWrite={false}
        fog={false}
      />
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

// 涟漪扭曲场：离屏渲成灰度贴图（红=环强度），供 MeshReflectorMaterial.distortionMap 采样。
// UV↔世界映射与水面 circleGeometry 一致：world = ((uv-0.5)*2R, -(v-0.5)*2R)，故扭曲与涟漪对位。
const distortVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const distortFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec4 uRipples[${RIPPLE_MAX}];
  uniform float uR;
  void main(){
    vec2 world = vec2((vUv.x - 0.5) * 2.0 * uR, -(vUv.y - 0.5) * 2.0 * uR);
    float acc = 0.0;
    for (int i = 0; i < ${RIPPLE_MAX}; i++){
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
      float dist = distance(world, r.xy);
      float radius = age * ${RIPPLE_SPEED.toFixed(2)};
      float ring = exp(-pow((dist - radius) / ${RIPPLE_THICK.toFixed(2)}, 2.0));
      float life = 1.0 - age / ${RIPPLE_LIFE.toFixed(1)};
      acc += ring * life * r.w;
    }
    gl_FragColor = vec4(vec3(clamp(acc, 0.0, 1.0)), 1.0);
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

export default function Water({ low = false }: { low?: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (group.current) group.current.position.y = tideOffset(s.clock.elapsedTime);
  });
  return (
    <group ref={group}>
      {low ? <GlassSurface /> : <MirrorSurface />}
      <RippleOverlay />
    </group>
  );
}
