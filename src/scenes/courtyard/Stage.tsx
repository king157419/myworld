import type { Zone, ZoneType } from "../../config/types";
import { useWorld } from "../../store/useWorld";
import { COURT_PALETTE } from "./materials";
import { STUDY, Y_STUDY } from "./theme";
import Backdrop from "./Backdrop";
import Shell from "./Shell";
import Pool from "./Pool";
import Bamboo from "./Bamboo";
import Garden from "./Garden";
import Rain from "./Rain";
import { PaperLantern } from "./lamps";
import CourtyardBookshelf from "./Bookshelf";
import CourtyardObjectShelf from "./ObjectShelf";
import Guqin from "./Guqin";
import { useCourtyardAudio } from "./useCourtyardAudio";

// 雾中山居 · v1 成品舞台。
// 满分锚：雾三层（近清晰 FogExp2 / 中景灰绿雾墙 / 远山剪影，见 Backdrop）× 色域锁死灰绿-宣白-墨黑 ×
//   纸灯是唯一暖点且低亮度 × 黛瓦雨湿微反光受光不纯黑 × 深墨绿水池 × 屋里暖 / 院里冷。
// 光照预算：唯一投影主灯 = 冷天光 directional（!low）；纸灯 + 内容灯一律不投影。
// 天光是阴天黄昏级别的冷灰绿——外冷；书房里靠纸灯与内容灯的暖，进出成双色对比。

// 心境映射（四档必须可感知且不崩）：绕「冷灰绿天光 × 暖纸灯（恒定暖）」摆动雾/雨/醇度。
interface MoodCfg {
  bg: string;
  fogColor: string;
  fogDensity: number;
  ambClr: string;
  ambInt: number;
  hemi: number;
  key: number;
  keyClr: string;
  rain: number;
  rainVol: number;
  windVol: number;
  lampMul: number;
  mist: string;
}
// 评审 R12·C6：整体天色偏白日 → 往黄昏压一档（天空/半球光降亮度、色温微暖灰），
// 让纸灯「唯一暖点」的对比立起来；压完仍可读（阴天黄昏，不是夜）。
const COURT_MOOD: Record<string, MoodCfg> = {
  rainy: { bg: "#78817a", fogColor: "#747c76", fogDensity: 0.052, ambClr: "#66706a", ambInt: 0.34, hemi: 0.42, key: 0.4, keyClr: "#aeb0a0", rain: 1.0, rainVol: 0.5, windVol: 0.2, lampMul: 1.08, mist: "#828f88" },
  cool: { bg: "#7f8a82", fogColor: "#7b857e", fogDensity: 0.04, ambClr: "#6a7972", ambInt: 0.39, hemi: 0.47, key: 0.5, keyClr: "#adb6ab", rain: 0.6, rainVol: 0.34, windVol: 0.26, lampMul: 0.98, mist: "#8b978f" },
  warm: { bg: "#8c9080", fogColor: "#84887a", fogDensity: 0.028, ambClr: "#7a7860", ambInt: 0.44, hemi: 0.5, key: 0.56, keyClr: "#bebc9e", rain: 0.3, rainVol: 0.22, windVol: 0.3, lampMul: 1.36, mist: "#969c8b" },
  neutral: { bg: "#7f877f", fogColor: "#7b837c", fogDensity: 0.036, ambClr: "#6f7b74", ambInt: 0.41, hemi: 0.47, key: 0.5, keyClr: "#b0bab1", rain: 0.5, rainVol: 0.3, windVol: 0.26, lampMul: 1.12, mist: "#8f9a92" },
};

const ZONE_BODY: Record<ZoneType, (p: { zone: Zone; low?: boolean }) => React.JSX.Element> = {
  bookshelf: CourtyardBookshelf,
  objects: CourtyardObjectShelf,
  record: Guqin,
};

export default function CourtyardStage({ low }: { low: boolean }) {
  const zones = useWorld((s) => s.world.zones);
  const mood = useWorld((s) => s.world.room.mood.lighting);
  const cfg = COURT_MOOD[mood] ?? COURT_MOOD.rainy;

  // 声床：雨打瓦 + 竹叶风（两层叠加）+ 古琴（随 musicPlaying）。
  useCourtyardAudio(cfg.rainVol, cfg.windVol);

  const eaveY = Y_STUDY + STUDY.wallH; // 檐口高度参考

  return (
    <>
      <color attach="background" args={[cfg.bg]} />
      {/* 雾三层之近层：FogExp2（灰绿）——近清晰、中景褪色。天空/水池/远山/雾墙各自 fog=false 不受它。 */}
      <fogExp2 attach="fog" args={[cfg.fogColor, cfg.fogDensity]} />

      {/* 天光：阴天黄昏级冷灰绿（环境 + 半球 + 一盏冷向光主投影）——天顶色压暗一档偏暖灰（评审 R12·C6） */}
      <ambientLight intensity={cfg.ambInt} color={cfg.ambClr} />
      <hemisphereLight args={["#98a29a", "#363c34", cfg.hemi]} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={cfg.key}
        color={cfg.keyClr}
        castShadow={!low}
        shadow-mapSize-width={low ? 512 : 1024}
        shadow-mapSize-height={low ? 512 : 1024}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />

      {/* 围墙外的远方：中景雾墙 + 三层远山剪影 */}
      <Backdrop mistColor={cfg.mist} low={low} />

      {/* 建筑外壳（围墙 + 月洞门 + 石径 + 书房 + 石阶）+ 竹 + 松石 */}
      <Shell />
      <Bamboo low={low} />
      <Garden low={low} />

      {/* 浅水池（深墨绿静水 + 雨涟漪） */}
      <Pool rain={cfg.rain} low={low} />

      {/* 细雨 + 檐口滴水线 */}
      <Rain rain={cfg.rain} low={low} />

      {/* 纸灯：庭院檐口一盏（全场唯一暖点，低亮度，雾里晕开） */}
      <PaperLantern position={[1.85, eaveY - 0.35, STUDY.zFront + 0.06]} intensity={3.4} distance={4.0} scale={1.0} mul={cfg.lampMul} low={low} />
      {/* 书房内一盏（屋内主暖光，把矮几浸暖、透过格窗渗出「屋里暖」） */}
      <PaperLantern position={[0, Y_STUDY + STUDY.wallH - 0.5, -4.7]} intensity={3.6} distance={3.8} scale={0.95} mul={cfg.lampMul} low={low} />
      {/* 书房顶部极低补光（评审 R12·C3）：把坡顶底面 / 博古架顶板 / 后角从纯黑里托出，仍暗 */}
      {!low && (
        <pointLight userData={{ ljBake: "content" }} position={[0, Y_STUDY + 2.5, -5.3]} color={COURT_PALETTE.lampWarm} intensity={0.55} distance={5.5} decay={2} />
      )}

      {/* 三个数据驱动 zone（按 type 分发；内容过滤/聚焦/登记全用 zone.id） */}
      {zones.map((zone) => {
        const Body = ZONE_BODY[zone.type];
        return Body ? <Body key={zone.id} zone={zone} low={low} /> : null;
      })}
    </>
  );
}
