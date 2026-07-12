import * as THREE from "three";
import { ATTIC_PALETTE } from "./materials";

// 玻璃雨蚀 shader（水珠 + 拉丝）与材质工厂——独立于组件文件，便于 Stage 建一次全场共享。
// uTime / uRain 由 Stage 各建一份 uniform 对象，注入到本材质与雨丝材质（同源推进）。

export const glassVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const glassFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uRain;   // 雨势 0..1
  uniform vec3 uWarm;    // 室内暖高光
  uniform vec3 uCold;    // 玻璃冷底
  float h21(vec2 p){ p=fract(p*vec2(233.34,851.73)); p+=dot(p,p+23.45); return fract(p.x*p.y); }
  vec2 h22(vec2 p){ float n=h21(p); return vec2(n, h21(p+n)); }
  void main(){
    vec2 uv = vUv;
    float rim = 0.0;   // 水珠亮边
    for(int i=0;i<3;i++){
      float sc = 7.0 + float(i)*6.0;
      vec2 gv = uv*vec2(sc*0.7, sc);
      vec2 id = floor(gv);
      vec2 f = fract(gv)-0.5;
      vec2 rnd = h22(id + float(i)*19.7);
      float present = step(0.4, rnd.x);
      vec2 c = (rnd-0.5)*0.55;
      float d = length(f-c);
      float r = 0.16 + 0.15*rnd.y;
      float ring = smoothstep(r, r*0.72, d) - smoothstep(r*0.72, r*0.34, d);
      rim += present*max(ring,0.0);
    }
    float streak = 0.0;
    {
      vec2 su = uv*vec2(9.0, 1.0);
      float col = floor(su.x);
      float fx = fract(su.x);
      vec2 rnd = h22(vec2(col,51.3));
      float lane = step(0.8, rnd.x);
      float head = fract(rnd.y + uTime*0.05*(0.6+rnd.y));
      float dash = smoothstep(0.28,0.0, abs(uv.y-head));
      streak += lane * dash * smoothstep(0.12,0.0, abs(fx-0.5));
    }
    vec3 col = uCold;
    col += uWarm * rim * 1.5;
    col += vec3(0.78,0.85,1.0) * streak*0.6;
    float a = 0.5 + rim*0.55*uRain + streak*0.4*uRain;
    a = clamp(a, 0.0, 0.94);
    gl_FragColor = vec4(col, a);
  }
`;

/** 玻璃雨蚀材质（Stage 建一次、每帧推进 uTime、按心境写 uRain）。 */
export function makeRainGlassMaterial(rainUniform: { value: number }, timeUniform: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    uniforms: {
      uTime: timeUniform,
      uRain: rainUniform,
      uWarm: { value: new THREE.Color(ATTIC_PALETTE.lampWarm) },
      uCold: { value: new THREE.Color(ATTIC_PALETTE.glassCold) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
