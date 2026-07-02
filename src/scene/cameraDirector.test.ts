import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeFocusPose, dampPose } from "./cameraDirector";

// 相机导演纯几何的回归锚：
// · 取景距离 = max(r/sin(vFov/2), r/sin(hFov/2)) · 1.3（恰好框住包围球再留白）
// · 朝向正对球心（-Z 指向目标，相机约定——Object3D.lookAt 反向的老坑）
// · 从相机所在的一侧切入，俯仰分量夹在 [-0.15, 0.55]

function makeCam(px: number, py: number, pz: number, fov = 58, aspect = 1.6) {
  return {
    position: new THREE.Vector3(px, py, pz),
    quaternion: new THREE.Quaternion(),
    fov,
    aspect,
  };
}

describe("computeFocusPose", () => {
  it("取景距离按 fov 反算恰好框住包围球", () => {
    const cam = makeCam(0, 1.6, 6.6);
    const center = new THREE.Vector3(0, 2.02, -9.4);
    const radius = 1.05;
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    computeFocusPose(cam, center, radius, pos, q);

    const vFov = THREE.MathUtils.degToRad(58);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * 1.6);
    const want = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.3;
    expect(pos.distanceTo(center)).toBeCloseTo(want, 5);
  });

  it("朝向正对球心（相机 -Z 与指向目标的方向 dot≈1）", () => {
    const cam = makeCam(3, 1.6, 2);
    const center = new THREE.Vector3(-6.0, 1.95, -0.3);
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    computeFocusPose(cam, center, 2.5, pos, q);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const toCenter = center.clone().sub(pos).normalize();
    expect(forward.dot(toCenter)).toBeGreaterThan(0.9999);
  });

  it("从玩家一侧切入：机位与相机在球心的同一侧（水平方向同号）", () => {
    const cam = makeCam(8, 1.6, 4);
    const center = new THREE.Vector3(0, 1.0, 0);
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    computeFocusPose(cam, center, 1.5, pos, q);

    const sideCam = cam.position.clone().sub(center).setY(0).normalize();
    const sidePos = pos.clone().sub(center).setY(0).normalize();
    expect(sideCam.dot(sidePos)).toBeGreaterThan(0.99);
  });

  it("相机在正上方时俯仰被夹住（不垂直俯拍）", () => {
    const cam = makeCam(0, 12, 0.001);
    const center = new THREE.Vector3(0, 1.0, 0);
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    computeFocusPose(cam, center, 1.5, pos, q);

    const dir = pos.clone().sub(center).normalize();
    expect(dir.y).toBeLessThanOrEqual(0.55 + 1e-6);
  });
});

describe("dampPose", () => {
  it("向目标收敛且不越过", () => {
    const cam = makeCam(0, 0, 10);
    const goal = new THREE.Vector3(0, 0, 0);
    const gq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    let prev = cam.position.distanceTo(goal);
    for (let i = 0; i < 60; i++) {
      dampPose(cam, goal, gq, 1 / 60);
      const d = cam.position.distanceTo(goal);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(prev).toBeLessThan(10 * Math.exp(-6) * 1.05); // ~1s 后收敛到 e^{-6}
  });

  it("帧率无关：一大步 ≈ 两小步（指数阻尼性质）", () => {
    const a = makeCam(0, 0, 10);
    const b = makeCam(0, 0, 10);
    const goal = new THREE.Vector3();
    const gq = new THREE.Quaternion();
    dampPose(a, goal, gq, 0.1);
    dampPose(b, goal, gq, 0.05);
    dampPose(b, goal, gq, 0.05);
    expect(Math.abs(a.position.z - b.position.z)).toBeLessThan(1e-9);
  });
});
