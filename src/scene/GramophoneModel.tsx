import { Suspense, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GRAMOPHONE, PALETTE } from "../theme";

// 留声机（影音区舞台）：第十三轮起为自制程序化雕塑模型（tools/bake/build_gramophone.py），
// 取代第九轮的 poly.pizza 低模——牵牛花喇叭壳（8 瓣、指数扩口、solidify 双层壁）+
// 鹅颈铜管 + 倒角木箱 + 唱臂/摇柄。GLB 与 AO 同一次烘焙出品（smart-UV 对位），材质名语义化。
// 资产 pivot 已按契约制作：唱盘中心在原点、底面 z=0、喇叭口朝 +Z——
// 运行时只做高度归一 + 贴地，不再做 xz 重心居中（喇叭前倾会把箱体推离锚点）。
// zones/RecordPlayer 仍在 GRAMOPHONE 处叠加旋转黑胶与播放灯（数据契约不动）。

const URL = "/models/gramophone.glb";
const AO_URL = "/models/gramophone_ao.png";

const TARGET_H = 1.32; // 总高（米）；资产原生 1.374 → 缩放 ≈0.961
const ROT_Y = 0; // 资产已朝 +Z（面向来客），无需再转

// 语义材质 → 调色板。喇叭内壁不吃 AO（深腔会被烘成近黑，r11 审计 F1 的教训）；
// 内壁自发光 + 铃口暖光让"从口看进去是金色的光"，外壁交给真金属反射。
type Spec = { color: string; metalness: number; roughness: number; emissive?: string; emissiveIntensity?: number; noAo?: boolean; envMul?: number };
const REMAT: Record<string, Spec> = {
  // 外壁金属度不拉满：本场景 env 薄，纯金属在背光面是死黑（r9 F1 教训）——
  // 降金属度让暖点光的漫反射接手，再给一丝自发光模拟"灯光擦过铜面"。
  // AgX 会把 ≤1 的自发光压暗一档——内壁要"发光的金花"就得给到 >1。
  brass: { color: PALETTE.brass, metalness: 0.5, roughness: 0.44, emissive: PALETTE.glowAmber, emissiveIntensity: 0.36, envMul: 1.9 },
  brass_inner: { color: "#e8c48a", metalness: 0.7, roughness: 0.42, emissive: PALETTE.glowAmber, emissiveIntensity: 1.4, noAo: true },
  brass_dark: { color: "#8a6a34", metalness: 0.95, roughness: 0.4, envMul: 1.6 }, // 鹅颈/箍环/摇柄/垫脚
  steel: { color: "#9aa0a6", metalness: 0.9, roughness: 0.38, envMul: 1.4 }, // 唱臂/撑杆/唱针轴
  wood: { color: PALETTE.woodWarm, metalness: 0.06, roughness: 0.55 }, // 箱体
  wood_dark: { color: "#241812", metalness: 0.06, roughness: 0.62 }, // 底裙/顶盖/饰条/柄头
  felt: { color: "#1c2418", metalness: 0.0, roughness: 0.92 }, // 唱盘毛毡
};

function Model() {
  const { scene } = useGLTF(URL);
  const aoTex = useTexture(AO_URL);
  const model = useMemo(() => {
    aoTex.flipY = false; // glTF UV 约定
    aoTex.colorSpace = THREE.NoColorSpace;
    aoTex.channel = 0; // 烘焙 GLB 只有一层 smart-UV
    aoTex.needsUpdate = true;
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.ljBake = "occluder"; // 烘焙时挡光/在台面上留接触影，不被烘不被换
      const apply = (mat: THREE.Material): THREE.Material => {
        const std = (mat as THREE.MeshStandardMaterial).clone(); // 克隆，别污染 useGLTF 缓存
        const spec = REMAT[std.name];
        if (spec) {
          std.color = new THREE.Color(spec.color);
          std.metalness = spec.metalness;
          std.roughness = spec.roughness;
          std.envMapIntensity = spec.envMul ?? 1.2; // 金属件多吃 IBL——小曲面默认 1.0 太薄
          if (!spec.noAo) {
            std.aoMap = aoTex; // 烘焙 AO 只压间接光，点光与自发光不受影响
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

    // 归一化：只缩放到目标高度 + 底面贴 y=0。xz 用资产自带 pivot（唱盘中心）。
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    root.scale.setScalar(TARGET_H / Math.max(size.y, 1e-4));
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    return root;
  }, [scene, aoTex]);

  return (
    <group position={GRAMOPHONE} rotation={[0, ROT_Y, 0]}>
      <primitive object={model} />
      {/* 铃口内的暖芯：顺喇叭轴（glTF (0,0.87,0.5) 方向）从口沿往里退 0.25m，
          照亮整圈内壁花瓣——位置按资产实测口心 (0,1.14,0.26) 推算 */}
      <pointLight position={[0, 0.92, 0.14]} color={PALETTE.lampCore} intensity={4.2} distance={2.6} decay={2} />
      {/* 喉部柔补：从鹅颈根往喇叭喉里透一点暖 */}
      <pointLight position={[0, 0.42, -0.15]} color={PALETTE.lampWarm} intensity={1.2} distance={1.8} decay={2} />
      {/* 来客侧键光：铜壳在暗夜+AgX 下必须有真正的主光，否则就是逆光剪影（本轮实测） */}
      <pointLight position={[0.85, 1.05, 1.25]} color={PALETTE.lampWarm} intensity={4.5} distance={3.5} decay={2} />
      {/* 左后冷月轮廓光：勾出壳形，冷暖对切（场景基调：冷的水与天 × 暖的灯与铜） */}
      <pointLight position={[-0.9, 1.6, -0.5]} color={"#9fb4ff"} intensity={2.6} distance={3.5} decay={2} />
      {/* 顶背月光：壳顶背面的法线朝上朝后，前侧键光照不到——没有这盏就是黑背（本轮实测） */}
      <pointLight position={[0.3, 1.9, -0.75]} color={"#b8c6e8"} intensity={4.5} distance={3.2} decay={2} />
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
