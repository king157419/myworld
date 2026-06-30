import type { Zone, ZoneType } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import Bookshelf from "./Bookshelf";
import ObjectMuseum from "./ObjectMuseum";
import RecordPlayer from "./RecordPlayer";

// 把 world.zones 画出来：按 type 分发"舞台"（书架/陈列柜/唱片机的几何由 type 决定），
// 但每个区把它渲染的 zone 传下去——内容过滤 / 聚焦 / 登记一律用 zone.id，
// 这样导入/AI 改名的世界（type 不变、id 改了）仍能正确显示并可编辑其内容。
const BODY: Record<ZoneType, (p: { zone: Zone }) => React.JSX.Element> = {
  bookshelf: Bookshelf,
  objects: ObjectMuseum,
  record: RecordPlayer,
};

export default function Zones() {
  const zones = useWorld((s) => s.world.zones);
  return (
    <>
      {zones.map((zone) => {
        const Body = BODY[zone.type];
        return Body ? <Body key={zone.id} zone={zone} /> : null;
      })}
    </>
  );
}
