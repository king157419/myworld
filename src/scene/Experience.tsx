import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import Lighting from "./Lighting";
import Sky from "./Sky";
import Water from "./Water";
import Gallery from "./Gallery";
import Atmosphere from "./Atmosphere";
import Zones from "./zones/Zones";
import SunkenThoughts from "./SunkenThoughts";
import PlayerControls from "./PlayerControls";
import PostFX from "./PostFX";
import { useWorld } from "../store/useWorld";
import { useAudio } from "../audio/useAudio";

// 仅开发期：把 renderer/scene/camera/store 暴露到 window，便于无头/隐藏页验证。
// 副作用放进 useEffect（render 纯净），db 桥只引入一次。
function DevBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const advance = useThree((s) => s.advance);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const w = window as unknown as { __lj?: unknown; __ljStore?: unknown; __ljAudio?: unknown; __THREE?: unknown; __ljDb?: unknown };
    w.__lj = { gl, scene, camera, advance, invalidate };
    w.__ljStore = useWorld;
    w.__ljAudio = useAudio;
    w.__THREE = THREE;
    void import("../data/db").then((db) => {
      w.__ljDb = db;
    });
  }, [gl, scene, camera, advance, invalidate]);
  return null;
}

// 低端探测：粗略按 CPU 核数 / 内存 / 移动端起步降级；运行时再由 PerformanceMonitor 收紧。
function probeLowEnd(): boolean {
  try { if (import.meta.env.DEV && localStorage.getItem("lj_forceLow") === "1") return true; } catch { /* ignore */ }
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile || cores <= 4 || mem <= 4;
}

export default function Experience() {
  const lowStart = useRef(probeLowEnd());
  const [low, setLow] = useState(lowStart.current);
  const [dpr, setDpr] = useState(1); // 保守起步，由 PerformanceMonitor 视余量爬升（drei 推荐：低起、有余量再升）

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 1.6, 7], fov: 58, near: 0.08, far: 120 }}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
        // 仅在需要无头截图验证时开（toDataURL 需要它）；默认关，preserveDrawingBuffer 会拖累 dev 实时帧率。
        preserveDrawingBuffer:
          import.meta.env.DEV &&
          ((window as unknown as { __ljCapture?: boolean }).__ljCapture === true ||
            (() => { try { return localStorage.getItem("lj_capture") === "1"; } catch { return false; } })()),
      }}
    >
      {/* 掉帧时：降 dpr + 切到低画质（关反射地板 / 关景深 / 关 MSAA / 缩小阴影）。回升只提 dpr，不反复切画质避免抖动。 */}
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setLow(true);
        }}
        onIncline={() => setDpr((d) => Math.min(low ? 1 : 1.5, Math.max(d, 1)))}
      />
      <Suspense fallback={null}>
        <Sky />
        <Lighting low={low} />
        <Gallery />
        <Water low={low} />
        <Atmosphere />
        <SunkenThoughts />
        <Zones />
      </Suspense>
      <PlayerControls />
      <PostFX low={low} />
      {import.meta.env.DEV && <DevBridge />}
    </Canvas>
  );
}
