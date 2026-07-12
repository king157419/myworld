import type { Entry, WorldConfig } from "../config/types";
import { ImportError, parseEntryBatch } from "./io";

// 本地收件箱：public/inbox/<scene>.json 里的内容批会在进入该场景时被吸收进世界。
// 用途：把外部整理好的私人内容（如日记）灌进世界，而不把它写进仓库——
// inbox 目录在 .gitignore 里，属于"用户数据"一侧；吸收后真相在 IndexedDB，
// 文件只是入口（重复吸收靠 id 幂等去重）。文件缺席（404）是常态，静默跳过。

/**
 * 拉取当前场景的收件箱，返回"尚未在世界里"的新内容（按 id 去重）。
 * 没有收件箱 / 网络失败 / 校验失败一律返回空数组——收件箱绝不打断启动路径。
 */
export async function fetchInboxAdditions(world: WorldConfig, existing: Entry[]): Promise<Entry[]> {
  const style = world.room.style;
  let text: string;
  try {
    const res = await fetch(`/inbox/${style}.json`, { cache: "no-cache" });
    if (!res.ok) return [];
    text = await res.text();
  } catch {
    return [];
  }
  try {
    const zoneIds = new Set(world.zones.map((z) => z.id));
    const batch = parseEntryBatch(text, zoneIds);
    const have = new Set(existing.map((e) => e.id));
    return batch.filter((e) => !have.has(e.id));
  } catch (err) {
    if (err instanceof ImportError) {
      console.warn(`[lingjing] 收件箱 inbox/${style}.json 校验失败，已忽略：`, err.message);
      return [];
    }
    throw err;
  }
}
