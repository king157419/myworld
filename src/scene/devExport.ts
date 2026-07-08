import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// 仅开发期：烘焙管线的浏览器侧导出器（DevBridge 动态引入，不进生产包）。
// 把标了 userData.ljBake 的网格连同世界变换拍平导出成 GLB，灯光序列化成 JSON，
// POST 给 tools/bake/receiver.mjs 落盘。灯位/灯强取自活场景 → Blender 布灯不靠手抄。
//
// 标签语义（名字前缀进 GLB，bpy 脚本按前缀分组）：
//   static   被烘焙且运行时被 BakedShell 替换的静态壳
//   emitter  只作为烘焙光源进 Blender（自发光罩/灯泡），运行时照常渲染
//   occluder 只挡光/投影（书群、留声机），不烘不换

const RECEIVER = "http://127.0.0.1:5199/save";

type BakeTag = "static" | "emitter" | "occluder";

async function post(name: string, data: ArrayBuffer | string): Promise<void> {
  const res = await fetch(RECEIVER, {
    method: "POST",
    headers: { "x-filename": name, "content-type": "application/octet-stream" },
    body: data,
  });
  if (!res.ok) throw new Error(`receiver ${res.status}`);
}

function flatClone(o: THREE.Mesh, tag: BakeTag, i: number): THREE.Mesh {
  const m = new THREE.Mesh(o.geometry, o.material);
  o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
  m.name = `${tag}__${o.name || o.parent?.name || "mesh"}_${i}`;
  return m;
}

export async function exportShell(scene: THREE.Scene): Promise<string> {
  scene.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.name = "shell-export";
  let i = 0;
  const inst = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  scene.traverse((o) => {
    const tag = (o.userData?.ljBake ?? null) as BakeTag | null;
    if (!tag) return;
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh) {
      // 实例逐个展开（书群只当遮光体，共用一份灰材质即可）
      for (let k = 0; k < im.count; k++) {
        im.getMatrixAt(k, inst);
        world.multiplyMatrices(im.matrixWorld, inst);
        const m = new THREE.Mesh(im.geometry, occluderMat);
        world.decompose(m.position, m.quaternion, m.scale);
        m.name = `${tag}__inst_${i}_${k}`;
        root.add(m);
      }
      i++;
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      root.add(flatClone(mesh, tag, i++));
    }
  });
  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(root, { binary: true })) as ArrayBuffer;
  await post("shell.glb", glb);
  return `shell.glb: ${root.children.length} meshes, ${glb.byteLength} bytes`;
}

const occluderMat = new THREE.MeshStandardMaterial({ color: "#5a4a3a", roughness: 0.85 });

export async function exportLights(scene: THREE.Scene): Promise<string> {
  scene.updateMatrixWorld(true);
  const out: Record<string, unknown>[] = [];
  const p = new THREE.Vector3();
  scene.traverse((o) => {
    const path: string[] = [];
    for (let a: THREE.Object3D | null = o; a; a = a.parent) path.unshift(a.name || a.type);
    if ((o as THREE.PointLight).isPointLight) {
      const l = o as THREE.PointLight;
      l.getWorldPosition(p);
      out.push({ kind: "point", path: path.join("/"), pos: p.toArray(), color: `#${l.color.getHexString()}`, intensity: l.intensity, distance: l.distance, decay: l.decay, skip: o.userData?.ljBake === "content" || undefined });
    } else if ((o as THREE.DirectionalLight).isDirectionalLight) {
      const l = o as THREE.DirectionalLight;
      l.getWorldPosition(p);
      out.push({ kind: "dir", path: path.join("/"), pos: p.toArray(), color: `#${l.color.getHexString()}`, intensity: l.intensity });
    } else if ((o as THREE.AmbientLight).isAmbientLight) {
      const l = o as THREE.AmbientLight;
      out.push({ kind: "ambient", path: path.join("/"), color: `#${l.color.getHexString()}`, intensity: l.intensity });
    } else if ((o as THREE.HemisphereLight).isHemisphereLight) {
      const l = o as THREE.HemisphereLight;
      out.push({ kind: "hemi", path: path.join("/"), sky: `#${l.color.getHexString()}`, ground: `#${l.groundColor.getHexString()}`, intensity: l.intensity });
    }
  });
  const json = JSON.stringify(out, null, 2);
  await post("lights.json", json);
  return `lights.json: ${out.length} lights`;
}
