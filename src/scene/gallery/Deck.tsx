import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { DECK, DECK_Y, PALETTE, STEPS } from "../../theme";
import { brassMat, woodMat, woodWarmMat } from "./materials";

// 观星台：从水面升起的石台 + 登台坡道（连续坡，脚下高度与 walk.ts 逐点一致）+ 栏杆 + 望远镜。

export default function Deck({ baked = false }: { baked?: boolean }) {
  const cx = (DECK.x0 + DECK.x1) / 2;
  const cz = (DECK.zFar + DECK.zNear) / 2;
  const wx = DECK.x1 - DECK.x0;
  const wz = DECK.zNear - DECK.zFar;

  // 坡面与水平夹角；坡面法向（向上偏 +z）。
  const SLOPE_ANG = Math.atan2(DECK_Y, STEPS.zBottom - STEPS.zTop);

  // 楔形坡道几何（= 碰撞坡道本身）：底边贴水面 y=0，从 zBottom(水面) 斜升到 zTop(台前缘,y=DECK_Y)。
  // 非索引三角 + computeVertexNormals → 平面着色，棱角分明。
  const ramp = useMemo(() => {
    const xL = STEPS.x0, xR = STEPS.x1, zN = STEPS.zBottom, zF = STEPS.zTop, H = DECK_Y;
    const La = [xL, 0, zN], Lb = [xL, 0, zF], Lc = [xL, H, zF];
    const Ra = [xR, 0, zN], Rb = [xR, 0, zF], Rc = [xR, H, zF];
    const tri = (...pts: number[][]) => pts.flat();
    const pos = new Float32Array([
      ...tri(La, Ra, Rc), ...tri(La, Rc, Lc), // 坡面（行走面）
      ...tri(Lb, Lc, Rc), ...tri(Lb, Rc, Rb), // 背立面
      ...tri(La, Lb, Rb), ...tri(La, Rb, Ra), // 底面
      ...tri(La, Lc, Lb), // 左三角侧壁
      ...tri(Ra, Rb, Rc), // 右三角侧壁
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  // 踏条（装饰）：沿坡面均匀嵌一排薄木条，给"台阶"读感而不破坏连续坡的顺滑。数量纯装饰取值。
  const nosings = useMemo(() => {
    const out: [number, number, number][] = [];
    const ny = Math.cos(SLOPE_ANG), nz = Math.sin(SLOPE_ANG);
    const N = 7;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1);
      const y = t * DECK_Y, z = STEPS.zBottom + t * (STEPS.zTop - STEPS.zBottom);
      out.push([0, y + ny * 0.016, z + nz * 0.016]);
    }
    return out;
  }, [SLOPE_ANG]);

  return (
    <group>
      {/* 静态壳（baked 时由 BakedShell 的分灯 lightmap 版本接管渲染） */}
      {!baked && (
        <>
          {/* 台体 */}
          <RoundedBox name="deck-platform" userData={{ ljBake: "static" }} args={[wx, DECK_Y, wz]} radius={0.04} smoothness={3} position={[cx, DECK_Y / 2, cz]} castShadow receiveShadow>
            <meshStandardMaterial color={PALETTE.stoneLit} roughness={0.82} metalness={0.06} />
          </RoundedBox>

          {/* 登台坡道（楔形）*/}
          <mesh name="deck-ramp" userData={{ ljBake: "static" }} geometry={ramp} castShadow receiveShadow material={woodWarmMat} />

          {/* 踏条：薄木条嵌在坡面上（贴着坡面、随坡倾斜）*/}
          {nosings.map((p, i) => (
            <mesh key={i} name="deck-nosing" userData={{ ljBake: "static" }} position={p} rotation={[SLOPE_ANG, 0, 0]} castShadow material={woodMat}>
              <boxGeometry args={[STEPS.x1 - STEPS.x0 - 0.18, 0.03, 0.13]} />
            </mesh>
          ))}
        </>
      )}

      {/* 坡脚暖光：坡道入水处一圈窄暖光，"邀请上台" */}
      <pointLight position={[0, 0.16, STEPS.zBottom + 0.05]} color={PALETTE.lampWarm} intensity={1.1} distance={3.2} decay={2} />
      {/* 两侧栏杆（真黄铜，车削立柱） */}
      {!baked && (
        <>
          {[DECK.x0 + 0.1, DECK.x1 - 0.1].map((rx, i) => (
            <group key={i}>
              <mesh name="deck-rail" userData={{ ljBake: "static" }} position={[rx, DECK_Y + 0.5, cz]} material={brassMat}>
                <boxGeometry args={[0.06, 0.06, wz - 0.2]} />
              </mesh>
              {[cz - wz / 2 + 0.3, cz, cz + wz / 2 - 0.3].map((pz, j) => (
                <mesh key={j} name="deck-post" userData={{ ljBake: "static" }} position={[rx, DECK_Y + 0.26, pz]} castShadow material={brassMat}>
                  <cylinderGeometry args={[0.026, 0.026, 0.52, 12]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* 望远镜（朝天） */}
          <group position={[DECK.x1 - 1.0, DECK_Y, DECK.zFar + 0.9]}>
            <mesh name="scope-base" userData={{ ljBake: "static" }} position={[0, 0.5, 0]} material={brassMat}>
              <cylinderGeometry args={[0.055, 0.07, 1.0, 20]} />
            </mesh>
            <mesh name="scope-tube" userData={{ ljBake: "static" }} position={[0, 0.9, 0.18]} rotation={[0.9, 0, 0]} castShadow>
              <cylinderGeometry args={[0.085, 0.1, 0.9, 20]} />
              <meshStandardMaterial color={"#1c2430"} roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh name="scope-foot" userData={{ ljBake: "static" }} position={[0, 0.06, 0]} material={woodMat}>
              <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}
