import { useMemo } from "react";
import * as THREE from "three";
import { LAKEROCK, PINE, POOL } from "./theme";
import { COURT_PALETTE, stoneDarkMat, woodMat } from "./materials";
import { seededRng } from "../../scene/rng";

// 西侧一株松 + 一方湖石 + 池畔苔草。灰绿色域、剪影感；松略欹侧（中式园林的姿态）。

const pineMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.pine, roughness: 0.9 });
const mossMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.moss, roughness: 0.95, side: THREE.DoubleSide });

/** 一株欹松：斜干 + 几层扁平针叶冠。 */
function Pine() {
  const lean = 0.22;
  return (
    <group position={PINE} rotation={[0, 0.6, 0]}>
      {/* 主干（斜） */}
      <mesh position={[0.3, 1.5, 0]} rotation={[0, 0, -lean]} material={woodMat} castShadow>
        <cylinderGeometry args={[0.07, 0.13, 3.2, 8]} />
      </mesh>
      {/* 一道旁枝 */}
      <mesh position={[0.9, 2.4, 0.2]} rotation={[0, 0.3, -1.0]} material={woodMat} castShadow>
        <cylinderGeometry args={[0.035, 0.06, 1.4, 6]} />
      </mesh>
      {/* 针叶冠（扁平几层，剪影） */}
      {[
        [0.7, 2.9, 0.0, 1.5],
        [1.4, 2.7, 0.3, 1.0],
        [0.2, 3.3, -0.2, 1.1],
      ].map((c, i) => (
        <mesh key={i} position={[c[0], c[1], c[2]]} scale={[1, 0.62, 1]} material={pineMat} castShadow>
          <sphereGeometry args={[c[3], 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** 湖石：嶙峋的暗湿石（几块交叠的扭曲多面体）。 */
function LakeRock() {
  const rocks = useMemo(() => {
    const rand = seededRng(555);
    return Array.from({ length: 4 }).map(() => ({
      p: [(rand() - 0.5) * 0.8, 0.2 + rand() * 0.6, (rand() - 0.5) * 0.8] as [number, number, number],
      s: 0.4 + rand() * 0.5,
      r: [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI] as [number, number, number],
    }));
  }, []);
  return (
    <group position={LAKEROCK}>
      {rocks.map((r, i) => (
        <mesh key={i} position={r.p} rotation={r.r} scale={[r.s, r.s * 1.3, r.s]} material={stoneDarkMat} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** 池畔 / 墙根苔草：一小片灰绿草叶（InstancedMesh 十字片）。 */
function Moss() {
  const { geom, mats } = useMemo(() => {
    const rand = seededRng(88);
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const spots: [number, number][] = [];
    // 池缘一圈
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      spots.push([POOL.cx + Math.cos(a) * (POOL.r + 0.25), POOL.cz + Math.sin(a) * (POOL.r + 0.25)]);
    }
    // 松下
    for (let i = 0; i < 10; i++) spots.push([PINE[0] + (rand() - 0.5) * 1.4, PINE[2] + (rand() - 0.5) * 1.4]);
    for (const [x, z] of spots) {
      const s = 0.12 + rand() * 0.14;
      q.setFromEuler(e.set(0, rand() * Math.PI, 0));
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.5, z), q, new THREE.Vector3(s, s, s)));
    }
    const geom = new THREE.PlaneGeometry(1, 1);
    return { geom, mats };
  }, []);
  const init = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    mats.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
  };
  return <instancedMesh ref={init} args={[geom, mossMat, mats.length]} frustumCulled={false} />;
}

export default function Garden({ low = false }: { low?: boolean }) {
  return (
    <group>
      <Pine />
      <LakeRock />
      {!low && <Moss />}
    </group>
  );
}
