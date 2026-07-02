import { useMemo } from "react";
import { RoundedBox, Edges } from "@react-three/drei";
import { RoundedBoxGeometry } from "three-stdlib";
import * as THREE from "three";
import { BOOKWALL, PALETTE } from "../../theme";
import { BOOK_COLORS } from "./profiles";
import { seededRng } from "../rng";
import { woodMat, woodWarmMat } from "./materials";

// -X 一段圆弧上的高书架骨架 + 大量装饰书脊（实例化，倒角）。用户思考由 zones/Bookshelf 叠加。
// 书的宽窄/高矮/歪斜用种子化随机：同一个世界每次进来长一样（可复现、截图可对比）。

export default function BookWall() {
  const spineGeom = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.085), []);
  const { uprights, shelves, instances } = useMemo(() => {
    const rand = seededRng(7311);
    const up: { p: THREE.Vector3; ry: number }[] = [];
    const sh: { p: THREE.Vector3; ry: number; w: number }[] = [];
    const inst: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const segs = 7;
    for (let s = 0; s <= segs; s++) {
      const a = BOOKWALL.a0 + (BOOKWALL.a1 - BOOKWALL.a0) * (s / segs);
      const x = Math.cos(a) * BOOKWALL.radius;
      const z = Math.sin(a) * BOOKWALL.radius;
      const ry = a + Math.PI / 2; // 面朝圆心
      up.push({ p: new THREE.Vector3(x, BOOKWALL.height / 2, z), ry });
    }
    for (let s = 0; s < segs; s++) {
      const a = BOOKWALL.a0 + (BOOKWALL.a1 - BOOKWALL.a0) * ((s + 0.5) / segs);
      const x = Math.cos(a) * BOOKWALL.radius;
      const z = Math.sin(a) * BOOKWALL.radius;
      const ry = a + Math.PI / 2;
      const segW = (BOOKWALL.radius * (BOOKWALL.a1 - BOOKWALL.a0)) / segs;
      for (let lvl = 0; lvl < BOOKWALL.shelves; lvl++) {
        const y = 0.5 + lvl * (BOOKWALL.height / BOOKWALL.shelves);
        sh.push({ p: new THREE.Vector3(x, y, z), ry, w: segW * 0.94 });
        // 这一格里排一串书：宽窄/高矮/进深各异，偶有歪斜、偶有被抽出半截、偶有平摞的两三本
        // （读过还没放回去的样子），颜色做旧——绝不雷同。
        const inward = new THREE.Vector3(-x, 0, -z).normalize(); // 朝圆心（书架正面）方向
        const count = 11;
        let cursor = -segW * 0.46;
        const aged = new THREE.Color("#2e2620");
        const pickColor = () => new THREE.Color(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]).lerp(aged, 0.22 + rand() * 0.18);
        for (let b = 0; b < count && cursor < segW * 0.46; b++) {
          // 平摞：~9% 的位置躺两三本（占一本半的宽度），书堆微错位
          if (rand() < 0.09) {
            const pileW = 0.2 + rand() * 0.06; // 躺着的书長边沿架
            cursor += pileW * 0.55;
            const along = cursor;
            const pileN = 2 + (rand() < 0.4 ? 1 : 0);
            let py = y + 0.04;
            for (let p = 0; p < pileN; p++) {
              const th = 0.035 + rand() * 0.02; // 书厚
              const jitter = (rand() - 0.5) * 0.04;
              const bx = x + Math.cos(ry) * (along + jitter);
              const bz = z + Math.sin(ry) * (along + jitter);
              const m = new THREE.Matrix4();
              const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry + (rand() - 0.5) * 0.18, 0));
              m.compose(new THREE.Vector3(bx, py + th / 2, bz), q, new THREE.Vector3(pileW, th, 0.15 + rand() * 0.05));
              inst.push({ m, c: pickColor() });
              py += th;
            }
            cursor += pileW * 0.6;
            continue;
          }
          const w = 0.07 + rand() * 0.06;
          cursor += w * 0.62;
          const along = cursor;
          const h = 0.28 + rand() * 0.24;
          const depth = 0.17 + rand() * 0.08;
          const pulled = rand() < 0.14 ? 0.05 + rand() * 0.05 : 0; // 偶尔抽出半截
          const tilt = rand() < 0.12 ? (rand() - 0.5) * 0.34 : 0; // 偶尔歪斜
          const bx = x + Math.cos(ry) * along + inward.x * pulled;
          const bz = z + Math.sin(ry) * along + inward.z * pulled;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, tilt));
          m.compose(new THREE.Vector3(bx, y + h / 2 + 0.04, bz), q, new THREE.Vector3(w, h, depth));
          inst.push({ m, c: pickColor() });
          cursor += w * 0.62;
        }
      }
    }
    return { uprights: up, shelves: sh, instances: inst };
  }, []);

  const meshRef = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const col = new THREE.Color();
    instances.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, col.copy(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <group>
      {uprights.map((u, i) => (
        <RoundedBox key={`u${i}`} args={[0.1, BOOKWALL.height, 0.46]} radius={0.018} smoothness={3} position={u.p} rotation={[0, u.ry, 0]} castShadow material={woodWarmMat}>
          {/* 框上一道极淡的暖金边：像灯光擦过木头的棱线，瞬间高级 */}
          <Edges threshold={18} scale={1.0}>
            <lineBasicMaterial color={PALETTE.brass} transparent opacity={0.16} toneMapped={false} />
          </Edges>
        </RoundedBox>
      ))}
      {/* 背板：一整片沿弧的曲面背墙，封住所有缝隙（墙成墙，书不再浮在星海里）*/}
      <mesh position={[0, BOOKWALL.height / 2, 0]} receiveShadow>
        <cylinderGeometry
          args={[BOOKWALL.radius + 0.34, BOOKWALL.radius + 0.34, BOOKWALL.height + 0.2, 64, 1, true, Math.PI / 2 - BOOKWALL.a1, BOOKWALL.a1 - BOOKWALL.a0]}
        />
        <meshStandardMaterial color={"#1c130c"} roughness={0.92} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>
      {/* 弧两端的封板：从观星台侧望过来曾是敞开的截面——隔板悬空、书浮在星上（审计 P2）*/}
      {[BOOKWALL.a0, BOOKWALL.a1].map((a, i) => {
        const ex = Math.cos(a) * (BOOKWALL.radius + 0.05);
        const ez = Math.sin(a) * (BOOKWALL.radius + 0.05);
        return (
          <mesh key={`cap${i}`} position={[ex, BOOKWALL.height / 2, ez]} rotation={[0, a + Math.PI / 2, 0]} castShadow material={woodWarmMat}>
            <boxGeometry args={[0.08, BOOKWALL.height + 0.2, 0.62]} />
          </mesh>
        );
      })}
      {shelves.map((s, i) => (
        <RoundedBox key={`s${i}`} args={[s.w, 0.05, 0.56]} radius={0.012} smoothness={2} position={s.p} rotation={[0, s.ry, 0]} material={woodMat} />
      ))}
      <instancedMesh ref={meshRef} args={[spineGeom, undefined, instances.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.82} metalness={0.0} />
      </instancedMesh>
      {/* 书墙暖补光（无影、克制）：给整面墙横向的可读层次，别让它糊成一块暗板。
          一盏只照得亮弧的中段——两端各补一盏，整面墙的书脊颜色才读得出来 */}
      <pointLight position={[-5.2, 2.2, -0.5]} color={PALETTE.lampWarm} intensity={2.2} distance={7} decay={2} />
      <pointLight position={[-5.6, 2.4, 4.2]} color={PALETTE.lampWarm} intensity={1.8} distance={6.5} decay={2} />
      <pointLight position={[-5.6, 2.4, -4.8]} color={PALETTE.lampWarm} intensity={1.8} distance={6.5} decay={2} />
    </group>
  );
}
