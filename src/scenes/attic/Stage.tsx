import { useWorld } from "../../store/useWorld";
import PlaceholderZone from "../PlaceholderZone";
import { ATTIC, YUP } from "./data";

// 雨夜阁楼占位舞台：两层地面 + 连通坡道 + 简单围墙 + 三个数据驱动 zone 占位物 + 暖灯。
// 几何全是原语（盒子），只求"能进、能走、能看清、两层可上下"；正式成品后续轮替换。

// 坡道：从下层前缘 (z=0,y=0) 升到上层前缘 (z=-2.5,y=YUP)。
const RAMP_ANGLE = Math.atan2(YUP, ATTIC.ramp.zLower - ATTIC.ramp.zUpper); // ≈0.495rad
const RAMP_LEN = Math.hypot(ATTIC.ramp.zLower - ATTIC.ramp.zUpper, YUP); // ≈2.84
const RAMP_CX = 0;
const RAMP_CY = YUP / 2;
const RAMP_CZ = (ATTIC.ramp.zLower + ATTIC.ramp.zUpper) / 2;

export default function AtticStage(_props: { low: boolean }) {
  const zones = useWorld((s) => s.world.zones);
  return (
    <>
      <color attach="background" args={["#0a0d16"]} />

      {/* 光：暖的室内 + 冷的天窗雨光，够看清 */}
      <ambientLight intensity={0.42} color="#3a4056" />
      <hemisphereLight args={["#4a5470", "#15100a", 0.5]} />
      <pointLight position={[0, 2.6, 1.2]} color="#ffb257" intensity={7} distance={13} decay={2} castShadow />
      <directionalLight position={[2.5, 5, -3]} intensity={0.5} color="#8fa4c8" castShadow />

      {/* 下层地面 z∈[0,6] */}
      <mesh position={[0, -0.05, (ATTIC.lower.zNear + ATTIC.lower.zFar) / 2]} receiveShadow>
        <boxGeometry args={[10, 0.1, ATTIC.lower.zNear - ATTIC.lower.zFar]} />
        <meshStandardMaterial color="#2a2018" roughness={0.9} />
      </mesh>

      {/* 上层平台 z∈[-6,-2.5]（抬高 YUP） */}
      <mesh position={[0, YUP - 0.05, (ATTIC.upper.zNear + ATTIC.upper.zFar) / 2]} receiveShadow castShadow>
        <boxGeometry args={[10, 0.1, ATTIC.upper.zNear - ATTIC.upper.zFar]} />
        <meshStandardMaterial color="#31251a" roughness={0.9} />
      </mesh>

      {/* 连通坡道（斜盒子） */}
      <mesh position={[RAMP_CX, RAMP_CY, RAMP_CZ]} rotation={[RAMP_ANGLE, 0, 0]} receiveShadow>
        <boxGeometry args={[4, 0.12, RAMP_LEN]} />
        <meshStandardMaterial color="#3a2c1c" roughness={0.85} />
      </mesh>

      {/* 简单围墙（后墙 + 两侧墙），给阁楼一点包裹感 */}
      <mesh position={[0, YUP + 1.1, ATTIC.wall.z0]} receiveShadow>
        <boxGeometry args={[10, 2.4, 0.15]} />
        <meshStandardMaterial color="#201811" roughness={0.95} />
      </mesh>
      <mesh position={[ATTIC.wall.x0, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.15, 3.2, 12]} />
        <meshStandardMaterial color="#221a12" roughness={0.95} />
      </mesh>
      <mesh position={[ATTIC.wall.x1, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.15, 3.2, 12]} />
        <meshStandardMaterial color="#221a12" roughness={0.95} />
      </mesh>

      {/* 三个 zone 占位物（数据驱动：书脊/陈列/唱片数量随 entries 变） */}
      {zones.map((zone) => (
        <PlaceholderZone key={zone.id} zone={zone} />
      ))}
    </>
  );
}
