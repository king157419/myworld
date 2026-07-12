import type { Zone, ZoneType } from "../../config/types";
import { useWorld } from "../../store/useWorld";
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
const COURT_MOOD: Record<string, MoodCfg> = {
  rainy: { bg: "#8b948d", fogColor: "#88918a", fogDensity: 0.052, ambClr: "#6d7a72", ambInt: 0.42, hemi: 0.52, key: 0.42, keyClr: "#aebcb2", rain: 1.0, rainVol: 0.5, windVol: 0.2, lampMul: 1.0, mist: "#93a09a" },
  cool: { bg: "#96a099", fogColor: "#909a92", fogDensity: 0.04, ambClr: "#71807a", ambInt: 0.48, hemi: 0.58, key: 0.55, keyClr: "#b4c2b8", rain: 0.6, rainVol: 0.34, windVol: 0.26, lampMul: 0.9, mist: "#9aa7a0" },
  warm: { bg: "#a2a897", fogColor: "#9aa091", fogDensity: 0.028, ambClr: "#83826d", ambInt: 0.52, hemi: 0.6, key: 0.62, keyClr: "#c8c6a8", rain: 0.3, rainVol: 0.22, windVol: 0.3, lampMul: 1.28, mist: "#a6ad9c" },
  neutral: { bg: "#98a09a", fogColor: "#929a93", fogDensity: 0.036, ambClr: "#77837c", ambInt: 0.5, hemi: 0.57, key: 0.56, keyClr: "#b8c2ba", rain: 0.5, rainVol: 0.3, windVol: 0.26, lampMul: 1.05, mist: "#9ca89f" },
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

      {/* 天光：阴天黄昏级冷灰绿（环境 + 半球 + 一盏冷向光主投影） */}
      <ambientLight intensity={cfg.ambInt} color={cfg.ambClr} />
      <hemisphereLight args={["#aeb8b0", "#3a4038", cfg.hemi]} />
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

      {/* 三个数据驱动 zone（按 type 分发；内容过滤/聚焦/登记全用 zone.id） */}
      {zones.map((zone) => {
        const Body = ZONE_BODY[zone.type];
        return Body ? <Body key={zone.id} zone={zone} low={low} /> : null;
      })}
    </>
  );
}
