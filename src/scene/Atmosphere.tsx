import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { R_COURT } from "../theme";
import { spawnRipple } from "./ripples";
import { useWorld } from "../store/useWorld";
import { MOOD_PRESETS } from "../config/moods";
import { audioEngine } from "../audio/engine";
import Starfall from "./Starfall";

// 氛围：贴着水面缓缓漂移的薄雾 + 空气里悬浮的微尘/萤火 + （雨夜）偶发远雷。
// 心境在此消费：薄雾颜色/浓度按 MOOD_PRESETS 调制，rainy 档启用远雷。

const mistVert = /* glsl */ `
  varying vec2 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const mistFrag = /* glsl */ `
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime;
  uniform float uStrength;
  uniform vec3 uColor;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
  void main(){
    vec2 q = vWorld*0.12 + vec2(uTime*0.012, uTime*0.008);
    float m = fbm(q);
    m = smoothstep(0.5, 1.0, m);
    float r = length(vWorld);
    float ring = smoothstep(1.5, 6.0, r) * smoothstep(13.0, 7.0, r); // 极薄、贴身、不延伸到地平线（避免切开天水）
    float a = m * ring * 0.1 * uStrength;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Mist({ color, strength }: { color: string; strength: number }) {
  const layers = useRef<(THREE.ShaderMaterial | null)[]>([null, null]);
  // 两层共用同一个 uTime 引用（显式共享，一次驱动两层）；颜色/浓度各自独立可调。
  const uTime = useMemo(() => ({ value: 0 }), []);
  const uniforms = useMemo(
    () => [
      { uTime, uStrength: { value: 1 }, uColor: { value: new THREE.Color("#9fb6d8") } },
      { uTime, uStrength: { value: 1 }, uColor: { value: new THREE.Color("#8aa0c8") } },
    ],
    [uTime],
  );

  // 心境切换：调色/调浓，不重建材质
  useEffect(() => {
    const base = new THREE.Color(color);
    uniforms[0].uColor.value.copy(base);
    uniforms[1].uColor.value.copy(base).multiplyScalar(0.88);
    uniforms[0].uStrength.value = strength;
    uniforms[1].uStrength.value = strength;
  }, [color, strength, uniforms]);

  useFrame((s) => {
    uTime.value = s.clock.elapsedTime;
  });
  return (
    <group>
      {[0.35, 0.75].map((y, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} frustumCulled={false} renderOrder={3}>
          <planeGeometry args={[58, 58]} />
          <shaderMaterial
            ref={(m) => { layers.current[i] = m; }}
            vertexShader={mistVert}
            fragmentShader={mistFrag}
            uniforms={uniforms[i]}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Motes() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 140;
  const { geom, mat } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (R_COURT + 2);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 4 + 0.2;
      pos[i * 3 + 2] = Math.sin(a) * r;
      spd[i] = 0.05 + Math.random() * 0.12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpd", new THREE.BufferAttribute(spd, 1));
    const m = new THREE.PointsMaterial({
      size: 0.03,
      color: new THREE.Color("#ffe2b0"),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    return { geom: g, mat: m };
  }, []);

  const drip = useRef(1.2);
  useFrame((s, dt) => {
    const p = geom.getAttribute("position") as THREE.BufferAttribute;
    const spd = geom.getAttribute("aSpd") as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      let y = arr[i * 3 + 1] + spd.getX(i) * dt;
      arr[i * 3] += Math.sin(s.clock.elapsedTime * 0.3 + i) * dt * 0.05;
      if (y > 4.6) y = 0.1;
      arr[i * 3 + 1] = y;
    }
    p.needsUpdate = true;
    // 偶发的"一滴落水"：让镜面在你静止时也在轻轻呼吸。
    drip.current -= dt;
    if (drip.current <= 0) {
      drip.current = 2.4 + Math.random() * 3.6;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (R_COURT - 1);
      spawnRipple(Math.cos(a) * r, Math.sin(a) * r, s.clock.elapsedTime, 0.4);
    }
  });

  return <points ref={ref} geometry={geom} material={mat} frustumCulled={false} />;
}

/** 雨夜远雷：8~40 秒随机间隔的低频轰鸣（engine.thunder 合成，无外部文件）。 */
function DistantThunder() {
  useEffect(() => {
    let alive = true;
    let id: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      id = setTimeout(() => {
        if (!alive) return;
        audioEngine.thunder(0.35 + Math.random() * 0.5);
        schedule(16000 + Math.random() * 24000);
      }, delay);
    };
    schedule(8000 + Math.random() * 10000);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);
  return null;
}

export default function Atmosphere() {
  const mood = useWorld((s) => s.world.room.mood.lighting);
  const preset = MOOD_PRESETS[mood] ?? MOOD_PRESETS.cool;
  return (
    <group>
      <Mist color={preset.mistColor} strength={preset.mistMul} />
      <Motes />
      {/* 星光柱：雨夜云厚，星光落不下来 */}
      <Starfall visible={!preset.thunder} />
      {preset.thunder && <DistantThunder />}
    </group>
  );
}
