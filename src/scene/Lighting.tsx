import { useMemo } from "react";
import * as THREE from "three";
import { Environment, Lightformer } from "@react-three/drei";
import { DECK_Y, GRAMOPHONE, PALETTE } from "../theme";
import { useWorld } from "../store/useWorld";
import { MOOD_PRESETS } from "../config/moods";

// 夜的光：冷的月作主光（唯一投影），暖的灯由 Gallery 的 pointLight / 自发光球承担。
// 背景交给 Sky 的星空穹顶（不设纯色背景）；近水雾由 Atmosphere 处理。
// IBL 用 drei Environment 内联 Lightformer 现烤——不下载任何 HDRI，离线可跑。
//
// 心境（world.room.mood）在此消费：场景雾密度/色、环境光色温、暖补光强度按 MOOD_PRESETS 调制。
// 月光与 IBL 保持恒定（它们是场景的锚，逐 mood 重烤 IBL 会卡顿）。
export default function Lighting({ low = false }: { low?: boolean }) {
  const mood = useWorld((s) => s.world.room.mood.lighting);
  const preset = MOOD_PRESETS[mood] ?? MOOD_PRESETS.cool;
  const moonPos = useMemo(() => new THREE.Vector3(-0.5, 0.18, -1).normalize().multiplyScalar(42), []);
  const shadow = low ? 1024 : 2048;
  return (
    <>
      {/* 场景雾：attach 到 scene（Lighting 的 JSX 父级）——只吃标准材质（回廊木/铜/石），
          天空与水是自定义 shader 不受雾影响，星海始终清澈 */}
      <fogExp2 attach="fog" args={[preset.fogColor, preset.fogDensity]} />
      <group>
      {/* 环境地板：0.32 时中间调死黑（书墙近看是黑褐糊团），抬到 0.42 暗部才有信息；夜的感觉交给对比与色温 */}
      <ambientLight intensity={0.42 * preset.ambientMul} color={preset.ambientColor} />
      <hemisphereLight args={["#33477e", "#0d1119", preset.hemiIntensity * 1.25]} />
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
      <pointLight position={[GRAMOPHONE[0], DECK_Y + 1.3, GRAMOPHONE[2] + 0.2]} color={PALETTE.lampWarm} intensity={4.5 * preset.lampMul} distance={9} decay={2} />
      {/* 广场低位暖溢光：贴着水面抬一点暗部。反射水面上它会积成大团镜面光潭——1.6 太满，收到 1.0 */}
      <pointLight position={[0, 0.8, 1.5]} color={"#ffca82"} intensity={1.0 * preset.lampMul} distance={9} decay={2} />
      {/* 更厚的 IBL：黄铜/金属反射"暖灯池 + 冷天 + 暖地"，不死黑；ring 形给喇叭一道可信的圆弧高光。
          第十轮整体加厚 ~40%：留声机喇叭大片死黑的根因就是 env 无东西可反。 */}
      <Environment resolution={low ? 96 : 256} frames={1}>
        {/* 冷天穹（顶） */}
        <Lightformer intensity={0.75} color={"#26396a"} position={[0, 10, 0]} scale={[30, 30, 1]} target={[0, 0, 0]} />
        {/* 主暖光池（书墙一侧，最强反射来源） */}
        <Lightformer form="rect" intensity={2.2} color={PALETTE.lampWarm} position={[-6, 2.2, 3]} scale={[8, 8, 1]} target={[0, 1.2, 0]} />
        {/* 观星台暖光池（留声机黄铜的暖反射） */}
        <Lightformer form="ring" intensity={2.0} color={PALETTE.glowAmber} position={[1.5, 2.6, -6]} scale={[5, 5, 1]} target={[0, 1.6, -9]} />
        {/* 冷侧补（浮岛一侧，给金属冷暖相间） */}
        <Lightformer form="rect" intensity={0.85} color={"#9fb6e0"} position={[6, 3, -6]} scale={[9, 9, 1]} target={[0, 1, 0]} />
        {/* 暖地反射（水面把暖意反上来，金属底面不死黑） */}
        <Lightformer intensity={0.55} color={"#4a3520"} position={[0, -2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[26, 26, 1]} />
      </Environment>
      </group>
    </>
  );
}
