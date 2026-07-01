import { useMemo } from "react";
import * as THREE from "three";
import { Environment, Lightformer } from "@react-three/drei";
import { DECK_Y, GRAMOPHONE, PALETTE } from "../theme";

// 夜的光：冷的月作主光（唯一投影），暖的灯由 Gallery 的 pointLight / 自发光球承担。
// 背景交给 Sky 的星空穹顶（不设纯色背景）；近水雾由 Atmosphere 处理。
// IBL 用 drei Environment 内联 Lightformer 现烤——不下载任何 HDRI，离线可跑，
// 给黄铜 / 留声机喇叭一点冷暖相间的高光。
export default function Lighting({ low = false }: { low?: boolean }) {
  const moonPos = useMemo(() => new THREE.Vector3(-0.5, 0.18, -1).normalize().multiplyScalar(42), []);
  const shadow = low ? 1024 : 2048;
  return (
    <group>
      <ambientLight intensity={0.32} color={"#5a6ea0"} />
      <hemisphereLight args={["#2c3f72", "#0a0d16", 0.92]} />
      <directionalLight
        position={moonPos.toArray()}
        intensity={0.95}
        color={"#b7c6ea"}
        castShadow
        shadow-mapSize-width={shadow}
        shadow-mapSize-height={shadow}
        shadow-camera-near={1}
        shadow-camera-far={95}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* 观星台暖色补光：给台子和留声机一点存在感与停留的暖意（锚在 GRAMOPHONE 邻域，挪留声机时跟着走） */}
      <pointLight position={[GRAMOPHONE[0], DECK_Y + 1.3, GRAMOPHONE[2] + 0.2]} color={PALETTE.lampWarm} intensity={4.5} distance={9} decay={2} />
      {/* 广场低位暖溢光：贴着水面抬一点暗部，但不投影、范围克制 */}
      <pointLight position={[0, 0.8, 1.5]} color={"#ffca82"} intensity={1.6} distance={9} decay={2} />
      {/* 更厚的 IBL：黄铜/金属现在能反射到"暖灯池 + 冷天 + 暖地"，不再是死黑；
          ring 形给喇叭一道可信的圆弧高光。仍是程序化、离线、贴本作冷暖调。 */}
      <Environment resolution={low ? 96 : 256} frames={1}>
        {/* 冷天穹（顶） */}
        <Lightformer intensity={0.55} color={"#26396a"} position={[0, 10, 0]} scale={[30, 30, 1]} target={[0, 0, 0]} />
        {/* 主暖光池（书墙一侧，最强反射来源） */}
        <Lightformer form="rect" intensity={1.6} color={PALETTE.lampWarm} position={[-6, 2.2, 3]} scale={[8, 8, 1]} target={[0, 1.2, 0]} />
        {/* 观星台暖光池（留声机黄铜的暖反射） */}
        <Lightformer form="ring" intensity={1.5} color={PALETTE.glowAmber} position={[1.5, 2.6, -6]} scale={[5, 5, 1]} target={[0, 1.6, -9]} />
        {/* 冷侧补（浮岛一侧，给金属冷暖相间） */}
        <Lightformer form="rect" intensity={0.6} color={"#9fb6e0"} position={[6, 3, -6]} scale={[9, 9, 1]} target={[0, 1, 0]} />
        {/* 暖地反射（水面把暖意反上来，金属底面不死黑） */}
        <Lightformer intensity={0.35} color={"#3a2a18"} position={[0, -2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[26, 26, 1]} />
      </Environment>
    </group>
  );
}
