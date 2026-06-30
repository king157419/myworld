import { useWorld } from "../store/useWorld";

// 参数化房间外壳：地 + 四墙 + 顶，尺寸/配色全读 room 配置。
// 没有任何内容写死——换一份配置就是另一个房间。
export default function Room() {
  const room = useWorld((s) => s.world.room);
  const { w, h, d } = room.dimensions;
  const { base, floor } = room.palette;
  const t = 0.15; // 墙厚

  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floor} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* 天花板 */}
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={base} roughness={1} />
      </mesh>

      {/* 后墙 */}
      <mesh position={[0, h / 2, -d / 2]} receiveShadow>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={base} roughness={0.95} />
      </mesh>

      {/* 左墙 */}
      <mesh position={[-w / 2, h / 2, 0]} receiveShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={base} roughness={0.95} />
      </mesh>

      {/* 右墙 */}
      <mesh position={[w / 2, h / 2, 0]} receiveShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={base} roughness={0.95} />
      </mesh>

      {/* 前面敞开（diorama 式）：相机从房间正前方望入，不设前墙以免挡视线。 */}

      {/* 一块暖色地毯（accent），给"栖居"一点温度 */}
      <mesh position={[0, 0.01, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.5, d * 0.4]} />
        <meshStandardMaterial color={room.palette.accent} roughness={1} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
