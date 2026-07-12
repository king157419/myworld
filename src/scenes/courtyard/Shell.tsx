import { useMemo } from "react";
import * as THREE from "three";
import { GATE, STEP, STUDY, WALL, Y_STUDY } from "./theme";
import {
  COURT_PALETTE,
  makeXuanTexture,
  ridgeMat,
  stoneDarkMat,
  stoneMat,
  tileMat,
  woodMat,
  paperMat,
} from "./materials";

// 山居外壳：围墙（带渍宣白 + 黛瓦压顶）+ 月洞门 + 石板铺地 / 石径 + 抬高书房（台基 + 墙 + 双坡瓦顶
// + 前廊 + 格窗）+ 石阶。几何全部由 theme.ts 常量派生（walk 碰撞读同一份 → 看到的墙就是挡路的墙）。
// 满分锚：宣白墙带灰带渍不纯白、黛瓦雨湿微反光受光不纯黑、石面磨圆湿润、纸窗透出屋里暖。

const T = WALL.thick;
const wallCY = WALL.height / 2;

/** 带渍宣白墙（贴 canvas 纹理，绝非纯白）。 */
function XuanWall({ p, s, tex, repeat = [1, 1] }: { p: [number, number, number]; s: [number, number, number]; tex: THREE.Texture; repeat?: [number, number] }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.95 });
    m.map!.repeat.set(repeat[0], repeat[1]);
    m.map!.needsUpdate = true;
    return m;
  }, [tex, repeat]);
  return (
    <mesh position={p} receiveShadow material={mat}>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** 黛瓦压顶（围墙顶的一道深色瓦盖，微出挑）。 */
function Coping({ p, len, horizontal }: { p: [number, number, number]; len: number; horizontal: boolean }) {
  const s: [number, number, number] = horizontal ? [len, 0.16, T + 0.22] : [T + 0.22, 0.16, len];
  return (
    <mesh position={[p[0], WALL.height + 0.02, p[2]]} material={ridgeMat} castShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** 月洞门：整面南墙挖一个圆洞（ExtrudeGeometry 带孔）+ 石门圈。 */
function MoonGate({ tex }: { tex: THREE.Texture }) {
  const geom = useMemo(() => {
    const W = WALL.x * 2;
    const H = WALL.height;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(W / 2, 0);
    shape.lineTo(W / 2, H);
    shape.lineTo(-W / 2, H);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, GATE.cy, GATE.r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 48 });
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.95 });
    m.map!.repeat.set(3, 1); // 评审 R12·C4：收敛频率，不再读作波纹铁皮
    m.map!.needsUpdate = true;
    return m;
  }, [tex]);
  return (
    <group position={[0, 0, GATE.z - T / 2]}>
      <mesh geometry={geom} material={mat} receiveShadow />
      {/* 石门圈（深石，磨圆） */}
      <mesh position={[0, GATE.cy, T / 2]} rotation={[0, 0, 0]} material={stoneDarkMat} castShadow>
        <torusGeometry args={[GATE.r + 0.05, 0.1, 10, 56]} />
      </mesh>
    </group>
  );
}

/** 石径：从月洞门通向书房石阶（磨圆湿石，InstancedMesh）。 */
function Path() {
  const { geom, mat, mats } = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let seed = 1234;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    // 从 z=6.4 铺到 z=-1.4，每排 2~3 块，略错位
    for (let z = 6.4; z > -1.5; z -= 0.62) {
      const cols = rnd() < 0.5 ? 2 : 3;
      for (let cI = 0; cI < cols; cI++) {
        const x = (cI - (cols - 1) / 2) * 0.62 + (rnd() - 0.5) * 0.08;
        const w = 0.5 + rnd() * 0.06;
        const d = 0.5 + rnd() * 0.06;
        q.setFromEuler(e.set(0, (rnd() - 0.5) * 0.12, 0));
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.015, z + (rnd() - 0.5) * 0.06), q, new THREE.Vector3(w, 0.06, d)));
      }
    }
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = stoneMat;
    return { geom, mat, mats };
  }, []);
  const init = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  };
  return <instancedMesh ref={init} args={[geom, mat, mats.length]} receiveShadow frustumCulled={false} />;
}

/** 一片瓦坡（受光的实体板 + 瓦垄 InstancedMesh + 檐口板）。 */
function Slope({ z, yTop, yEave, zEdge, width }: { z: number; yTop: number; yEave: number; zEdge: number; width: number }) {
  const dz = zEdge - z; // 从脊到檐的 z 位移（带号）
  const dy = yEave - yTop;
  const len = Math.hypot(dz, dy);
  const angle = Math.atan2(dy, dz); // 绕 X
  const cx = 0;
  const cz = (z + zEdge) / 2;
  const cy = (yTop + yEave) / 2;
  // 瓦垄（沿坡向的凸棱，横排铺满宽度）
  const ridges = useMemo(() => {
    const out: [number, number][] = [];
    const n = Math.round(width / 0.42);
    for (let i = 0; i < n; i++) out.push([-width / 2 + (i + 0.5) * (width / n), 0]);
    return out;
  }, [width]);
  const rGeom = useMemo(() => new THREE.CylinderGeometry(0.045, 0.045, len * 0.98, 7, 1, false, 0, Math.PI), [len]);
  const init = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); // 卧倒沿 z
    ridges.forEach((r, i) => {
      m.compose(new THREE.Vector3(r[0], 0.09, 0), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return (
    <group position={[cx, cy, cz]} rotation={[angle, 0, 0]}>
      {/* 坡板（受光实体，非纯黑贴片） */}
      <mesh material={tileMat} castShadow receiveShadow>
        <boxGeometry args={[width, 0.1, len]} />
      </mesh>
      {/* 瓦垄 */}
      <instancedMesh ref={init} args={[rGeom, ridgeMat, ridges.length]} castShadow frustumCulled={false} />
    </group>
  );
}

/** 格窗（花窗）：纸背 + 木格栅；屋里暖光透出（低亮度）。 */
function Lattice({ p, w = 0.9, h = 1.3 }: { p: [number, number, number]; w?: number; h?: number }) {
  const cols = 4;
  const rows = 6;
  return (
    <group position={p}>
      {/* 纸背（透出屋里暖，低自发光） */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={COURT_PALETTE.paper} emissive={new THREE.Color(COURT_PALETTE.lampWarm)} emissiveIntensity={0.22} roughness={0.9} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* 外框 */}
      <mesh position={[0, 0, 0.015]} material={woodMat}>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.03]} />
      </mesh>
      {/* 竖棂 */}
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <mesh key={`v${i}`} position={[-w / 2 + ((i + 1) * w) / cols, 0, 0.02]} material={woodMat}>
          <boxGeometry args={[0.018, h, 0.02]} />
        </mesh>
      ))}
      {/* 横棂 */}
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, -h / 2 + ((i + 1) * h) / rows, 0.02]} material={woodMat}>
          <boxGeometry args={[w, 0.018, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

export default function Shell() {
  const tex = useMemo(() => makeXuanTexture(), []);
  const northZ = STUDY.zBack - 0.2;
  const perimDepth = WALL.zGate - northZ;
  const perimMidZ = (WALL.zGate + northZ) / 2;

  const roofTopY = Y_STUDY + STUDY.wallH + 1.15;
  const roofEaveY = Y_STUDY + STUDY.wallH + 0.05;
  const ridgeZ = (STUDY.zBack + STUDY.zFront) / 2;
  const roofBackEave = STUDY.zBack - 0.5;
  const roofFrontEave = STUDY.zFront + 0.35; // 前檐罩住廊
  const roofW = (STUDY.x1 - STUDY.x0) + 1.0;

  // 评审 R12·C8：书房后墙顶（wallTop）与后坡顶底面之间原来漏空——站在琴角能望见墙外的山。
  // 算出后墙平面处的坡顶底高度，补一道山尖三角把这道缝封死（后檐坡由脊 z=ridgeZ 落到 roofBackEave）。
  const wallTop = Y_STUDY + STUDY.wallH;
  const roofUnderBack = roofEaveY + ((roofBackEave - STUDY.zBack) / (roofBackEave - ridgeZ)) * (roofTopY - roofEaveY) + 0.08;

  return (
    <group>
      {/* ───────── 庭院地面（湿暗底 + 石径） ───────── */}
      <mesh position={[0, -0.03, perimMidZ]} receiveShadow>
        <boxGeometry args={[WALL.x * 2, 0.06, perimDepth]} />
        <meshStandardMaterial color={COURT_PALETTE.stoneDark} roughness={0.95} />
      </mesh>
      <Path />

      {/* ───────── 围墙（带渍宣白 + 黛瓦压顶） ───────── */}
      {/* 东西墙（横向 repeat 拉稀、竖向 repeat=1 → 不再横向分层结带；评审 R12·C4） */}
      <XuanWall p={[-WALL.x, wallCY, perimMidZ]} s={[T, WALL.height, perimDepth]} tex={tex} repeat={[perimDepth / 4.5, 1]} />
      <XuanWall p={[WALL.x, wallCY, perimMidZ]} s={[T, WALL.height, perimDepth]} tex={tex} repeat={[perimDepth / 4.5, 1]} />
      <Coping p={[-WALL.x, 0, perimMidZ]} len={perimDepth} horizontal={false} />
      <Coping p={[WALL.x, 0, perimMidZ]} len={perimDepth} horizontal={false} />
      {/* 北墙（书房后） */}
      <XuanWall p={[0, wallCY, northZ]} s={[WALL.x * 2, WALL.height, T]} tex={tex} repeat={[WALL.x * 2 / 4.5, 1]} />
      <Coping p={[0, 0, northZ]} len={WALL.x * 2} horizontal={true} />
      {/* 南墙 = 月洞门 */}
      <MoonGate tex={tex} />
      <Coping p={[0, 0, GATE.z]} len={WALL.x * 2} horizontal={true} />

      {/* ───────── 书房台基（抬高） ───────── */}
      <mesh position={[0, Y_STUDY / 2, (STUDY.zBack + STUDY.zFront) / 2 + 0.2]} receiveShadow material={stoneDarkMat}>
        <boxGeometry args={[STUDY.x1 - STUDY.x0 + 0.6, Y_STUDY, STUDY.zFront - STUDY.zBack + 0.8]} />
      </mesh>
      {/* 台基面（磨圆湿石缘） */}
      <mesh position={[0, Y_STUDY + 0.005, (STUDY.zBack + STUDY.zRoom) / 2]} receiveShadow material={stoneMat}>
        <boxGeometry args={[STUDY.x1 - STUDY.x0 + 0.4, 0.04, STUDY.zRoom - STUDY.zBack + 0.4]} />
      </mesh>

      {/* ───────── 石阶（庭院 → 台基，三级） ───────── */}
      {[0, 1, 2].map((i) => {
        const t = (i + 1) / 3;
        const y = t * Y_STUDY;
        const z = STEP.zBot - (i + 0.5) * ((STEP.zBot - STEP.zTop) / 3);
        return (
          <mesh key={i} position={[0, y - 0.06, z]} receiveShadow material={stoneMat}>
            <boxGeometry args={[2.6, y + 0.12, (STEP.zBot - STEP.zTop) / 3 + 0.04]} />
          </mesh>
        );
      })}

      {/* ───────── 书房墙 ───────── */}
      {/* 室内地板（暖木） */}
      <mesh position={[0, Y_STUDY + 0.01, (STUDY.zBack + STUDY.zRoom) / 2]} receiveShadow>
        <boxGeometry args={[STUDY.x1 - STUDY.x0, 0.03, STUDY.zRoom - STUDY.zBack]} />
        <meshStandardMaterial color={COURT_PALETTE.woodWarm} roughness={0.8} />
      </mesh>
      {/* 后墙 + 侧墙（带渍宣白） */}
      <XuanWall p={[0, Y_STUDY + STUDY.wallH / 2, STUDY.zBack]} s={[STUDY.x1 - STUDY.x0, STUDY.wallH, T]} tex={tex} repeat={[1.6, 1]} />
      {/* 后墙上方封缝三角（评审 R12·C8：补墙顶↔坡顶交接，遮住外面的山） */}
      <XuanWall p={[0, (wallTop + roofUnderBack) / 2, STUDY.zBack]} s={[STUDY.x1 - STUDY.x0, roofUnderBack - wallTop, T]} tex={tex} repeat={[1.6, 0.3]} />
      <XuanWall p={[STUDY.x0, Y_STUDY + STUDY.wallH / 2, (STUDY.zBack + STUDY.zRoom) / 2]} s={[T, STUDY.wallH, STUDY.zRoom - STUDY.zBack]} tex={tex} repeat={[1.4, 1]} />
      <XuanWall p={[STUDY.x1, Y_STUDY + STUDY.wallH / 2, (STUDY.zBack + STUDY.zRoom) / 2]} s={[T, STUDY.wallH, STUDY.zRoom - STUDY.zBack]} tex={tex} repeat={[1.4, 1]} />
      {/* 前墙：中央门洞 + 两侧格窗 */}
      {[-1, 1].map((sgn) => (
        <XuanWall key={sgn} p={[sgn * (STUDY.x1 - 0.55), Y_STUDY + STUDY.wallH / 2, STUDY.zRoom]} s={[1.1, STUDY.wallH, T]} tex={tex} repeat={[0.7, 1]} />
      ))}
      {/* 门楣 */}
      <XuanWall p={[0, Y_STUDY + STUDY.wallH - 0.3, STUDY.zRoom]} s={[STUDY.x1 - STUDY.x0 - 2.2, 0.6, T]} tex={tex} repeat={[1, 0.4]} />
      {[-1, 1].map((sgn) => (
        <Lattice key={sgn} p={[sgn * (STUDY.x1 - 0.55), Y_STUDY + STUDY.wallH / 2 - 0.05, STUDY.zRoom + 0.02]} />
      ))}

      {/* ───────── 前廊（檐柱 + 廊台） ───────── */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * (STUDY.x1 - 0.25), Y_STUDY + STUDY.wallH / 2, STUDY.zFront]} material={woodMat} castShadow>
          <cylinderGeometry args={[0.09, 0.1, STUDY.wallH, 12]} />
        </mesh>
      ))}
      {/* 檐枋（柱头横梁） */}
      <mesh position={[0, Y_STUDY + STUDY.wallH - 0.06, STUDY.zFront]} material={woodMat} castShadow>
        <boxGeometry args={[STUDY.x1 - STUDY.x0 + 0.5, 0.16, 0.16]} />
      </mesh>

      {/* ───────── 双坡瓦顶（瓦垄 + 脊） ───────── */}
      <Slope z={ridgeZ} yTop={roofTopY} yEave={roofEaveY} zEdge={roofBackEave} width={roofW} />
      <Slope z={ridgeZ} yTop={roofTopY} yEave={roofEaveY} zEdge={roofFrontEave} width={roofW} />
      {/* 正脊 */}
      <mesh position={[0, roofTopY + 0.06, ridgeZ]} material={ridgeMat} castShadow>
        <boxGeometry args={[roofW + 0.1, 0.16, 0.2]} />
      </mesh>
      {/* 山墙封檐（两端小三角，别露空） */}
      {[STUDY.x0 - 0.5, STUDY.x1 + 0.5].map((x, i) => (
        <mesh key={i} position={[x, (roofTopY + roofEaveY) / 2, ridgeZ]} material={paperMat}>
          <boxGeometry args={[0.06, roofTopY - roofEaveY, roofFrontEave - roofBackEave]} />
        </mesh>
      ))}
    </group>
  );
}
