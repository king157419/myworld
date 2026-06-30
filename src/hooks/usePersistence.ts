import { useEffect, useState } from "react";
import { useWorld } from "../store/useWorld";
import { flushSave, loadWorld, persistNow } from "../data/db";
import { defaultWorld } from "../config/defaultWorld";
import { makeSeed } from "../data/seed";

/**
 * 启动路径：从 IndexedDB 读出世界；没有则用 defaultWorld（store 初值）。
 * 返回 ready，避免在水合完成前渲染出"默认世界一闪"。
 */
export function usePersistence(): boolean {
  const [ready, setReady] = useState(false);
  const hydrate = useWorld((s) => s.hydrate);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { world, entries } = await loadWorld();
        if (cancelled) return;
        if (world) {
          hydrate(world, entries);
        } else {
          // 世界从未保存过：注入"已住很久"的种子内容并落盘一次。
          const seed = makeSeed(Date.now());
          hydrate(defaultWorld, seed);
          await persistNow(defaultWorld, seed);
        }
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
