import { useWorld } from "../../store/useWorld";
import PlaceholderZone from "../PlaceholderZone";
import { COURT } from "./data";

// 雾中山居占位舞台：平地 + 后墙门洞示意 + 三个数据驱动 zone 占位物 + 晨雾柔光。
// 几何全是原语，只求"能进、能走、能看清、平地 + 门洞"；正式成品后续轮替换。

const WALL_LEN = COURT.wall.z1 - COURT.wall.z0; // 12
const SIDE_W = (COURT.wall.x1 - COURT.door.half); // 后墙门洞旁每侧墙宽的一半跨度

export default function CourtyardStage(_props: { low: boolean }) {
  const zones = useWorld((s) => s.world.zones);
  const back = COURT.wall.z0;
  return (
    <>
      <color attach="background" args={["#aeb7b2"]} />
      {/* 晨雾：山居的"雾"。标准材质吃雾（地面/墙），天空是纯色背景不受影响 */}
      <fogExp2 attach="fog" args={["#c2ccc6", 0.05]} />

      {/* 光：清晨漫射，够看清 */}
      <ambientLight intensity={0.7} color="#c8d0cc" />
      <hemisphereLight args={["#dfe6e2", "#4a5048", 0.8]} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} color="#f0efe6" castShadow />

      {/* 平地 */}
      <mesh position={[0, -0.05, 0]} rotation={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[COURT.wall.x1 - COURT.wall.x0, 0.1, WALL_LEN]} />
        <meshStandardMaterial color="#3a4038" roughness={0.95} />
      </mesh>

      {/* 后墙 + 门洞：门洞两侧各一段墙 + 上方门楣，中间留空可穿过 */}
      <mesh position={[-(COURT.door.half + SIDE_W / 2), 1.3, back]} receiveShadow>
        <boxGeometry args={[SIDE_W, 2.6, 0.2]} />
        <meshStandardMaterial color="#4a504a" roughness={0.9} />
      </mesh>
      <mesh position={[COURT.door.half + SIDE_W / 2, 1.3, back]} receiveShadow>
        <boxGeometry args={[SIDE_W, 2.6, 0.2]} />
        <meshStandardMaterial color="#4a504a" roughness={0.9} />
      </mesh>
      {/* 门楣 */}
      <mesh position={[0, COURT.door.height + 0.15, back]}>
        <boxGeometry args={[COURT.door.half * 2 + 0.2, 0.3, 0.24]} />
        <meshStandardMaterial color="#5a5248" roughness={0.85} />
      </mesh>
      {/* 门洞两侧立柱（与 walk 碰撞一致） */}
      <mesh position={[-COURT.door.half, 1.3, back + 0.05]} castShadow>
        <boxGeometry args={[0.28, 2.6, 0.28]} />
        <meshStandardMaterial color="#52493f" roughness={0.85} />
      </mesh>
      <mesh position={[COURT.door.half, 1.3, back + 0.05]} castShadow>
        <boxGeometry args={[0.28, 2.6, 0.28]} />
        <meshStandardMaterial color="#52493f" roughness={0.85} />
      </mesh>

      {/* 两侧矮墙（廊下感） */}
      <mesh position={[COURT.wall.x0, 0.6, 0]} receiveShadow>
        <boxGeometry args={[0.2, 1.2, WALL_LEN]} />
        <meshStandardMaterial color="#454b45" roughness={0.9} />
      </mesh>
      <mesh position={[COURT.wall.x1, 0.6, 0]} receiveShadow>
        <boxGeometry args={[0.2, 1.2, WALL_LEN]} />
        <meshStandardMaterial color="#454b45" roughness={0.9} />
      </mesh>

      {/* 三个 zone 占位物（数据驱动） */}
      {zones.map((zone) => (
        <PlaceholderZone key={zone.id} zone={zone} />
      ))}
    </>
  );
}
