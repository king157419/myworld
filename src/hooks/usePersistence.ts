import { useEffect, useState } from "react";
import { useWorld } from "../store/useWorld";
import { flushSave, loadWorld, persistNow, readLastScene } from "../data/db";
import { SCENE_DATA, resolveScene } from "../scenes/registryData";

/**
 * 启动路径：读 meta.lastScene（无则 loft）→ 加载该场景的世界；没有则用该场景的
 * defaultWorld + 种子并落盘一次。返回 ready，避免在水合完成前渲染出"默认世界一闪"。
 */
export function usePersistence(): boolean {
  const [ready, setReady] = useState(false);
  const hydrate = useWorld((s) => s.hydrate);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const style = resolveScene((await readLastScene()) ?? "loft");
        const { world, entries } = await loadWorld(style);
        if (cancelled) return;
        if (world) {
          hydrate(world, entries);
        } else {
          // 该场景从未保存过：注入种子内容并落盘一次。
          const def = SCENE_DATA[style].defaultWorld;
          const seed = SCENE_DATA[style].makeSeed(Date.now());
          hydrate(def, seed);
          await persistNow(def, seed);
        }
        // 本地收件箱：吸收 public/inbox/<scene>.json 里尚未进世界的内容（幂等，缺席即跳过）。
        void useWorld.getState().absorbInbox();
      } catch (err) {
        console.error("[lingjing] 读取本地世界失败，使用默认世界：", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  // 页面隐藏 / 卸载前刷盘：防抖还没触发就离开时，最近的改动不至于丢失。
  useEffect(() => {
    const flush = () => void flushSave();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return ready;
}
