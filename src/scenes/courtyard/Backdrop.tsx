import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRng } from "../../scene/rng";
import { GATE, WALL } from "./theme";

// 围墙外的远方（满分定义「雾三层」的中景 + 远景层；近景清晰交给全局 FogExp2）。
//   · 远山：三层锥岭剪影（InstancedMesh，各 1 次绘制），一层比一层浅——
//     近岭灰绿深、中岭褪色、远岭只比天深一档，参照 ref_misty_river_ink_5 的空气透视。
//     fog=false + 手工分层配色 → 精确控制「越远越溶进天色」，不被全局雾一把糊平。
//   · 中景雾墙：几团柔雾 Sprite（灰绿、低透明、NormalBlending）浮在中距——
//     月洞门里 / 书房后 / 墙头之上的那层「灰绿褪色」，不发光（避免远景亮成发光屏）。
// 纯背景：不进 walk 碰撞、不进数据契约、不进 theme。

const SKY_STEPS = ["#3f4d45", "#54625a", "#6b776e"]; // 近→远，逐层变浅（末层只比天深一档）

/** 一层锥岭：环绕庭院外一圈的低矮山脊剪影。 */
function Ridge({ radius, count, hMin, hMax, color, seed }: { radius: number; count: number; hMin: number; hMax: number; color: string; seed: number }) {
  const { geom, mat, mats } = useMemo(() => {
    const rand = seededRng(seed);
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) / count) * Math.PI * 2 + (rand() - 0.5) * 0.28;
      const r = radius + (rand() - 0.5) * radius * 0.14;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      const h = hMin + rand() * (hMax - hMin);
      const w = h * (0.7 + rand() * 0.6);
      q.setFromEuler(e.set(0, rand() * Math.PI, 0));
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(px, h / 2 - 1.4, pz), q, new THREE.Vector3(w, h, w)));
    }
    const geom = new THREE.ConeGeometry(1, 1, 6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), fog: false, toneMapped: false });
    return { geom, mat, mats };
  }, [radius, count, hMin, hMax, color, seed]);

  const init = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  };
  return <instancedMesh ref={init} args={[geom, mat, mats.length]} frustumCulled={false} />;
}

/** 柔雾贴图（soft alpha，模块级共用）。 */
let mistTex: THREE.Texture | null = null;
function mistTexture(): THREE.Texture {
  if (mistTex) return mistTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  mistTex = new THREE.CanvasTexture(c);
  return mistTex;
}

/** 中景雾墙：几团柔雾 Sprite 浮在中距（灰绿、低透明、随相机朝向）。 */
function MistBanks({ color }: { color: string }) {
  const banks = useMemo(() => {
    const rand = seededRng(717);
    // [x, y, z, scale, opacity]
    const out: [number, number, number, number, number][] = [];
    // 环绕中距一圈 + 门洞里那团更实
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const r = 20 + rand() * 8;
      out.push([Math.cos(a) * r, 1.5 + rand() * 3.5, Math.sin(a) * r, 14 + rand() * 10, 0.28 + rand() * 0.14]);
    }
    // 月洞门方向（+Z）里更近更实的一团
    out.push([0, 1.6, 13, 9, 0.42]);
    // 书房后（-Z）一层压低的地面雾
    out.push([0, 0.6, -14, 20, 0.34]);
    return out;
  }, []);
  const tex = useMemo(() => mistTexture(), []);
  const col = useMemo(() => new THREE.Color(color), [color]);
  return (
    <>
      {banks.map((b, i) => (
        <sprite key={i} position={[b[0], b[1], b[2]]} scale={[b[3], b[3] * 0.6, 1]}>
          <spriteMaterial map={tex} color={col} transparent opacity={b[4]} depthWrite={false} fog={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}

/** 月洞门空气透视幕（评审 R12·C5）：门洞后一层比天空略暗的雾幕，
 *  把穿洞可见的远山「压回」雾里、与全局雾/远山同一分层色阶——不再像贴了张 porthole 贴纸。 */
function GateVeil({ mistColor }: { mistColor: string }) {
  const col = useMemo(() => new THREE.Color(mistColor).lerp(new THREE.Color("#000000"), 0.3), [mistColor]);
  return (
    <mesh position={[0, GATE.cy, WALL.zGate + 0.25]} renderOrder={0}>
      <circleGeometry args={[GATE.r * 1.04, 48]} />
      <meshBasicMaterial color={col} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  );
}

export default function Backdrop({ mistColor = "#8b978f", low = false }: { mistColor?: string; low?: boolean }) {
  const group = useRef<THREE.Group>(null);
  // 远山极缓的呼吸（几乎察觉不到，只为不完全死板）——不必要时可省。
  useFrame((s) => {
    if (group.current) group.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.02) * 0.004;
  });
  return (
    <group ref={group} name="courtyard-backdrop">
      {/* 三层远山（近→远逐层变浅） */}
      <Ridge radius={40} count={14} hMin={7} hMax={13} color={SKY_STEPS[0]} seed={41} />
      <Ridge radius={54} count={16} hMin={9} hMax={17} color={SKY_STEPS[1]} seed={82} />
      <Ridge radius={70} count={18} hMin={12} hMax={22} color={SKY_STEPS[2]} seed={123} />
      {/* 中景雾墙（low 档减半团数由 opacity 已足够轻，保留全部以守住三层观感） */}
      {!low && <MistBanks color={mistColor} />}
      {/* 月洞门空气透视幕：让穿洞远景与全局雾同色阶、略暗于天空 */}
      <GateVeil mistColor={mistColor} />
    </group>
  );
}
