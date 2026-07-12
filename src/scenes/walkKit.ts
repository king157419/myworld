// ─────────────────────────────────────────────────────────────────────────
// 占位场景通用行走求解工厂：纯函数、无 THREE / DOM 依赖（可单测）。
//
// 潮汐图书馆（loft）有自己久经打磨的 scene/walk.ts，**不走这里**（零回归）。
// attic / courtyard 等占位场景各用 makeWalk 组一个求解器：给一个"脚下地表高度"
// 函数 + "夹回可行走区"函数 + 可选圆柱碰撞，得到与 loft 同形状（连续坡、沿墙滑行、
// MAX_STEP_UP 挡住过高坡壁）的 resolveMove。逻辑照搬 walk.ts 的已验证实现。
// ─────────────────────────────────────────────────────────────────────────

export interface WalkResolved {
  x: number;
  z: number;
  y: number; // 地表高度（脚），相机视高另加 EYE
}

/** 与 scene/walk.ts 的 resolveMove 同签名：给上一帧位置与本帧期望位置，返回合法落点。 */
export type WalkFn = (
  prevY: number,
  fromX: number,
  fromZ: number,
  wantX: number,
  wantZ: number,
) => WalkResolved;

export interface Collider {
  cx: number;
  cz: number;
  r: number;
}

export interface WalkKit {
  /** 脚下地表高度（优先级、坡道等由场景定义）。x,z 已被 clamp 进可行走区。 */
  support: (x: number, z: number, currentY: number) => number;
  /** 把期望落点夹进可行走区（取最近的合法点）。 */
  clampToFloor: (x: number, z: number) => [number, number];
  colliders?: Collider[];
  radius?: number; // 玩家身体半径
  maxStepUp?: number; // 单帧最多抬升（挡住从侧面撞上的高坡壁）
}

export function makeWalk(kit: WalkKit): WalkFn {
  const radius = kit.radius ?? 0.32;
  const maxStepUp = kit.maxStepUp ?? 0.42;
  const colliders = kit.colliders ?? [];

  // 沿障碍滑行（slide）而非径向弹出：剔除指向圆心的位移分量，贴面绕行不反弹。
  function slide(fx: number, fz: number, x: number, z: number): [number, number] {
    let nx = x,
      nz = z;
    for (const { cx, cz, r } of colliders) {
      const minR = r + radius;
      const dx = nx - cx,
        dz = nz - cz;
      if (Math.hypot(dx, dz) >= minR) continue;
      let onx = fx - cx,
        onz = fz - cz;
      let ol = Math.hypot(onx, onz);
      if (ol < 1e-4) {
        onx = dx;
        onz = dz;
        ol = Math.hypot(dx, dz);
      }
      if (ol < 1e-4) {
        onx = 1;
        onz = 0;
        ol = 1;
      }
      onx /= ol;
      onz /= ol;
      const mvx = nx - fx,
        mvz = nz - fz;
      const dot = mvx * onx + mvz * onz;
      if (dot < 0) {
        nx = fx + (mvx - dot * onx);
        nz = fz + (mvz - dot * onz);
      }
      const ax = nx - cx,
        az = nz - cz;
      const ad = Math.hypot(ax, az);
      if (ad < minR) {
        if (ad > 1e-4) {
          nx = cx + (ax / ad) * minR;
          nz = cz + (az / ad) * minR;
        } else {
          nx = cx + onx * minR;
          nz = cz + onz * minR;
        }
      }
    }
    return [nx, nz];
  }

  function attempt(prevY: number, fromX: number, fromZ: number, tx: number, tz: number) {
    let [x, z] = kit.clampToFloor(tx, tz);
    [x, z] = slide(fromX, fromZ, x, z);
    [x, z] = kit.clampToFloor(x, z);
    const y = kit.support(x, z, prevY);
    const fromY = kit.support(fromX, fromZ, prevY);
    return { x, z, y, ok: y - fromY <= maxStepUp };
  }

  return (prevY, fromX, fromZ, wantX, wantZ) => {
    const full = attempt(prevY, fromX, fromZ, wantX, wantZ);
    if (full.ok) return { x: full.x, z: full.z, y: full.y };

    // 撞上太高的坡壁 → 轴分离滑行（沿墙走），取可行且更接近目标者。
    const xOnly = attempt(prevY, fromX, fromZ, wantX, fromZ);
    const zOnly = attempt(prevY, fromX, fromZ, fromX, wantZ);
    const dist = (a: { x: number; z: number }) => Math.hypot(wantX - a.x, wantZ - a.z);
    const ok = [xOnly, zOnly].filter((a) => a.ok).sort((a, b) => dist(a) - dist(b));
    if (ok.length) return { x: ok[0].x, z: ok[0].z, y: ok[0].y };

    return { x: fromX, z: fromZ, y: kit.support(fromX, fromZ, prevY) };
  };
}

/** 数值夹取小工具。 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
