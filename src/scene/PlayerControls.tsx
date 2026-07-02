import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store/useWorld";
import { resolveMove } from "./walk";
import { interactableObjs, zoneIdOf } from "./interactables";
import { spawnRipple } from "./ripples";
import { useWalkInput } from "./input";
import { computeFocusPose, dampPose } from "./cameraDirector";
import { syncAudioListener } from "./audioListener";
import { EYE, FOCUS, SPAWN, ZONE_ANCHORS } from "../theme";

// 第一人称控制器：帧循环状态机（顺序即优先级）——
//   聚焦进/出检测 → ① 入场前环绕 → ② 入场电影 → ③ 聚焦定格 → ④ 退出回程 → ⑤ 漫游。
// 输入接线在 input.ts；聚焦取景/阻尼在 cameraDirector.ts；听者同步在 audioListener.ts；
// 碰撞/支撑在 walk.ts（纯函数）。此处只剩编排与漫游本体。

const SPEED = 4.3; // 漫游步速
const REACH = 7.0; // 可交互距离：近到这个范围内准心才亮、才能按 ENTER 进入
const AIM_FAR = 24.0; // 准心命中检测距离：更远也先报出对准了什么（远处只提示名字）
const CENTER = new THREE.Vector2(0, 0);
const INTRO_DUR = 5.5; // 入场电影时长（秒）

export default function PlayerControls() {
  const { camera, gl, clock } = useThree();
  const focusZone = useWorld((s) => s.focusZone);

  const feet = useRef(new THREE.Vector3(SPAWN[0], 0, SPAWN[2]));
  const bob = useRef(0);
  const rippleAccum = useRef(0);
  const rayAccum = useRef(0);
  const introStart = useRef<number | null>(null);
  const introDone = useRef(false);
  const introRipple = useRef(false);
  const introFrom = useRef(new THREE.Vector3());
  const hoveredRef = useRef<string | null>(null);
  const reachRef = useRef(false);
  const snapshot = useRef<{ x: number; y: number; z: number; yaw: number; pitch: number } | null>(null);
  const exitActive = useRef(false);
  const exitAccum = useRef(0); // 退出缓动累计时长（超时兜底交还控制）
  const prevFocused = useRef<string | null>(null); // 帧内检测聚焦进/出（消除 effect 竞态）

  // 指针锁定下按主键：准心命中且够得着 → 聚焦该区。
  const { yaw, pitch, keys, joy } = useWalkInput(gl.domElement, () => {
    if (hoveredRef.current && reachRef.current) focusZone(hoveredRef.current);
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const focusGoal = useMemo(() => new THREE.Vector3(), []);
  const focusGoalQ = useMemo(() => new THREE.Quaternion(), []);
  const exitPos = useMemo(() => new THREE.Vector3(), []);
  const exitQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  // 聚焦进/出由帧循环检测调用（不放 effect——effect 晚一帧会让漫游分支先把相机跳回脚步位，
  // 那正是"退出没有动画"的根因）。这里只算好目标位姿/快照，实际缓动在帧里做。
  const beginFocus = useCallback((id: string) => {
    snapshot.current = { x: feet.current.x, y: feet.current.y, z: feet.current.z, yaw: yaw.current, pitch: pitch.current };
    document.exitPointerLock?.();

    // 锚点按 zone.type 解析（id 是用户数据，导入的世界可改名）；查无此区回退持久化 zone.position。
    const zone = useWorld.getState().world.zones.find((z) => z.id === id);
    const f = zone ? FOCUS[zone.type] : undefined;
    const a = zone ? ZONE_ANCHORS[zone.type] : undefined;
    const p = zone?.position;
    center.set(
      f ? f.center[0] : a ? a.position[0] : p ? p[0] : 0,
      f ? f.center[1] : a ? a.position[1] : p ? p[1] : 1.4,
      f ? f.center[2] : a ? a.position[2] : p ? p[2] : 0,
    );
    computeFocusPose(camera as THREE.PerspectiveCamera, center, f ? f.radius : 1.6, focusGoal, focusGoalQ);
    exitActive.current = false;
  }, [camera, center, focusGoal, focusGoalQ, yaw, pitch]);

  const beginExit = useCallback(() => {
    if (!snapshot.current) return;
    exitAccum.current = 0;
    exitActive.current = true;
  }, []);

  useFrame((_state, dtRaw) => {
    // 仅开发期：__freecam 置位时不写相机（供无头验证从任意机位渲染并经后处理）。
    if (import.meta.env.DEV && (window as unknown as { __freecam?: boolean }).__freecam) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = useWorld.getState();

    // ── 聚焦进/出转场：帧内检测（在一切分支之前），消除 effect 晚一帧导致的"直接跳转" ──
    if (s.focusedZoneId !== prevFocused.current) {
      if (s.focusedZoneId) beginFocus(s.focusedZoneId);
      else beginExit();
      prevFocused.current = s.focusedZoneId;
    }

    // ── ① 入场前：缓慢电影感环绕，俯瞰漂在星海上的整座回廊 ──
    if (!s.entered) {
      const t = clock.elapsedTime;
      camera.position.set(Math.sin(t * 0.06) * 3.0, 3.7 + Math.sin(t * 0.12) * 0.2, 10.6 + Math.cos(t * 0.06) * 1.0);
      camera.lookAt(Math.sin(t * 0.06) * 0.5, 0.9, -3.0);
      return;
    }

    // ── ② 入场电影（点「进入」后约 5.5 秒）：从环绕机位缓缓沉到水面眼平，落在出生点，再交还控制 ──
    if (!introDone.current && !s.focusedZoneId) {
      if (introStart.current === null) {
        introStart.current = clock.elapsedTime;
        introFrom.current.copy(camera.position);
      }
      const e = clock.elapsedTime - introStart.current;
      if (e < INTRO_DUR) {
        const x = Math.min(1, e / INTRO_DUR);
        const k = x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
        camera.position.set(
          THREE.MathUtils.lerp(introFrom.current.x, SPAWN[0], k),
          THREE.MathUtils.lerp(introFrom.current.y, EYE, k) + Math.sin(e * 0.6) * 0.04,
          THREE.MathUtils.lerp(introFrom.current.z, SPAWN[2], k),
        );
        camera.lookAt(0, THREE.MathUtils.lerp(1.0, 1.1, k), THREE.MathUtils.lerp(-2.8, -3.6, k));
        // 临近水面时，脚下荡开第一圈涟漪——"原来我站在星海上"。
        if (!introRipple.current && e > INTRO_DUR * 0.6) {
          introRipple.current = true;
          spawnRipple(SPAWN[0], SPAWN[2], clock.elapsedTime, 1.3);
        }
        syncAudioListener(camera);
        return;
      }
      // 收尾：对齐漫游状态到落点，交还控制
      introDone.current = true;
      feet.current.set(SPAWN[0], 0, SPAWN[2]);
      yaw.current = 0;
      pitch.current = -0.04;
    }

    // ── ③ 聚焦某功能区：指数阻尼飞入并定格（目标由 beginFocus 一次算好）──
    if (s.focusedZoneId) {
      dampPose(camera, focusGoal, focusGoalQ, dt);
      syncAudioListener(camera);
      return;
    }

    // ── ④ 退出聚焦：指数阻尼飞回漫游位姿，到位（或超时兜底）再交还控制 ──
    if (exitActive.current && snapshot.current) {
      exitPos.set(snapshot.current.x, snapshot.current.y + EYE, snapshot.current.z);
      tmpEuler.set(snapshot.current.pitch, snapshot.current.yaw, 0);
      exitQ.setFromEuler(tmpEuler);
      dampPose(camera, exitPos, exitQ, dt);
      syncAudioListener(camera);
      exitAccum.current += dt;
      if (camera.position.distanceTo(exitPos) < 0.03 || exitAccum.current > 1.4) {
        feet.current.set(snapshot.current.x, snapshot.current.y, snapshot.current.z);
        yaw.current = snapshot.current.yaw;
        pitch.current = snapshot.current.pitch;
        snapshot.current = null;
        exitActive.current = false;
      }
      return;
    }

    // ── ⑤ 漫游 ──
    const k = keys.current;
    const fIn = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - joy.current.y;
    const sIn = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + joy.current.x;
    const th = yaw.current;
    let mx = -Math.sin(th) * fIn + Math.cos(th) * sIn;
    let mz = -Math.cos(th) * fIn - Math.sin(th) * sIn;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = SPEED * (k.has("ShiftLeft") ? 1.7 : 1);
    const moving = len > 0.001;

    const res = resolveMove(
      feet.current.y,
      feet.current.x,
      feet.current.z,
      feet.current.x + mx * speed * dt,
      feet.current.z + mz * speed * dt,
    );
    // 水平：直接采用求解后的合法落点（不 damp 去"追逐被夹目标"——那种追逐在低帧时会
    // "走进去一半又被拉回"，空气墙弹回感）。每帧位移本就很小，1:1 即顺滑。
    feet.current.x = res.x;
    feet.current.z = res.z;
    feet.current.y = THREE.MathUtils.damp(feet.current.y, res.y, 12, dt); // 高度仍平滑（上下坡道）

    bob.current += moving ? dt * speed * 2.2 : 0;
    const headbob = moving ? Math.sin(bob.current) * 0.02 : 0;

    // 脚步涟漪：走在水面（脚下高度≈0）时，每跨过一步距离就在星海倒影上荡开一圈。
    // 1.2 单位一圈 ≈ 3.6/秒：慢于环形缓冲的覆盖速度，扩散中的环能完整放完（否则看着"抽搐"）。
    if (moving && feet.current.y < 0.18) {
      rippleAccum.current += speed * dt;
      if (rippleAccum.current > 1.2) {
        rippleAccum.current = 0;
        spawnRipple(feet.current.x, feet.current.z, clock.elapsedTime, 0.95);
      }
    }

    // 相机直接坐落在脚步上 —— 转头/俯仰 1:1 即时；走动只受单层脚步阻尼，不发糊。
    camera.position.set(feet.current.x, feet.current.y + EYE + headbob, feet.current.z);
    camera.rotation.set(pitch.current, yaw.current, 0);

    // 准心命中检测 → 悬停提示。节流到 ~11Hz：每帧递归 raycast + zustand 写会带动 HUD 重渲染。
    rayAccum.current += dt;
    if (rayAccum.current >= 0.09) {
      rayAccum.current = 0;
      raycaster.far = AIM_FAR; // 远距离也先命中：好让准心报出"你正看着什么"
      raycaster.setFromCamera(CENTER, camera);
      const hits = interactableObjs.length ? raycaster.intersectObjects(interactableObjs, true) : [];
      const id = hits.length ? zoneIdOf(hits[0].object) : null;
      const inReach = hits.length > 0 && hits[0].distance <= REACH; // 近到可交互距离才算"够得着"
      if (id !== hoveredRef.current || inReach !== reachRef.current) {
        hoveredRef.current = id;
        reachRef.current = inReach;
        s.setHovered(id, inReach);
      }
    }

    syncAudioListener(camera);
  });

  return null;
}
