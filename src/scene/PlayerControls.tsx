import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store/useWorld";
import { audioEngine } from "../audio/engine";
import { resolveMove } from "./walk";
import { interactableObjs, zoneIdOf } from "./interactables";
import { spawnRipple } from "./ripples";
import { EYE, SPAWN, ZONE_ANCHORS } from "../theme";

const SPEED = 4.3; // 漫游步速（之前 3.0 偏慢）
const SENS = 0.0022;
const TOUCH_SENS = 0.005;
const PITCH_MAX = 1.18;
const REACH = 7.0; // 可交互距离：近到这个范围内准心才亮、才能按 ENTER 进入
const AIM_FAR = 24.0; // 准心命中检测距离：更远也先报出对准了什么（远处只提示名字）
const EXIT_DUR = 0.55; // 退出聚焦时，从聚焦机位平滑飞回漫游位姿的时长（秒）
const CENTER = new THREE.Vector2(0, 0);

type AnchorId = keyof typeof ZONE_ANCHORS;

export default function PlayerControls() {
  const { camera, gl, clock } = useThree();
  const focusZone = useWorld((s) => s.focusZone);
  const clearFocus = useWorld((s) => s.clearFocus);
  const setHovered = useWorld((s) => s.setHovered);

  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const feet = useRef(new THREE.Vector3(SPAWN[0], 0, SPAWN[2]));
  const keys = useRef(new Set<string>());
  const joy = useRef({ x: 0, y: 0 });
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
  const exitT0 = useRef(0);
  const touchPts = useRef(new Map<number, { kind: "move" | "look"; sx: number; sy: number; lx: number; ly: number }>());

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpUp = useMemo(() => new THREE.Vector3(), []);
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const exitFrom = useMemo(() => new THREE.Vector3(), []);
  const exitFromQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  // ── 输入 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    const isLocked = () => document.pointerLockElement === canvas;

    const onMove = (e: MouseEvent) => {
      if (!isLocked()) return;
      yaw.current -= e.movementX * SENS;
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * SENS, -PITCH_MAX, PITCH_MAX);
    };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.code === "Escape" && down && useWorld.getState().focusedZoneId) {
        clearFocus();
        return;
      }
      if (down) keys.current.add(e.code);
      else keys.current.delete(e.code);
    };
    const kd = onKey(true);
    const ku = onKey(false);

    const onDown = (e: PointerEvent) => {
      const s = useWorld.getState();
      if (!s.entered) return;
      if (e.pointerType === "touch") {
        const left = e.clientX < window.innerWidth * 0.42;
        touchPts.current.set(e.pointerId, {
          kind: left && !s.focusedZoneId ? "move" : "look",
          sx: e.clientX,
          sy: e.clientY,
          lx: e.clientX,
          ly: e.clientY,
        });
        return;
      }
      if (s.focusedZoneId) return;
      if (isLocked()) {
        if (hoveredRef.current && reachRef.current) focusZone(hoveredRef.current); // 准心命中且够得着 → 聚焦
      } else {
        canvas.requestPointerLock?.();
      }
    };
    const onTouchMove = (e: PointerEvent) => {
      const t = touchPts.current.get(e.pointerId);
      if (!t) return;
      if (t.kind === "move") {
        joy.current.x = THREE.MathUtils.clamp((e.clientX - t.sx) / 64, -1, 1);
        joy.current.y = THREE.MathUtils.clamp((e.clientY - t.sy) / 64, -1, 1);
      } else {
        yaw.current -= (e.clientX - t.lx) * TOUCH_SENS;
        pitch.current = THREE.MathUtils.clamp(pitch.current - (e.clientY - t.ly) * TOUCH_SENS, -PITCH_MAX, PITCH_MAX);
        t.lx = e.clientX;
        t.ly = e.clientY;
      }
    };
    const onUp = (e: PointerEvent) => {
      const t = touchPts.current.get(e.pointerId);
      if (t?.kind === "move") joy.current = { x: 0, y: 0 };
      touchPts.current.delete(e.pointerId);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("keydown", kd);
    document.addEventListener("keyup", ku);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onTouchMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp); // 手势被系统/浏览器接管时也复位摇杆，避免"无触摸却一直走"
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("keydown", kd);
      document.removeEventListener("keyup", ku);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onTouchMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera, focusZone, clearFocus]);

  // 聚焦进出：进入时快照漫游位姿并解锁指针；退出时不再瞬切——从当前聚焦机位平滑飞回漫游位姿。
  const focusedZoneId = useWorld((s) => s.focusedZoneId);
  useEffect(() => {
    if (focusedZoneId) {
      snapshot.current = { x: feet.current.x, y: feet.current.y, z: feet.current.z, yaw: yaw.current, pitch: pitch.current };
      document.exitPointerLock?.();
      exitActive.current = false; // 进入时取消任何未完成的回程过渡
    } else if (snapshot.current) {
      // 退出：记下当前（聚焦）机位作为过渡起点，开始回程缓动。snapshot 保留到过渡结束才写回。
      exitFrom.copy(camera.position);
      exitFromQ.copy(camera.quaternion);
      exitT0.current = clock.elapsedTime;
      exitActive.current = true;
    }
  }, [focusedZoneId, camera, clock, exitFrom, exitFromQ]);

  useFrame((_state, dtRaw) => {
    // 仅开发期：__freecam 置位时不写相机（供无头验证从任意机位渲染并经后处理）。
    if (import.meta.env.DEV && (window as unknown as { __freecam?: boolean }).__freecam) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = useWorld.getState();

    // ── 入场前：缓慢电影感环绕 ──
    if (!s.entered) {
      const t = clock.elapsedTime;
      // 入场前：从高处缓缓环绕，俯瞰漂在星海上的整座回廊（之后点「进入」会沉到水面眼平）。
      camera.position.set(Math.sin(t * 0.06) * 3.0, 3.7 + Math.sin(t * 0.12) * 0.2, 10.6 + Math.cos(t * 0.06) * 1.0);
      camera.lookAt(Math.sin(t * 0.06) * 0.5, 0.9, -3.0);
      return;
    }

    // ── 入场电影（点「进入」后约 5.5 秒）：从环绕机位缓缓沉到水面眼平，落在出生点，再交还控制。 ──
    const INTRO_DUR = 5.5;
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
        camera.getWorldDirection(tmpDir);
        tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        audioEngine.setListener(
          [camera.position.x, camera.position.y, camera.position.z],
          [tmpDir.x, tmpDir.y, tmpDir.z],
          [tmpUp.x, tmpUp.y, tmpUp.z],
        );
        return;
      }
      // 收尾：对齐漫游状态到落点，交还控制
      introDone.current = true;
      feet.current.set(SPAWN[0], 0, SPAWN[2]);
      yaw.current = 0;
      pitch.current = -0.04;
    }

    // ── 聚焦某功能区：平滑飞入并环视 ──
    if (s.focusedZoneId) {
      const a = ZONE_ANCHORS[s.focusedZoneId as AnchorId];
      const zone = s.world.zones.find((z) => z.id === s.focusedZoneId);
      const cx = a ? a.position[0] : zone?.position[0] ?? 0;
      const cy = a ? a.position[1] : zone?.position[1] ?? 1.4;
      const cz = a ? a.position[2] : zone?.position[2] ?? 0;
      const ry = a ? a.ry : zone?.rotation?.[1] ?? 0;
      center.set(cx, cy, cz);
      const dist = 2.85;
      tmpTarget.set(cx + Math.sin(ry) * dist, cy + 0.28, cz + Math.cos(ry) * dist);
      camera.position.lerp(tmpTarget, 1 - Math.exp(-5 * dt));
      tmpObj.position.copy(camera.position);
      tmpObj.lookAt(center);
      camera.quaternion.slerp(tmpObj.quaternion, 1 - Math.exp(-6 * dt));
      syncListener();
      return;
    }

    // ── 退出聚焦的回程过渡：从聚焦机位平滑飞回漫游位姿，到位再交还控制（消除"直接跳转"）──
    if (exitActive.current && snapshot.current) {
      const e = clock.elapsedTime - exitT0.current;
      const x = Math.min(1, e / EXIT_DUR);
      const kk = x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
      tmpPos.set(snapshot.current.x, snapshot.current.y + EYE, snapshot.current.z);
      tmpEuler.set(snapshot.current.pitch, snapshot.current.yaw, 0);
      tmpQ.setFromEuler(tmpEuler);
      camera.position.lerpVectors(exitFrom, tmpPos, kk);
      camera.quaternion.slerpQuaternions(exitFromQ, tmpQ, kk);
      syncListener();
      if (x >= 1) {
        feet.current.set(snapshot.current.x, snapshot.current.y, snapshot.current.z);
        yaw.current = snapshot.current.yaw;
        pitch.current = snapshot.current.pitch;
        snapshot.current = null;
        exitActive.current = false;
      }
      return;
    }

    // ── 漫游 ──
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
    // 水平：直接采用求解后的合法落点（不再 damp 去"追逐被夹目标"）——
    // 那种追逐在低帧时会"走进去一半又被拉回"（空气墙弹回感）。每帧位移本就很小，1:1 即顺滑。
    feet.current.x = res.x;
    feet.current.z = res.z;
    feet.current.y = THREE.MathUtils.damp(feet.current.y, res.y, 12, dt); // 高度仍平滑（上下台阶）

    bob.current += moving ? dt * speed * 2.2 : 0;
    const headbob = moving ? Math.sin(bob.current) * 0.02 : 0;

    // 脚步涟漪：走在水面（脚下高度≈0）时，每跨过一步距离就在星海倒影上荡开一圈。
    if (moving && feet.current.y < 0.18) {
      rippleAccum.current += speed * dt;
      if (rippleAccum.current > 0.5) {
        rippleAccum.current = 0;
        spawnRipple(feet.current.x, feet.current.z, clock.elapsedTime, 0.95);
      }
    }

    // 相机直接坐落在脚步上 —— 转头/俯仰 1:1 即时；走动只受单层脚步阻尼，不发糊。
    camera.position.set(feet.current.x, feet.current.y + EYE + headbob, feet.current.z);
    camera.rotation.set(pitch.current, yaw.current, 0);

    // 准心命中检测 → 悬停提示。节流到 ~11Hz：每帧做递归 raycast + 触发 zustand 写会带动 HUD 重渲染，是走动微卡的来源之一。
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
        setHovered(id, inReach);
      }
    }

    syncListener();

    function syncListener() {
      camera.getWorldDirection(tmpDir);
      tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion); // 随相机俯仰的真实 up，保持与 forward 正交
      audioEngine.setListener(
        [camera.position.x, camera.position.y, camera.position.z],
        [tmpDir.x, tmpDir.y, tmpDir.z],
        [tmpUp.x, tmpUp.y, tmpUp.z],
      );
    }
  });

  return null;
}
