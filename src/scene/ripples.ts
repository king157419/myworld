// ─────────────────────────────────────────────────────────────────────────
// 脚步涟漪共享缓冲：PlayerControls 每走过一步就 spawn 一圈涟漪，Water 的涟漪着色器
// 每帧读取这组圆心 → "你走过的每一步都在星海倒影上荡开涟漪"。
//
// 模块级、定长环形缓冲（无分配、无 React），以 vec4(x, z, startTime, strength) 存。
// ─────────────────────────────────────────────────────────────────────────
export const RIPPLE_MAX = 14;
// 每个涟漪 4 个分量：x, z, t0, strength。
export const rippleData = new Float32Array(RIPPLE_MAX * 4);
let head = 0;

/** 在 (x,z) 于时刻 t 投下一圈涟漪。strength 缺省 1（落水/起步更强）。 */
export function spawnRipple(x: number, z: number, t: number, strength = 1): void {
  const i = head * 4;
  rippleData[i] = x;
  rippleData[i + 1] = z;
  rippleData[i + 2] = t;
  rippleData[i + 3] = strength;
  head = (head + 1) % RIPPLE_MAX;
}
