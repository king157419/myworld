import { useMemo } from "react";
import * as THREE from "three";
import { BAMBOO } from "./theme";
import { COURT_PALETTE } from "./materials";
import { seededRng } from "../../scene/rng";

// 东墙竹丛：InstancedMesh 竹竿 + 简化叶片。参照《卧虎藏龙》竹海的灰绿色域与疏密节奏，
// 竹梢没入雾中（吃全局 FogExp2 → 越高越溶进灰绿）——剪影感，不追求叶片写实。

const culmMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.bamboo, roughness: 0.7 });
const leafMat = new THREE.MeshStandardMaterial({ color: COURT_PALETTE.bambooLeaf, roughness: 0.85, side: THREE.DoubleSide });

export default function Bamboo({ low = false }: { low?: boolean }) {
  const { culmGeom, culmMats, leafGeom, leafMats } = useMemo(() => {
    const rand = seededRng(2027);
    const N = low ? 26 : 44;
    const culmMats: THREE.Matrix4[] = [];
    const leafMats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      const x = BAMBOO.x0 + rand() * (BAMBOO.x1 - BAMBOO.x0);
      const z = BAMBOO.z0 + rand() * (BAMBOO.z1 - BAMBOO.z0);
      const h = 3.6 + rand() * 3.2;
      const lean = (rand() - 0.5) * 0.12;
      q.setFromEuler(e.set(lean, rand() * Math.PI, lean * 0.6));
      culmMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(1, h, 1)));
      // 叶簇：竹梢附近几片
      const clusters = 2 + Math.floor(rand() * 2);
      for (let c = 0; c < clusters; c++) {
        const ly = h * (0.6 + rand() * 0.38);
        q.setFromEuler(e.set((rand() - 0.5) * 1.2, rand() * Math.PI, (rand() - 0.5) * 1.2));
        const ls = 0.5 + rand() * 0.5;
        leafMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (rand() - 0.5) * 0.4, ly, z + (rand() - 0.5) * 0.4), q, new THREE.Vector3(ls, ls * 0.5, ls)));
      }
    }
    const culmGeom = new THREE.CylinderGeometry(0.035, 0.05, 1, 6);
    const leafGeom = new THREE.PlaneGeometry(0.55, 0.28);
    return { culmGeom, culmMats, leafGeom, leafMats };
  }, [low]);

  const initCulm = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    culmMats.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
  };
  const initLeaf = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    leafMats.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
  };

  return (
    <group>
      <instancedMesh ref={initCulm} args={[culmGeom, culmMat, culmMats.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={initLeaf} args={[leafGeom, leafMat, leafMats.length]} frustumCulled={false} />
    </group>
  );
}
