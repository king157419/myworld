import { useEffect, useRef } from "react";
import type * as THREE from "three";

// 可交互物登记表：功能区把自己的可点击根对象登记进来，第一人称控制器用准心
// 射线对这些对象做命中检测（指针锁定下 R3F 的指针事件坐标不可靠，故自做射线）。
export interface Interactable {
  obj: THREE.Object3D;
  zoneId: string;
}

export const interactables: Interactable[] = [];
// 与 interactables 同步维护的稳定对象数组：准心射线每帧直接用它，避免每帧 .map() 分配。
export const interactableObjs: THREE.Object3D[] = [];

export function zoneIdOf(obj: THREE.Object3D | null): string | null {
  let o: THREE.Object3D | null = obj;
  while (o) {
    const id = (o.userData as { zoneId?: string }).zoneId;
    if (id) return id;
    o = o.parent;
  }
  return null;
}

/** 把一个根对象登记为某功能区的可交互入口；卸载时自动注销。 */
export function useInteractable(zoneId: string) {
  const ref = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const o = ref.current;
    if (!o) return;
    o.userData.zoneId = zoneId;
    interactables.push({ obj: o, zoneId });
    interactableObjs.push(o);
    return () => {
      const i = interactables.findIndex((x) => x.obj === o);
      if (i >= 0) interactables.splice(i, 1);
      const j = interactableObjs.indexOf(o);
      if (j >= 0) interactableObjs.splice(j, 1);
    };
  }, [zoneId]);
  return ref;
}
