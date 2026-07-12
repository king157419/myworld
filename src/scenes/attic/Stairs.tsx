import { useMemo } from "react";
import { ATTIC, Y_ATTIC } from "./data";
import { ATTIC_PALETTE, beamMat, brassMat, woodWarmMat } from "./materials";
import { Sconce } from "./lamps";

// 木楼梯：连续线性坡（碰撞）之上贴合的实体踏步。碰撞用 data.atticFloorY 的平滑坡，
// 视觉踏步逐级贴着坡线升起（对齐 loft Deck 的"坡 + 踏条"先例）。共 12 级——印记里
// "第七级楼梯会响"，所以踏步数 ≥7 且能数得出第七级。楼梯间墙上一盏壁灯。

const N = 12;

export default function Stairs() {
  const { x0, x1, zBot, zTop } = ATTIC.stair;
  const rise = Y_ATTIC / N;
  const treadDz = (zBot - zTop) / N; // 每级进深（z 正方向长度）
  const w = x1 - x0 - 0.16;

  const steps = useMemo(() => {
    const out: { y: number; z: number; h: number }[] = [];
    for (let i = 0; i < N; i++) {
      const top = (i + 1) * rise;
      const zc = zBot - (i + 0.5) * treadDz;
      out.push({ y: top / 2, z: zc, h: top }); // 每级：本 z 切片内从 0 实心到本级顶（阶梯状实体）
    }
    return out;
  }, [rise, treadDz, zBot]);

  // 扶手：+X 一侧，沿坡的斜手条 + 几根立柱。
  const railAngle = Math.atan2(Y_ATTIC, zBot - zTop);
  const railLen = Math.hypot(zBot - zTop, Y_ATTIC);

  return (
    <group>
      {steps.map((s, i) => (
        <group key={i}>
          {/* 阶体（实心，暗木） */}
          <mesh position={[0, s.y, s.z]} receiveShadow material={beamMat}>
            <boxGeometry args={[w, s.h, treadDz]} />
          </mesh>
          {/* 踏面（暖木，接灯光；略出挑成鼻边） */}
          <mesh position={[0, s.h + 0.005, s.z + 0.02]} receiveShadow material={woodWarmMat}>
            <boxGeometry args={[w + 0.04, 0.05, treadDz + 0.06]} />
          </mesh>
        </group>
      ))}

      {/* 扶手（+X 侧）：斜手条 + 立柱 */}
      <group>
        <mesh
          position={[x1 - 0.12, Y_ATTIC / 2 + 0.9, (zBot + zTop) / 2]}
          rotation={[railAngle, 0, 0]}
          material={brassMat}
          castShadow
        >
          <cylinderGeometry args={[0.028, 0.028, railLen, 12]} />
        </mesh>
        {Array.from({ length: 4 }).map((_, i) => {
          const t = (i + 0.5) / 4;
          const z = zBot - t * (zBot - zTop);
          const yFloor = t * Y_ATTIC;
          return (
            <mesh key={i} position={[x1 - 0.12, yFloor + 0.45, z]} material={brassMat} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.9, 10]} />
            </mesh>
          );
        })}
      </group>

      {/* 楼梯间壁灯（墙 x1 一侧，半坡高度）：给上楼一路暖引 */}
      <Sconce position={[x1 - 0.09, Y_ATTIC * 0.55 + 1.2, (zBot + zTop) / 2 + 0.4]} ry={-Math.PI / 2} />
      {/* 顶端暖溢光（阁楼入口处的门槛暖意，牵引视线上楼），不投影——强度/半径调足让梯口明确 */}
      <pointLight position={[0, Y_ATTIC + 0.4, zTop + 0.3]} color={ATTIC_PALETTE.lampWarm} intensity={2.4} distance={3.8} decay={2} />
      {/* 楼梯下段暖补光（门厅侧）：让底部几级踏步从门厅望去能读出"这是楼梯"（评审 F5），不投影 */}
      <pointLight position={[0, 1.0, zBot - 0.7]} color={ATTIC_PALETTE.lampWarm} intensity={1.6} distance={3.4} decay={2} />
    </group>
  );
}
