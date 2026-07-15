import { Suspense, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  TELESCOPE,
  TELESCOPE_ID,
  TELESCOPE_ROT_Y,
  TELESCOPE_TARGET_H,
  TELE_EYEPIECE_LOCAL,
  TELE_OBJECTIVE_LOCAL,
} from "../theme";
import { useInteractable } from "./interactables";

// 望远镜（观星台·"看记忆"舞台件）：第十四轮自制程序化黄铜折射望远镜
// （tools/bake/build_telescope.py），取代 Deck.tsx 里三根圆柱堆的粗糙"朝天镜"。
// 镜筒仰 57° 朝夜空、星对角把目镜折向来客——"凑近目镜看进去"这一交互成立。
// 它不是三 zone 之一（不进 world.zones / 数据契约）：登记为哨兵 id 的可交互件，
// 命中按 ENTER → 相机凑到目镜、望远镜叠层展开你的记忆星海（见 PlayerControls / MemoryScope）。
// GLB 与 AO 同一次烘焙出品（smart-UV 对位），材质名语义化。

const URL = "/models/telescope.glb";
const AO_URL = "/models/telescope_ao.png";

type Spec = { color: string; metalness: number; roughness: number; emissive?: string; emissiveIntensity?: number; noAo?: boolean; envMul?: number };
const REMAT: Record<string, Spec> = {
  // 夜景 + AgX：金属度不拉满，留一丝自发光让暖点光的漫反射接手（r9/r13 教训）。
  brass: { color: PALETTE.brass, metalness: 0.45, roughness: 0.42, emissive: PALETTE.glowAmber, emissiveIntensity: 0.42, envMul: 1.7 },
  brass_dark: { color: "#8a6a34", metalness: 0.92, roughness: 0.42, envMul: 1.6 }, // 箍环/脚箍/座/钮
  steel: { color: "#9aa0a6", metalness: 0.9, roughness: 0.38, envMul: 1.4 }, // 调焦筒/寻星支架
  wood: { color: PALETTE.woodWarm, metalness: 0.06, roughness: 0.6 }, // 三脚架腿
  // 透镜：冷夜玻璃"含着一颗星"——高自发光（AgX 会压 ≤1，小面积给到 >1 才亮）+ 不吃 AO。
  glass: { color: "#0b1430", metalness: 0.1, roughness: 0.05, emissive: "#9fb4ff", emissiveIntensity: 1.6, noAo: true, envMul: 2.4 },
};

function Model() {
  const { scene } = useGLTF(URL);
  const aoTex = useTexture(AO_URL);
  const model = useMemo(() => {
    aoTex.flipY = false;
    aoTex.colorSpace = THREE.NoColorSpace;
    aoTex.channel = 0;
    aoTex.needsUpdate = true;
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.ljBake = "occluder"; // 挡光/接触影，不被烘不被换
      const apply = (mat: THREE.Material): THREE.Material => {
        const std = (mat as THREE.MeshStandardMaterial).clone();
        const spec = REMAT[std.name];
        if (spec) {
          std.color = new THREE.Color(spec.color);
          std.metalness = spec.metalness;
          std.roughness = spec.roughness;
          std.envMapIntensity = spec.envMul ?? 1.2;
          if (!spec.noAo) {
            std.aoMap = aoTex;
            std.aoMapIntensity = 0.9;
          }
          if (spec.emissive) {
            std.emissive = new THREE.Color(spec.emissive);
            std.emissiveIntensity = spec.emissiveIntensity ?? 0;
          }
        }
        std.needsUpdate = true;
        return std;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(apply) : apply(mesh.material);
    });

    // 归一化：缩放到目标高度 + 底面贴 y=0。xz 用资产自带 pivot（方位轴在原点）。
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    root.scale.setScalar(TELESCOPE_TARGET_H / Math.max(size.y, 1e-4));
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    return root;
  }, [scene, aoTex]);

  // 登记为可交互舞台件（哨兵 id）。准心命中 + ENTER → PlayerControls 走"看记忆"分支。
  const hit = useInteractable(TELESCOPE_ID);

  const [ex, ey, ez] = TELE_EYEPIECE_LOCAL;
  const [ox, oy, oz] = TELE_OBJECTIVE_LOCAL;

  return (
    <group ref={hit} position={TELESCOPE} rotation={[0, TELESCOPE_ROT_Y, 0]}>
      <primitive object={model} />
      {/* 来客正前方主键光：玩家从广场/坡道走近，正对镜筒的是它的 +Z 前脸——把主光放到
          正前方高处掠过整根筒身正面，才不是逆光黑剪影（r13 留声机同理，一实测就现）。 */}
      <pointLight position={[0.15, 1.55, 1.55]} color={PALETTE.lampWarm} intensity={4.8} distance={4.4} decay={2} />
      {/* 右侧暖缘光：擦亮 +X 侧棱与遮光罩，给金属一条暖高光。 */}
      <pointLight position={[0.8, 1.75, 0.5]} color={PALETTE.lampWarm} intensity={2.0} distance={3.6} decay={2} />
      {/* 下前补光：把镜筒中下段 + 调焦座从死黑里托起来。 */}
      <pointLight position={[0.2, 0.95, 1.15]} color={PALETTE.lampWarm} intensity={1.9} distance={3.0} decay={2} />
      {/* 左后冷月轮廓光：勾出镜筒长弧，冷暖对切。 */}
      <pointLight position={[-0.7, 1.7, -0.9]} color={"#9fb4ff"} intensity={2.3} distance={3.6} decay={2} />
      {/* 目镜暖芯：目镜口一点暖光，让蓝玻璃与铜口发亮——"这里可以看进去"的邀请。 */}
      <pointLight position={[ex, ey + 0.05, ez + 0.22]} color={PALETTE.lampCore} intensity={1.3} distance={1.2} decay={2} />
      {/* 物镜冷芯：物镜/遮光罩迎夜空一侧的冷微光，让前口"含着星"。 */}
      <pointLight position={[ox, oy + 0.08, oz - 0.16]} color={"#b8c6e8"} intensity={1.1} distance={1.3} decay={2} />
    </group>
  );
}

export default function TelescopeModel() {
  return (
    <Suspense fallback={null}>
      <Model />
    </Suspense>
  );
}

useGLTF.preload(URL);
