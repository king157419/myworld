import * as THREE from "three";
import { ATTIC_PALETTE } from "./materials";

// 玻璃雨蚀 shader（水珠 + 蜿蜒拉丝）+ 夜空面材质工厂——独立于组件文件，便于 Stage 建一次全场共享。
// uTime / uRain 由 Stage 各建一份 uniform 对象，注入到本材质与雨丝材质（同源推进）。
// 满分锚点 ref_rain_window_night_6：小而密、大小混杂的水珠（实心亮点+暗边缘），偶发 2-3 条蜿蜒拉丝，
// 底色是冷蓝灰的夜（不是发光蓝屏），水珠只在高光处掺一点暖。

export const glassVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const glassFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uRain;   // 雨势 0..1
  uniform vec3 uWarm;    // 室内暖高光（只在高光里掺一点）
  uniform vec3 uCold;    // 玻璃冷底
  float h21(vec2 p){ p=fract(p*vec2(233.34,851.73)); p+=dot(p,p+23.45); return fract(p.x*p.y); }
  vec2 h22(vec2 p){ float n=h21(p); return vec2(n, h21(p+n)); }
  void main(){
    vec2 uv = vUv;
    float body = 0.0;   // 水珠体（冷折射微亮）
    float spec = 0.0;   // 水珠高光点（实心亮点，非空心环）
    // 三层小水珠：密而小、大小混杂（网格密度约旧版 4~6×，珠径缩到 ~1/6）
    for(int i=0;i<3;i++){
      float sc = 30.0 + float(i)*13.0;             // 高密度网格 → 小水珠
      vec2 gv = uv*vec2(sc*0.82, sc);
      vec2 id = floor(gv);
      vec2 f = fract(gv)-0.5;
      vec2 rnd = h22(id + float(i)*23.1);
      float present = step(0.48, rnd.x);           // 约半数格有珠（密）
      vec2 c = (rnd-0.5)*0.6;
      float d = length(f-c);
      float rad = 0.13 + 0.20*rnd.y;               // 混合尺寸
      float disc = smoothstep(rad, rad*0.4, d);    // 实心圆盘、柔边（不是环）
      body += present*disc;
      // 高光点：珠内偏上一点的小亮斑（掠射灯的反光），实心
      float sd = length((f-c) + vec2(0.30,0.34)*rad);
      spec += present*disc*smoothstep(rad*0.42, 0.0, sd);
    }
    body = clamp(body, 0.0, 1.0);
    spec = clamp(spec, 0.0, 1.0);
    // 2-3 条蜿蜒下滑的拉丝（不满屏）——各自横向缓摆
    float trail = 0.0;
    for(int k=0;k<3;k++){
      float fk = float(k);
      float lane = h21(vec2(fk, 9.7));
      float x = 0.18 + 0.64*lane + 0.05*sin(uv.y*7.0 + uTime*0.25 + fk*2.1);
      float head = fract(uTime*0.06*(0.6+lane) + fk*0.31);
      float w = smoothstep(0.010, 0.0, abs(uv.x - x));
      float run = smoothstep(0.30, 0.0, abs(uv.y - (1.0-head)));
      trail += w*run;
    }
    trail = clamp(trail, 0.0, 1.0);
    // 冷底 + 冷白高光；珠体偏冷灰，只在高光里掺一点暖（其余冷）
    vec3 col = uCold;
    vec3 dropTint = mix(uCold, vec3(0.50,0.60,0.74), 0.6);
    col = mix(col, dropTint, body*0.5);
    vec3 hot = mix(vec3(0.80,0.87,1.0), uWarm, 0.30);
    col += hot * spec * 0.9;
    col += vec3(0.62,0.72,0.90) * trail * 0.20;
    float a = 0.32 + (body*0.32 + spec*0.5 + trail*0.26) * uRain;
    a = clamp(a, 0.0, 0.86);
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

const nightFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uTop;   // 天顶（深）
  uniform vec3 uBot;   // 近地平线（略提亮的冷）
  float h21(vec2 p){ p=fract(p*vec2(233.34,851.73)); p+=dot(p,p+23.45); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    float a=h21(i), b=h21(i+vec2(1.0,0.0)), c=h21(i+vec2(0.0,1.0)), d=h21(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  void main(){
    vec2 uv = vUv;
    float g = smoothstep(-0.15, 1.15, uv.y);
    vec3 base = mix(uBot, uTop, g);
    // 低频云：非常轻的明暗起伏，破掉纯色（避免读作发光蓝屏）
    float n = vnoise(uv*vec2(2.2,1.6) + vec2(uTime*0.006, 0.0));
    n += 0.5*vnoise(uv*vec2(4.7,3.3) - vec2(uTime*0.003, 0.0));
    n /= 1.5;
    base *= 0.80 + 0.34*n;
    gl_FragColor = vec4(base, 1.0);
  }
`;

/** 窗外夜空面：暗蓝灰 + 低频云渐变（不透明背衬，紧贴玻璃后）。~4× 暗于旧版纯蓝，去 LED 感。 */
export function makeNightSkyMaterial(timeUniform: { value: number }, top: THREE.ColorRepresentation, bot: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glassVert,
    fragmentShader: nightFrag,
    uniforms: {
      uTime: timeUniform,
      uTop: { value: new THREE.Color(top) },
      uBot: { value: new THREE.Color(bot) },
    },
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: true,
  });
}
