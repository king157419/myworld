import * as THREE from "three";

// 相机导演的纯几何：聚焦取景位姿 + 指数阻尼缓动。无 React / DOM 依赖（可单测）。
//
// 两条经血的教训固化在此：
// · 朝向用 Matrix4.lookAt（相机约定：-Z 指向目标）。不要用 Object3D.lookAt——
//   它对非相机物体把 +Z 转向目标，用它算相机四元数会正好背对目标（第八轮 2a 根因）。
// · 缓动是按 dt 收敛的指数阻尼（stateless），不是定时器 tween——隐藏页/掉帧节流下
//   rAF 可能 1fps，固定时长的 tween 会退化成"冻住再跳变"。

const tmpMat = new THREE.Matrix4();
const tmpDir = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

export interface CameraLike {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov?: number;
  aspect?: number;
}

/**
 * 聚焦取景：以目标包围球（center+radius）为主体，按相机 fov/aspect 反算恰好框住主体的
 * 取景距离，从相机当前所在的一侧切入（least-disorienting，俯仰角夹在 [-0.15, 0.55]），
 * 输出目标机位与朝向（正对球心）。
 */
/** fov/aspect → 恰好框住包围球的取景距离。 */
function fitDistance(camera: CameraLike, radius: number): number {
  const vFov = THREE.MathUtils.degToRad(camera.fov ?? 55);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect ?? 1.6));
  return Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.3;
}

/** 相机当前位置 → 合法切入方向（单位向量；俯仰硬夹取，水平分量重配保持单位长）。 */
function approachDir(camera: CameraLike, center: THREE.Vector3, out: THREE.Vector3): void {
  out.copy(camera.position).sub(center);
  if (out.lengthSq() < 1e-4) out.set(0, 0.15, 1);
  out.normalize();
  // 俯仰硬夹取：clamp 后**重配水平分量**保持单位长。（此前是 clamp 再 normalize——
  // 水平分量趋零时 y 会被归一化顶回 ≈1，夹取形同虚设，正上方切入仍是垂直俯拍。）
  const yC = THREE.MathUtils.clamp(out.y, -0.15, 0.55);
  const hLen = Math.hypot(out.x, out.z);
  const hTarget = Math.sqrt(Math.max(0, 1 - yC * yC));
  if (hLen < 1e-4) {
    out.set(0, yC, hTarget); // 正上/正下方：无水平方向可保留，默认从 +Z 侧切入
  } else {
    out.x *= hTarget / hLen;
    out.z *= hTarget / hLen;
    out.y = yC;
  }
}

/** 由切入方向直接产出位姿（方向 → 机位 + 正对球心的朝向）。 */
function poseFromDir(dir: THREE.Vector3, center: THREE.Vector3, dist: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion): void {
  outPos.copy(center).addScaledVector(dir, dist);
  tmpMat.lookAt(outPos, center, tmpUp.set(0, 1, 0));
  outQuat.setFromRotationMatrix(tmpMat);
}

export function computeFocusPose(
  camera: CameraLike,
  center: THREE.Vector3,
  radius: number,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): void {
  approachDir(camera, center, tmpDir);
  poseFromDir(tmpDir, center, fitDistance(camera, radius), outPos, outQuat);
}

// 避障候选方位：先试玩家所在侧（0），不行左右交替越偏越多（弧度）。
const AZIMUTH_STEPS = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];

/**
 * 带避障的聚焦取景：从玩家所在侧起，按 AZIMUTH_STEPS 绕主体水平旋转候选机位，
 * 取第一个 isClear(机位) 通过的；全被挡则退回玩家侧（至少方向是对的）。
 * isClear 由调用方注入（场景 raycast 属副作用，纯函数不做）——审计 F3：
 * 黑胶角聚焦曾被一根落地灯整根挡在镜头前，取景只算包围球、从不检查视线。
 */
export function computeFocusPoseClear(
  camera: CameraLike,
  center: THREE.Vector3,
  radius: number,
  isClear: (pos: THREE.Vector3) => boolean,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): void {
  approachDir(camera, center, tmpDir);
  const dist = fitDistance(camera, radius);
  const baseX = tmpDir.x, baseY = tmpDir.y, baseZ = tmpDir.z;
  for (const a of AZIMUTH_STEPS) {
    const c = Math.cos(a), s = Math.sin(a);
    tmpDir.set(baseX * c - baseZ * s, baseY, baseX * s + baseZ * c);
    poseFromDir(tmpDir, center, dist, outPos, outQuat);
    if (isClear(outPos)) return;
  }
  tmpDir.set(baseX, baseY, baseZ);
  poseFromDir(tmpDir, center, dist, outPos, outQuat);
}

/** 位姿指数阻尼一步：帧率无关地向目标收敛（k = 1 - e^{-rate·dt}）。 */
export function dampPose(
  camera: CameraLike,
  goalPos: THREE.Vector3,
  goalQuat: THREE.Quaternion,
  dt: number,
  posRate = 6,
  rotRate = 9,
): void {
  camera.position.lerp(goalPos, 1 - Math.exp(-posRate * dt));
  camera.quaternion.slerp(goalQuat, 1 - Math.exp(-rotRate * dt));
}
