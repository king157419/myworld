import { describe, expect, it } from "vitest";
import { resolveMove, supportHeight } from "./walk";
import { DECK_Y, PEDESTALS, R_COURT, STEPS } from "../theme";

describe("walk · 潮汐图书馆漫游求解", () => {
  it("镜面广场上站在水面（y=0）", () => {
    expect(supportHeight(0, 0, 0)).toBe(0);
    expect(resolveMove(0, 0, 0, 1, 1).y).toBe(0);
  });

  it("走出广场半径被夹回边界", () => {
    const r = resolveMove(0, 0, 0, 100, 0);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(R_COURT + 1e-6);
  });

  it("踏上木梯逐级抬升", () => {
    const low = supportHeight(0, STEPS.zBottom - 0.01, 0.2);
    const high = supportHeight(0, STEPS.zTop + 0.01, DECK_Y);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(DECK_Y + 1e-6);
  });

  it("站在观星台上取台面高度（同 xz 因 currentY 不同而不同）", () => {
    const onDeck = supportHeight(0, -9.5, DECK_Y);
    expect(onDeck).toBeCloseTo(DECK_Y, 5);
  });

  it("浮岛是实体：会把人推开", () => {
    const p = PEDESTALS[1].pos;
    const res = resolveMove(0, p[0], p[2], p[0], p[2]);
    const d = Math.hypot(res.x - p[0], res.z - p[2]);
    expect(d).toBeGreaterThan(PEDESTALS[1].r - 1e-6);
  });

  it("擦碰浮岛：贴面滑行、不穿模、不整帧弹回", () => {
    // 与 PlayerControls 同模型：feet = 求解后的合法落点（不 damp）。
    // 斜向擦过浮岛(6.3,0)，逐帧推进。要求：①始终在障碍外（不穿模）②单帧不大幅倒退（不"弹回"）。
    const [cx, cz] = [PEDESTALS[1].pos[0], PEDESTALS[1].pos[2]];
    let x = 4.5, z = -1.2;
    const dt = 1 / 60, speed = 4.3, dirx = 0.85, dirz = 0.53;
    const step = speed * dt;
    for (let i = 0; i < 160; i++) {
      const r = resolveMove(0, x, z, x + dirx * step, z + dirz * step);
      // 单帧位移不应超过名义步长太多（滑行只会更短；大幅反向=弹回）
      const moved = Math.hypot(r.x - x, r.z - z);
      expect(moved).toBeLessThan(step * 1.5);
      x = r.x; z = r.z;
      expect(Math.hypot(x - cx, z - cz)).toBeGreaterThan(PEDESTALS[1].r + 0.32 - 0.03);
    }
  });

  it("不会无端抬高：广场中央始终 y=0", () => {
    expect(resolveMove(0, 0, 0, 0, 0).y).toBe(0);
    expect(resolveMove(0, 3, -3, 3, -3).y).toBe(0);
  });
});
