import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { useWorld } from "../store/useWorld";

// 第一人称输入接线：鼠标环视（指针锁定）、键盘 WASD/方向键、触屏双区（左移动/右环视）。
// 只负责把 DOM 事件写进 refs，不做任何相机/物理——那些在 PlayerControls 的帧循环里。

const SENS = 0.0022;
const TOUCH_SENS = 0.005;
const PITCH_MAX = 1.18;

export interface WalkInput {
  yaw: RefObject<number>;
  pitch: RefObject<number>;
  keys: RefObject<Set<string>>;
  joy: RefObject<{ x: number; y: number }>;
}

/**
 * 注册输入监听。onPrimary：指针锁定状态下按下主键（"对准心处交互"），由调用方决定做什么。
 * Escape 退出聚焦、点击画布请求指针锁定、触摸摇杆复位都在这里处理。
 */
export function useWalkInput(canvas: HTMLCanvasElement, onPrimary: () => void): WalkInput {
  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const keys = useRef(new Set<string>());
  const joy = useRef({ x: 0, y: 0 });
  const touchPts = useRef(new Map<number, { kind: "move" | "look"; sx: number; sy: number; lx: number; ly: number }>());
  const onPrimaryRef = useRef(onPrimary);
  onPrimaryRef.current = onPrimary;

  useEffect(() => {
    const isLocked = () => document.pointerLockElement === canvas;

    const onMove = (e: MouseEvent) => {
      if (!isLocked()) return;
      yaw.current -= e.movementX * SENS;
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * SENS, -PITCH_MAX, PITCH_MAX);
    };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.code === "Escape" && down) {
        const s = useWorld.getState();
        if (s.focusedZoneId) { s.clearFocus(); return; }
        if (s.telescopeActive) { s.closeTelescope(); return; }
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
      if (s.focusedZoneId || s.telescopeActive) return; // 看记忆/聚焦时不抢指针锁
      if (isLocked()) onPrimaryRef.current();
      else canvas.requestPointerLock?.();
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
  }, [canvas]);

  return { yaw, pitch, keys, joy };
}
