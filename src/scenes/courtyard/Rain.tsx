import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STUDY, WALL, Y_STUDY } from "./theme";
import { seededRng } from "../../scene/rng";

// 细雨（比 loft 雨夜克制）+ 檐口滴水线。满分锚：雨是密而小的实心水丝 / 水珠（非发光大圈——场景 A 教训），
// 灰白低透明、非加色（读作水不是光）；檐口的雨从瓦沿成串滴落。

const rainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#b7c1bb"), transparent: true, opacity: 0.34, depthWrite: false, fog: true });
const dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#c4cdc7"), transparent: true, opacity: 0.6, depthWrite: false, fog: true });

/** 细雨帘：一体积内的下落水丝，逐帧循环（1 次绘制）。 */
function Curtain({ rain, low }: { rain: number; low: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = low ? 160 : 300;
  const { geom, data } = useMemo(() => {
    const rand = seededRng(9001);
    const data = new Float32Array(N * 4); // x, y, z, speed
    for (let i = 0; i < N; i++) {
      data[i * 4] = (rand() - 0.5) * 17;
      data[i * 4 + 1] = rand() * 8;
      data[i * 4 + 2] = (rand() - 0.5) * 17;
      data[i * 4 + 3] = 5.5 + rand() * 3.5;
    }
    const geom = new THREE.BoxGeometry(0.006, 0.3, 0.006);
    return { geom, data };
  }, [N]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < N; i++) {
      let y = data[i * 4 + 1] - data[i * 4 + 3] * d;
      if (y < 0) {
        y += 8;
        data[i * 4] = (Math.random() - 0.5) * 17;
        data[i * 4 + 2] = (Math.random() - 0.5) * 17;
      }
      data[i * 4 + 1] = y;
      dummy.position.set(data[i * 4], y, data[i * 4 + 2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.34 * rain;
  });
  return <instancedMesh ref={ref} args={[geom, rainMat, N]} frustumCulled={false} />;
}

/** 檐口滴水线：沿瓦沿成串滴落的小水珠（书房前后檐 + 围墙顶几处）。 */
function Drips({ rain }: { rain: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const eaveY = Y_STUDY + STUDY.wallH + 0.05;
  const cols = useMemo(() => {
    const rand = seededRng(4242);
    // [x, yTop, z, groundY, phase]
    const out: [number, number, number, number, number][] = [];
    const addLine = (z: number, yTop: number, groundY: number, x0: number, x1: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) / n) * (x1 - x0) + (rand() - 0.5) * 0.1;
        out.push([x, yTop, z, groundY, rand()]);
      }
    };
    // 书房前檐（罩住廊，落到台基）
    addLine(STUDY.zFront + 0.35, eaveY, Y_STUDY, -3.0, 3.0, 11);
    // 书房后檐（落到地）
    addLine(STUDY.zBack - 0.5, eaveY, 0, -3.0, 3.0, 7);
    // 东西围墙顶各一段（近院门侧）
    addLine(4.5, WALL.height, 0, -WALL.x + 0.2, -WALL.x + 0.2, 1);
    addLine(4.5, WALL.height, 0, WALL.x - 0.2, WALL.x - 0.2, 1);
    return out;
  }, [eaveY]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useRef<Float32Array>(new Float32Array(cols.map((c) => c[4])));
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < cols.length; i++) {
      const [x, yTop, z, groundY] = cols[i];
      let p = phase.current[i] + d * 0.9;
      if (p > 1) p -= 1;
      phase.current[i] = p;
      const y = yTop - p * (yTop - groundY);
      dummy.position.set(x, y, z);
      const stretch = 1 + p * 2.2; // 越落越拉长
      dummy.scale.set(1, stretch, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * rain;
  });
  const geom = useMemo(() => new THREE.CylinderGeometry(0.012, 0.006, 0.12, 6), []);
  return <instancedMesh ref={ref} args={[geom, dropMat, cols.length]} frustumCulled={false} />;
}

export default function Rain({ rain = 1, low = false }: { rain?: number; low?: boolean }) {
  if (rain <= 0.01) return null;
  return (
    <group>
      <Curtain rain={rain} low={low} />
      <Drips rain={rain} />
    </group>
  );
}
