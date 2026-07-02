import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOME_R, PALETTE, STAR_COUNT } from "../theme";

// 夜空：渐变穹顶 + 银河带 + 真实星点 + 低月。
// 关键：整片天空再镜像复制一份到水面之下（group scale y=-1）——配合 Water 的半透明玻璃水面，
// 你低头就能看见脚下一片同样密的「星海」（天空之镜）。
// ⚠ 倒影必须比真天空「暗」：水会吸光。镜像副本用 uBright≈0.42 压暗，否则低头直视镜像银河核
//   会把成百上千个叠加星点累加成一片白曝光（这正是之前低头一片白的根因）。

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const domeFrag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uMilky;
  uniform float uBright;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(17.1,113.5,71.7)))*43758.5453); }
  float noise(vec3 p){
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float n=mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    return n;
  }
  float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.05; a*=0.5; } return s; }
  void main(){
    float h = clamp(vDir.y*0.5+0.5, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.04, 0.62, h));
    // 地平线辉光带：贴地一窄条更亮的冷蓝——远景群岛的剪影靠它衬出来（大气透视的"亮背景"）
    float hg = exp(-max(vDir.y, 0.0) * 10.0) * smoothstep(-0.12, 0.0, vDir.y);
    col += uHorizon * hg * 0.9;
    // 银河：一条柔和、有絮状层次、自然融进星场的乳白光河（不是蓝色硬光束）
    vec3 bandN = normalize(vec3(0.42, 0.5, -0.72));
    float band = 1.0 - abs(dot(normalize(vDir), bandN));
    float cloud = fbm(vDir*5.0)*0.6 + fbm(vDir*13.0)*0.4;
    float milky = smoothstep(0.6, 1.0, band);
    milky *= (0.25 + 0.75*cloud);
    milky *= milky;
    col += uMilky * milky * 0.28;                 // 只留一层很淡的星尘底；银河的"亮"交给沿带聚集的星点
    gl_FragColor = vec4(col * uBright, 1.0);
  }
`;

const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aHue;
  varying float vPhase;
  varying float vHue;
  uniform float uPix;
  void main(){
    vPhase = aPhase; vHue = aHue;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPix;
  }
`;
const starFrag = /* glsl */ `
  precision highp float;
  varying float vPhase;
  varying float vHue;
  uniform float uTime;
  uniform float uBright;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    core = core * core;                              // 更锐的星芯 + 柔晕
    float twinkle = 0.72 + 0.28 * sin(uTime*1.6 + vPhase*6.2831);
    vec3 cold = vec3(0.80,0.88,1.0);
    vec3 warm = vec3(1.0,0.92,0.78);
    vec3 col = mix(cold, warm, vHue) * uBright;
    gl_FragColor = vec4(col, core * twinkle);
  }
`;

function useStarGeometry() {
  return useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const hue = new Float32Array(STAR_COUNT);
    const bandN = new THREE.Vector3(0.42, 0.5, -0.72).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < STAR_COUNT; i++) {
      do {
        v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      } while (v.lengthSq() > 1 || v.lengthSq() < 1e-3);
      v.normalize();
      // 约 4 成星被拉向银河大圆 → 沿带聚成"有星粒结构的星河"，而不是一团雾
      if (Math.random() < 0.4) {
        v.addScaledVector(bandN, -v.dot(bandN) * (0.6 + Math.random() * 0.35));
        v.normalize();
      }
      v.y = Math.abs(v.y); // 均匀铺满整个上半球（含天顶）——低头看水里才到处是星
      v.normalize();
      const r = DOME_R * 0.97;
      pos[i * 3] = v.x * r;
      pos[i * 3 + 1] = v.y * r;
      pos[i * 3 + 2] = v.z * r;
      const band = 1 - Math.abs(v.dot(bandN));
      const inBand = band > 0.78;
      // 少数"主星"做视觉锚；银河带内更密更亮（但收敛幅度，避免镜像里累加成白斑）
      const anchor = Math.random() < 0.01;
      const base = 1.7 + Math.random() * Math.random() * 3.8;
      size[i] = anchor ? 6 + Math.random() * 2.5 : base * (inBand ? 1.4 : 1.0);
      phase[i] = Math.random();
      hue[i] = Math.random() < 0.2 ? Math.random() : 0.0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aHue", new THREE.BufferAttribute(hue, 1));
    return g;
  }, []);
}

// 一份完整天空（穹顶 + 星点 + 月）。bright<1 用于水下镜像，使倒影比真天空暗（水吸光）。
function SkyContent({ starGeom, bright }: { starGeom: THREE.BufferGeometry; bright: number }) {
  const domeUniforms = useMemo(
    () => ({
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      uZenith: { value: new THREE.Color(PALETTE.skyZenith) },
      uMilky: { value: new THREE.Color(PALETTE.milky) },
      uBright: { value: bright },
    }),
    [bright],
  );
  const starMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: {
          uTime: { value: 0 },
          uPix: { value: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1) },
          uBright: { value: bright },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [bright],
  );
  useFrame((s) => {
    (starMat.uniforms.uTime as { value: number }).value = s.clock.elapsedTime;
  });

  const moonDir = useMemo(() => new THREE.Vector3(-0.42, 0.26, -1).normalize().multiplyScalar(DOME_R * 0.97), []);
  const moonQuat = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(moonDir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [moonDir]);
  const moonCore = useMemo(() => new THREE.Color("#eef2ff").multiplyScalar(Math.min(1, bright + 0.15)), [bright]);
  const moonHalo = useMemo(() => new THREE.Color("#b2c6ee"), []);

  return (
    <group>
      <mesh scale={[-1, 1, 1]} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[DOME_R, 48, 32]} />
        <shaderMaterial vertexShader={domeVert} fragmentShader={domeFrag} uniforms={domeUniforms} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <points geometry={starGeom} material={starMat} frustumCulled={false} renderOrder={-9} />
      <group position={moonDir.toArray()} quaternion={moonQuat}>
        <mesh>
          <circleGeometry args={[1.3, 48]} />
          <meshBasicMaterial color={moonCore} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[2.8, 48]} />
          <meshBasicMaterial color={moonHalo} transparent opacity={0.16 * bright} toneMapped={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}

export default function Sky() {
  const starGeom = useStarGeometry();
  return (
    <group>
      <SkyContent starGeom={starGeom} bright={1.0} />
      {/* 镜像到水下：脚下的星海。压暗到 ~0.42——倒影永远比真天空暗，否则低头一片白。 */}
      <group scale={[1, -1, 1]}>
        <SkyContent starGeom={starGeom} bright={0.42} />
      </group>
    </group>
  );
}
