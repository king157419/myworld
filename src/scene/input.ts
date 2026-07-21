import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { useWorld } from "../store/useWorld";

// 第一人称输入接线：鼠标环视（指针锁定）、键盘 WASD/方向键、触屏双区（左移动/右环视）。
// 只负责把 DOM 事件写进 refs，不做任何相机/物理——那些在 PlayerControls 的帧循环里。

const SENS = 0.0022;
const TOUCH_SENS = 0.005;
const PITCH_MAX = 1.18;

/**
 * 退出聚焦/望远镜的飞回动画进行中（PlayerControls 写、这里读）。
 * 此窗口内 focusedZoneId/telescopeActive 已被 store 清掉，若不拦，点击画布会立刻抢回指针锁、
 * 鼠标输入开始改写 yaw/pitch，而飞回收尾会用快照值覆盖——交还控制那帧视线跳向意外方向。
 */
export const camExitGate = { active: false };

/** 事件来源是可编辑元素（输入框/文本域/下拉/富文本）——字母键属于打字，不属于走路。 */
function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

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
      // IME 合成中的 Esc 是"取消候选词"，不是"关面板"——不查 isComposing 会把拼音打到一半的
      // 面板整个关掉、草稿全丢（keyCode 229 兜底不设 isComposing 的旧式输入法）。
      if (e.code === "Escape" && down && !e.isComposing && e.keyCode !== 229) {
        const s = useWorld.getState();
        if (s.focusedZoneId) {
          // 有未保存草稿：先确认再关（editorDirty 由 useEntryForm 上报）。
          if (s.editorDirty && !window.confirm("有未保存的内容，确定离开吗？")) return;
          s.clearFocus();
          return;
        }
        if (s.telescopeActive) { s.closeTelescope(); return; }
      }
      // 焦点在文本输入元素里：字母键属于打字，不进全局按键集（在 textarea 里敲 wasd ≠ 走路）。
      // keyup 仍然放行删除——按着键把焦点移进输入框再松开，不能让按键卡在集合里。
      if (down && isEditable(e.target)) return;
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
      if (camExitGate.active) return; // 退出飞回动画中：不抢锁不交互（收尾会程序化回锁）
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
