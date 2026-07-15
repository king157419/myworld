import { useWorld } from "../store/useWorld";
import { TELESCOPE_ID } from "../theme";

// 漫游准心 + 悬停标签：对准功能区时报名字，进入可交互距离时亮起并提示 ENTER。
export default function Reticle() {
  const hoveredZoneId = useWorld((s) => s.hoveredZoneId);
  const hoveredInReach = useWorld((s) => s.hoveredInReach);
  // 望远镜是舞台件（非 zone），标签特判；其余按 world.zones 取。
  const hoveredLabel = useWorld((s) =>
    s.hoveredZoneId === TELESCOPE_ID ? "望远镜 · 看记忆" : s.world.zones.find((z) => z.id === s.hoveredZoneId)?.label,
  );

  return (
    <div className="crosshair-wrap" aria-hidden>
      <div className={`crosshair${hoveredZoneId ? (hoveredInReach ? " active" : " spotted") : ""}`} />
      {/* 左右刻度（CSS 伪元素需要一个实体节点做参照）*/}
      <span className="ch-tick-lr" />
      {hoveredLabel && (
        <div className={`reticle-label${hoveredInReach ? "" : " far"}`}>
          <span className="rl-zone">{hoveredLabel}</span>
          <span className="rl-hint">{hoveredInReach ? "ENTER" : "走近"}</span>
        </div>
      )}
    </div>
  );
}
