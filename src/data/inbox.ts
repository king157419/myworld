import type { Entry, WorldConfig } from "../config/types";
import { ImportError, parseEntryBatch } from "./io";

// 本地收件箱：public/inbox/<scene>.json 里的内容批会在进入该场景时被吸收进世界。
// 用途：把外部整理好的私人内容（如日记）灌进世界，而不把它写进仓库——
// inbox 目录在 .gitignore 里，属于"用户数据"一侧；吸收后真相在 IndexedDB，
// 文件只是入口（重复吸收靠 id 幂等去重）。文件缺席（404）是常态，静默跳过。

/**
 * 拉取当前场景的收件箱，返回"尚未在世界里"的新内容（按 id 去重）。
 * 没有收件箱 / 网络失败 / 校验失败一律返回空数组——收件箱绝不打断启动路径。
 *
 * 线上演示回退：私人收件箱 404（Vercel 上必然如此——public/inbox/ 在 gitignore 里，
 * 部署走 GitHub 构建，线上永远没有真日记）且是生产构建时，再试 public/inbox-sample/
 * （入库的**非私人**演示内容），让线上来客的望远镜里也有东西可看。
 * 本地 dev 永不回退——避免把演示条目灌进主人自己的世界。
 */
export async function fetchInboxAdditions(world: WorldConfig, existing: Entry[]): Promise<Entry[]> {
  const style = world.room.style;
  // "文件在吗"不能只看状态码：dev server / SPA 回退会把缺席路径答成 200 的 index.html。
  // 按 content-type 判 JSON——非 JSON 一律视同缺席（也顺带消掉缺席场景的"校验失败"噪音）。
  const missing = (r: Response) => !r.ok || !(r.headers.get("content-type") ?? "").includes("json");
  let text: string;
  try {
    let res = await fetch(`/inbox/${style}.json`, { cache: "no-cache" });
    if (missing(res) && import.meta.env.PROD) {
      res = await fetch(`/inbox-sample/${style}.json`, { cache: "no-cache" });
    }
    if (missing(res)) return [];
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
