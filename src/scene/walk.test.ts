import { describe, expect, it } from "vitest";
import { rampHeightAt, resolveMove, supportHeight } from "./walk";
import { DECK, DECK_Y, PEDESTALS, R_COURT, STEPS } from "../theme";

describe("walk · 潮汐图书馆漫游求解", () => {
  it("镜面广场上站在水面（y=0）", () => {
    expect(supportHeight(0, 0, 0)).toBe(0);
    expect(resolveMove(0, 0, 0, 1, 1).y).toBe(0);
  });

  it("走出广场半径被夹回边界", () => {
    const r = resolveMove(0, 0, 0, 100, 0);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(R_COURT + 1e-6);
  });

  it("登台坡道是连续坡：高度按 z 单调（坡脚 0 → 台前缘 DECK_Y）", () => {
    expect(rampHeightAt(STEPS.zBottom)).toBeCloseTo(0, 5);
    expect(rampHeightAt(STEPS.zTop)).toBeCloseTo(DECK_Y, 5);
    // 单调：z 越靠 -Z（台），越高
    const a = rampHeightAt(STEPS.zBottom - 0.4);
    const b = rampHeightAt(STEPS.zBottom - 0.8);
    expect(b).toBeGreaterThan(a);
  });

  it("站在观星台上取台面高度", () => {
    expect(supportHeight(0, -9.5, DECK_Y)).toBeCloseTo(DECK_Y, 5);
  });

  it("浮岛是实体：会把人推开", () => {
    const p = PEDESTALS[1].pos;
    const res = resolveMove(0, p[0], p[2], p[0], p[2]);
    const d = Math.hypot(res.x - p[0], res.z - p[2]);
    expect(d).toBeGreaterThan(PEDESTALS[1].r - 1e-6);
  });

  it("擦碰浮岛：贴面滑行、不穿模、不整帧弹回", () => {
    const [cx, cz] = [PEDESTALS[1].pos[0], PEDESTALS[1].pos[2]];
    let x = 4.5, z = -1.2;
    const dt = 1 / 60, speed = 4.3, dirx = 0.85, dirz = 0.53;
    const step = speed * dt;
    for (let i = 0; i < 160; i++) {
      const r = resolveMove(0, x, z, x + dirx * step, z + dirz * step);
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

  // ── 本轮回归（用户报的真 bug）────────────────────────────────────────────

  it("【1a】走出台面背沿不被瞬移回水圈（修复'空气墙向后瞬移'）", () => {
    // 站在台面深处(0,-10.0,y=DECK_Y)，继续往背沿外推到 -13。应停在背沿(zFar≈-10.8)附近，
    // 而**不是**被径向投影回半径 8 的水圈（那会把 z 从 -10 猛拉到 ≈-8）。
    const r = resolveMove(DECK_Y, 0, -10.0, 0, -13.0);
    expect(r.z).toBeGreaterThanOrEqual(DECK.zFar - 1e-6); // 不越过背沿
    expect(r.z).toBeLessThan(-9.5); // 仍在台面深处，没被拉到 z≈-8 的水圈
    expect(r.y).toBeCloseTo(DECK_Y, 5);
  });

  it("【1a】走出台面侧沿也不被瞬移回水圈", () => {
    const r = resolveMove(DECK_Y, 3.0, -9.0, 6.0, -9.0); // 往 +X 推出侧沿
    expect(r.x).toBeLessThanOrEqual(DECK.x1 + 1e-6); // 停在侧沿
    expect(r.x).toBeGreaterThan(2.5); // 没被拉回水圈中心侧
    expect(r.y).toBeCloseTo(DECK_Y, 5);
  });

  it("【1b】跑步上坡：逐帧抬升不超过门限、绝不整级瞬移、最终登顶", () => {
    let x = 0, z = STEPS.zBottom + 0.15, prevY = 0; // 坡脚附近水面起步
    const dt = 1 / 60, speed = 4.3 * 1.7; // 跑步（最易暴露瞬移）
    for (let i = 0; i < 120; i++) {
      const r = resolveMove(prevY, x, z, x, z - speed * dt); // 持续往 -Z 上坡
      expect(r.y - prevY).toBeLessThanOrEqual(0.42 + 1e-6); // 单帧抬升不超过 MAX_STEP_UP
      x = r.x; z = r.z; prevY = r.y;
    }
    expect(prevY).toBeGreaterThan(DECK_Y * 0.9); // 顺利登顶（没有被门限卡死）
  });

  it("【1b】从侧面撞坡壁（比脚高很多）会被挡住，而不是瞬移上去", () => {
    // 站在坡道侧边的水面(x=2.4>STEPS.x1, z=-7.8 处坡面已高 ~1.3)，往 -X 撞向坡壁。
    const zSide = -7.8;
    const wallH = rampHeightAt(zSide);
    expect(wallH).toBeGreaterThan(1.0); // 该处坡面确实很高
    const r = resolveMove(0, 2.4, zSide, 1.5, zSide); // 从水面横撞坡壁
    expect(r.y).toBeLessThan(0.42 + 1e-6); // 没有被瞬移到坡面高处
    expect(r.x).toBeGreaterThanOrEqual(STEPS.x1 - 1e-6); // 被挡在坡道足迹外侧
  });
});
