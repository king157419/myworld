import * as THREE from "three";
import { audioEngine } from "../audio/engine";

// 相机 → WebAudio 听者位姿同步。抽出来的原因：
// · 之前这段以函数声明的形式写在 useFrame 体内（每帧重建闭包）+ 每次 3 个数组字面量分配；
// · 每次推送是 9 个 setTargetAtTime 自动化事件——站着不动时纯属浪费。位姿没变就跳过。

const dir = new THREE.Vector3();
const up = new THREE.Vector3();
const lastPos = new THREE.Vector3(Infinity, Infinity, Infinity);
const lastQuat = new THREE.Quaternion(0, 0, 0, 0); // 与任何真实朝向的 |dot| 都是 0 → 首帧必推
const posArr: [number, number, number] = [0, 0, 0];
const fwdArr: [number, number, number] = [0, 0, 0];
const upArr: [number, number, number] = [0, 0, 0];

/** 每帧调用；位姿相对上次推送几乎未变时直接返回。 */
export function syncAudioListener(camera: THREE.Camera): void {
  if (
    camera.position.distanceToSquared(lastPos) < 1e-8 &&
    Math.abs(camera.quaternion.dot(lastQuat)) > 0.9999999
  ) {
    return;
  }
  lastPos.copy(camera.position);
  lastQuat.copy(camera.quaternion);

  camera.getWorldDirection(dir);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion); // 随相机俯仰的真实 up，保持与 forward 正交
  posArr[0] = camera.position.x; posArr[1] = camera.position.y; posArr[2] = camera.position.z;
  fwdArr[0] = dir.x; fwdArr[1] = dir.y; fwdArr[2] = dir.z;
  upArr[0] = up.x; upArr[1] = up.y; upArr[2] = up.z;
  audioEngine.setListener(posArr, fwdArr, upArr);
}
