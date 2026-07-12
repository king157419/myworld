import { useMemo } from "react";
import * as THREE from "three";
import { ATTIC, EAVE_H, HALF_W, RIDGE_H, Y_ATTIC } from "./data";
import { ATTIC_PALETTE, floorMat, plasterMat, roofBeamMat, woodWarmMat } from "./materials";

// 老宅外壳：门厅（y=0）+ 木楼梯井 + 阁楼主间（双坡人字顶）。三段依坡而建、越往里越高。
// 几何全部由 data.ts 的常量派生（walk 碰撞读同一份 → 看到的墙就是挡路的墙）。
// 阴影：只有写字台主灯投影，外壳一律 receiveShadow、不 castShadow（省阴影预算）。

const T = 0.16; // 墙厚

const ridgeY = Y_ATTIC + RIDGE_H; // 屋脊绝对高
const eaveY = Y_ATTIC + EAVE_H; // 檐口绝对高

function Wall({ p, s, mat = plasterMat }: { p: [number, number, number]; s: [number, number, number]; mat?: THREE.Material }) {
  return (
    <mesh position={p} receiveShadow material={mat}>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** 双坡屋顶：两片斜面（内表面朝下入室），自定义几何、平面着色。 */
function useRoof() {
  return useMemo(() => {
    const { z0, z1 } = ATTIC.room;
    const R1 = [0, ridgeY, z1], R2 = [0, ridgeY, z0];
    const Epx1 = [HALF_W, eaveY, z1], Epx2 = [HALF_W, eaveY, z0];
    const Enx1 = [-HALF_W, eaveY, z1], Enx2 = [-HALF_W, eaveY, z0];
    const tri = (...pts: number[][]) => pts.flat();
    const pos = new Float32Array([
      // +X 坡（从内看：法向朝 -X/-Y）
      ...tri(R1, Epx2, R2), ...tri(R1, Epx1, Epx2),
      // -X 坡
      ...tri(R1, R2, Enx2), ...tri(R1, Enx2, Enx1),
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, []);
}

/** 山墙（三角端墙）：矩形墙身 + 三角顶。solid=false 时中央留门洞（楼梯到达口）。 */
function Gable({ z, opening }: { z: number; opening?: { half: number; top: number } }) {
  const triGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // 三角：两檐口 + 屋脊
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-HALF_W, eaveY, z, HALF_W, eaveY, z, 0, ridgeY, z]), 3),
    );
    g.computeVertexNormals();
    return g;
  }, [z]);
  return (
    <group>
      {/* 三角顶 */}
      <mesh geometry={triGeom} receiveShadow>
        <meshStandardMaterial color={ATTIC_PALETTE.plaster} roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      {/* 墙身（矩形，含门洞则拆两侧 + 门楣） */}
      {opening ? (
        <>
          <Wall p={[-(opening.half + (HALF_W - opening.half) / 2), (Y_ATTIC + eaveY) / 2, z]} s={[HALF_W - opening.half, eaveY - Y_ATTIC, T]} />
          <Wall p={[opening.half + (HALF_W - opening.half) / 2, (Y_ATTIC + eaveY) / 2, z]} s={[HALF_W - opening.half, eaveY - Y_ATTIC, T]} />
          <Wall p={[0, (opening.top + eaveY) / 2, z]} s={[opening.half * 2, eaveY - opening.top, T]} />
        </>
      ) : (
        <Wall p={[0, (Y_ATTIC + eaveY) / 2, z]} s={[HALF_W * 2, eaveY - Y_ATTIC, T]} />
      )}
    </group>
  );
}

export default function Shell() {
  const roof = useRoof();
  const entry = ATTIC.entry;
  const stair = ATTIC.stair;
  const room = ATTIC.room;

  // 楼梯软顶（沿坡上方一片斜板，别让抬头看见空）
  const stairSoffit = useMemo(() => {
    const zN = stair.zBot, zF = stair.zTop;
    const yN = 2.5, yF = Y_ATTIC + 2.0; // 起点上方净高 ~2.5，到阁楼侧抬到 Y_ATTIC+2
    const xL = -1.25, xR = 1.25;
    const tri = (...p: number[][]) => p.flat();
    const A = [xL, yN, zN], B = [xR, yN, zN], C = [xR, yF, zF], D = [xL, yF, zF];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...tri(A, C, B), ...tri(A, D, C)]), 3));
    g.computeVertexNormals();
    return g;
  }, [stair.zBot, stair.zTop]);

  return (
    <group>
      {/* ───────── 门厅（y=0）───────── */}
      <mesh position={[0, -0.05, (entry.z0 + entry.z1) / 2]} receiveShadow material={floorMat}>
        <boxGeometry args={[entry.x1 - entry.x0, 0.1, entry.z1 - entry.z0]} />
      </mesh>
      {/* 门厅侧墙 */}
      <Wall p={[entry.x0, 1.3, (entry.z0 + entry.z1) / 2]} s={[T, 2.6, entry.z1 - entry.z0]} />
      <Wall p={[entry.x1, 1.3, (entry.z0 + entry.z1) / 2]} s={[T, 2.6, entry.z1 - entry.z0]} />
      {/* 门厅天花（压低，昏暗） */}
      <Wall p={[0, 2.55, (entry.z0 + entry.z1) / 2]} s={[entry.x1 - entry.x0, T, entry.z1 - entry.z0]} />
      {/* 前门墙（含门 + 气窗）z = entry.z1 */}
      <Wall p={[-(entry.door.half + (entry.x1 - entry.door.half) / 2), 1.3, entry.z1]} s={[entry.x1 - entry.door.half, 2.6, T]} />
      <Wall p={[entry.door.half + (entry.x1 - entry.door.half) / 2, 1.3, entry.z1]} s={[entry.x1 - entry.door.half, 2.6, T]} />
      {/* 门楣上方墙 */}
      <Wall p={[0, (entry.door.top + 2.6) / 2 + 0.05, entry.z1]} s={[entry.door.half * 2 + 0.3, 2.6 - entry.door.top, T]} />
      {/* 关着的前门（深木） */}
      <mesh position={[0, entry.door.top / 2, entry.z1 - 0.02]} receiveShadow>
        <boxGeometry args={[entry.door.half * 2, entry.door.top, 0.08]} />
        <meshStandardMaterial color={"#1c140d"} roughness={0.8} />
      </mesh>
      {/* 门把手 */}
      <mesh position={[entry.door.half - 0.16, entry.door.top / 2, entry.z1 - 0.08]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color={ATTIC_PALETTE.brass} roughness={0.35} metalness={1} />
      </mesh>
      {/* 门上气窗：透进一线冷光（半透冷玻璃 + 一盏冷补光）——提亮到实际可见（评审 F5） */}
      <mesh position={[0, entry.door.top + 0.16, entry.z1 - 0.02]}>
        <planeGeometry args={[entry.door.half * 2, 0.24]} />
        <meshBasicMaterial color={"#4a638c"} transparent opacity={0.95} toneMapped={false} />
      </mesh>
      <pointLight position={[0, entry.door.top + 0.1, entry.z1 - 0.5]} color={"#8ba2cc"} intensity={3.4} distance={5.2} decay={2} />
      {/* 门厅极低暖顶光：把"这是门厅"从纯黑里托出一层（仍昏暗、仍被楼上暖光牵引） */}
      <pointLight position={[0.3, 2.35, (entry.z0 + entry.z1) / 2 + 0.3]} color={ATTIC_PALETTE.lampWarm} intensity={1.3} distance={5.0} decay={2} />

      {/* ───────── 楼梯井 ───────── */}
      {/* 侧墙（沿 z，覆盖上升段；高度给足） */}
      <Wall p={[stair.x0, Y_ATTIC / 2 + 1.0, (stair.zBot + stair.zTop) / 2]} s={[T, Y_ATTIC + 2.6, stair.zBot - stair.zTop]} />
      <Wall p={[stair.x1, Y_ATTIC / 2 + 1.0, (stair.zBot + stair.zTop) / 2]} s={[T, Y_ATTIC + 2.6, stair.zBot - stair.zTop]} />
      {/* 楼梯软顶 */}
      <mesh geometry={stairSoffit} receiveShadow>
        <meshStandardMaterial color={ATTIC_PALETTE.plaster} roughness={0.96} side={THREE.DoubleSide} />
      </mesh>

      {/* ───────── 阁楼主间 ───────── */}
      {/* 地板 */}
      <mesh position={[0, Y_ATTIC - 0.05, (room.z0 + room.z1) / 2]} receiveShadow material={floorMat}>
        <boxGeometry args={[room.x1 - room.x0, 0.1, room.z1 - room.z0]} />
      </mesh>
      {/* 双坡屋顶 */}
      <mesh geometry={roof} receiveShadow>
        <meshStandardMaterial color={ATTIC_PALETTE.plaster} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* 屋脊梁 + 几道椽（暖深木 roofBeamMat：受光 + 一点自发光地板，不塌成纯黑贴片） */}
      <mesh position={[0, ridgeY - 0.12, (room.z0 + room.z1) / 2]} material={roofBeamMat}>
        <boxGeometry args={[0.16, 0.22, room.z1 - room.z0]} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => {
        const z = room.z0 + 0.9 + (i / 5) * (room.z1 - room.z0 - 1.8);
        return (
          <mesh key={i} position={[0, (ridgeY + eaveY) / 2 - 0.05, z]} material={roofBeamMat}>
            <boxGeometry args={[HALF_W * 2 - 0.1, 0.1, 0.12]} />
          </mesh>
        );
      })}
      {/* 屋脊暖余晖：两盏极低强度不投影暖光沿脊线，只把梁下缘与人字顶轻轻托起（不打散墙角的暗） */}
      {[0.32, 0.68].map((t, i) => (
        <pointLight
          key={i}
          position={[0, ridgeY - 0.5, room.z0 + t * (room.z1 - room.z0)]}
          color={ATTIC_PALETTE.lampWarm}
          intensity={0.9}
          distance={4.6}
          decay={2}
        />
      ))}
      {/* 山墙：远端（书墙侧，实墙）+ 近端（楼梯到达口，留门洞） */}
      <Gable z={room.z0} />
      <Gable z={room.z1} opening={{ half: 1.3, top: Y_ATTIC + 2.1 }} />
      {/* 低檐矮墙（膝墙）：x=±2 处一道矮墙，把不可走的低檐区自然挡在外面 */}
      {[-2.0, 2.0].map((x, i) => (
        <mesh key={i} position={[x, Y_ATTIC + 0.45, (room.z0 + room.z1) / 2]} receiveShadow material={woodWarmMat}>
          <boxGeometry args={[0.12, 0.9, room.z1 - room.z0 - 0.4]} />
        </mesh>
      ))}
    </group>
  );
}
