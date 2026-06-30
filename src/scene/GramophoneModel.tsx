import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GRAMOPHONE, PALETTE } from "../theme";

// 留声机（影音区舞台）：用一只手工 CC-BY 低多边形 GLB 取代原来的程序化喇叭。
// 原作：Don Carson, "Gramophone"（poly.pizza/m/9MZ0sCt1REv, CC-BY 3.0），见 public/models/CREDITS.md。
// 「修改而非照搬」：① 全部占位材质按原材质名重映射到潮汐图书馆调色板（黄铜喇叭 / 深木箱 / 黑胶 / 把刺眼的红唱标改成暖琥珀）；
//   ② 喉部塞一盏暖光把喇叭内壁照成金；③ 用包围盒归一化（缩放到目标高度、底面贴 y=0、xz 居中），与原 pivot 无关。
// zones/RecordPlayer 仍在 GRAMOPHONE 处叠加旋转黑胶与播放灯（数据契约不动）。

const URL = "/models/gramophone.glb";

const TARGET_H = 1.32; // 留声机连喇叭的总高（米）
const ROT_Y = Math.PI; // 朝向：让喇叭口/正面对着来客(+Z)；按实拍校正
const LIFT = 0.0; // 需要时整体抬高一点点贴合台面

// 原模型 10 个占位材质 → 调色板角色（按 GLTFLoader 保留的材质名匹配）。
type Spec = { color: string; metalness: number; roughness: number; emissive?: string; emissiveIntensity?: number };
const REMAT: Record<string, Spec> = {
  mat19: { color: PALETTE.brass, metalness: 0.9, roughness: 0.33, emissive: PALETTE.lampWarm, emissiveIntensity: 0.06 }, // 喇叭外壁
  mat18: { color: "#d8b274", metalness: 0.85, roughness: 0.28, emissive: PALETTE.lampWarm, emissiveIntensity: 0.14 }, // 喇叭内壁（更亮、自发光暖）
  mat16: { color: "#6e5630", metalness: 0.82, roughness: 0.4 }, // 喇叭颈 / 暗黄铜
  mat15: { color: "#aab0b6", metalness: 0.85, roughness: 0.34 }, // 钢件（唱针臂）
  mat22: { color: "#5a5e66", metalness: 0.7, roughness: 0.46 }, // 暗金属件
  mat20: { color: PALETTE.woodWarm, metalness: 0.08, roughness: 0.62 }, // 木箱
  mat17: { color: "#100d0a", metalness: 0.2, roughness: 0.7 }, // 暗部 / 箱底
  mat23: { color: "#0a0a0d", metalness: 0.28, roughness: 0.38 }, // 黑胶唱片
  mat8: { color: "#b07a3a", metalness: 0.1, roughness: 0.55 }, // 唱片标（原刺红→暖琥珀）
  mat14: { color: "#c79152", metalness: 0.1, roughness: 0.55 }, // 唱片标 2
};

function Model() {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const apply = (mat: THREE.Material): THREE.Material => {
        const std = (mat as THREE.MeshStandardMaterial).clone(); // 克隆，别污染 useGLTF 缓存
        const spec = REMAT[std.name];
        if (spec) {
          std.color = new THREE.Color(spec.color);
          std.metalness = spec.metalness;
          std.roughness = spec.roughness;
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

    // 归一化：缩放到目标高度，底面贴 y=0，xz 居中（与原 pivot/缩放无关）。
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    root.scale.setScalar(TARGET_H / Math.max(size.y, 1e-4));
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    return root;
  }, [scene]);

  return (
    <group position={GRAMOPHONE} rotation={[0, ROT_Y, 0]}>
      <group position={[0, LIFT, 0]}>
        <primitive object={model} />
      </group>
      {/* 喉部暖光：把喇叭内壁照成金色，避免"黑洞剪影" */}
      <pointLight position={[0, 1.12, 0.12]} color={PALETTE.lampWarm} intensity={2.0} distance={1.8} decay={2} />
    </group>
  );
}

export default function GramophoneModel() {
  return (
    <Suspense fallback={null}>
      <Model />
    </Suspense>
  );
}

useGLTF.preload(URL);
