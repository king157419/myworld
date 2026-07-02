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
export function computeFocusPose(
  camera: CameraLike,
  center: THREE.Vector3,
  radius: number,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): void {
  const vFov = THREE.MathUtils.degToRad(camera.fov ?? 55);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect ?? 1.6));
  const dist = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.3;

  tmpDir.copy(camera.position).sub(center);
  if (tmpDir.lengthSq() < 1e-4) tmpDir.set(0, 0.15, 1);
  tmpDir.normalize();
  // 俯仰硬夹取：clamp 后**重配水平分量**保持单位长。（此前是 clamp 再 normalize——
  // 水平分量趋零时 y 会被归一化顶回 ≈1，夹取形同虚设，正上方切入仍是垂直俯拍。）
  const yC = THREE.MathUtils.clamp(tmpDir.y, -0.15, 0.55);
  const hLen = Math.hypot(tmpDir.x, tmpDir.z);
  const hTarget = Math.sqrt(Math.max(0, 1 - yC * yC));
  if (hLen < 1e-4) {
    tmpDir.set(0, yC, hTarget); // 正上/正下方：无水平方向可保留，默认从 +Z 侧切入
  } else {
    tmpDir.x *= hTarget / hLen;
    tmpDir.z *= hTarget / hLen;
    tmpDir.y = yC;
  }
  outPos.copy(center).addScaledVector(tmpDir, dist);
  tmpMat.lookAt(outPos, center, tmpUp.set(0, 1, 0));
  outQuat.setFromRotationMatrix(tmpMat);
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
