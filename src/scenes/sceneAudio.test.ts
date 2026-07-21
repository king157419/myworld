/// <reference types="node" />
// ↑ 仅本文件引入 node 类型：tsconfig.app 面向浏览器（types 只有 vite/client），
//   而这份测试要用 fs 查"曲目文件真实在盘上"。不把 node 类型污染进整个 app 面。
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SCENE_DATA, SCENE_ORDER } from "./registryData";
import { parseEntryBatch } from "../data/io";

// 场景音频档的结构不变量 + 曲目文件真实在盘上。
// 引擎对坏轨的态度是"跳过并静默"（不打断体验）——这意味着拼错文件名不会在运行时炸，
// 只会让某首歌永远放不出来。这里把它变成测试期的硬失败。

const PUB = join(import.meta.dirname, "..", "..", "public");

describe("场景音频档", () => {
  it("每个场景都有完整音频档（水床/曲库/锚点），数值在合理域", () => {
    for (const style of SCENE_ORDER) {
      const a = SCENE_DATA[style].audio;
      expect(a, `${style} 缺音频档`).toBeTruthy();
      expect(a.waterGain).toBeGreaterThanOrEqual(0);
      expect(a.waterGain).toBeLessThanOrEqual(1);
      expect(a.tracks.length, `${style} 曲库为空`).toBeGreaterThan(0);
      expect(a.musicPos).toHaveLength(3);
      if (a.musicGain !== undefined) {
        expect(a.musicGain).toBeGreaterThan(0);
        expect(a.musicGain).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("曲库无重复 id，曲目文件真实存在于 public/audio/", () => {
    for (const style of SCENE_ORDER) {
      const tracks = SCENE_DATA[style].audio.tracks;
      const ids = new Set(tracks.map((t) => t.id));
      expect(ids.size, `${style} 曲库有重复 id`).toBe(tracks.length);
      for (const t of tracks) {
        const p = join(PUB, "audio", t.file);
        expect(existsSync(p), `${style} 曲目文件缺席：public/audio/${t.file}`).toBe(true);
      }
    }
  });

  it("只有 loft 是有水场景 → 只有它的水床增益 > 0", () => {
    for (const style of SCENE_ORDER) {
      const sd = SCENE_DATA[style];
      if (sd.water) expect(sd.audio.waterGain).toBeGreaterThan(0);
      else expect(sd.audio.waterGain).toBe(0);
    }
  });
});

describe("线上演示收件箱", () => {
  it("public/inbox-sample/loft.json 能过 parseEntryBatch 守门（zoneId 指向 loft 真实功能区）", () => {
    const text = readFileSync(join(PUB, "inbox-sample", "loft.json"), "utf-8");
    const zoneIds = new Set(SCENE_DATA.loft.defaultWorld.zones.map((z) => z.id));
    const entries = parseEntryBatch(text, zoneIds);
    expect(entries.length).toBeGreaterThan(0);
    // 演示条目一律 sample- 前缀：与真实日记/种子的 id 空间隔离，幂等吸收不撞车。
    for (const e of entries) expect(e.id.startsWith("sample-")).toBe(true);
    // 时间戳刻意拉开（望远镜潮汐纪元要有层次）：最早与最晚差至少 30 天。
    const ts = entries.map((e) => e.createdAt);
    expect(Math.max(...ts) - Math.min(...ts)).toBeGreaterThan(30 * 24 * 3600 * 1000);
  });
});
