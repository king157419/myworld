import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three-stdlib";
import * as THREE from "three";
import { PALETTE, tideOffset } from "../../theme";
import { BOOK_COLORS } from "./profiles";

// 漂在镜面水上的旧书，随潮轻轻起伏、缓缓自转。是"记忆当作水来盛放"的具象。

export default function FloatingBooks() {
  const ref = useRef<THREE.Group>(null);
  const coverGeom = useMemo(() => new RoundedBoxGeometry(0.36, 0.075, 0.27, 2, 0.018), []);
  const books = useMemo(() => {
    const out: { x: number; z: number; ry: number; phase: number; color: string }[] = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.7;
      const r = 2.7 + (i % 4) * 1.25;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r - 0.5,
        ry: (i * 1.7) % (Math.PI * 2),
        phase: (i * 2.3) % (Math.PI * 2),
        color: BOOK_COLORS[i % BOOK_COLORS.length],
      });
    }
    return out;
  }, []);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    const tide = tideOffset(t);
    g.children.forEach((c, i) => {
      const b = books[i];
      c.position.y = 0.05 + Math.sin(t * 0.5 + b.phase) * 0.025 + tide * 0.6;
      c.rotation.y = b.ry + Math.sin(t * 0.12 + b.phase) * 0.12;
    });
  });
  return (
    <group ref={ref}>
      {books.map((b, i) => (
        <group key={i} position={[b.x, 0.05, b.z]} rotation={[0, b.ry, 0]}>
          <mesh geometry={coverGeom} castShadow>
            <meshStandardMaterial color={b.color} roughness={0.66} metalness={0.04} />
          </mesh>
          {/* 书口（纸页）：露出一圈奶白 */}
          <mesh position={[0, 0.004, 0]}>
            <boxGeometry args={[0.315, 0.062, 0.235]} />
            <meshStandardMaterial color={PALETTE.paperWarm} emissive={new THREE.Color(PALETTE.paperWarm)} emissiveIntensity={0.05} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
