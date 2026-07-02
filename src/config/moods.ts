import type { Mood } from "./types";

// 心境 → 氛围的唯一真相源。之前 Hud 的 fog 表和 defaultWorld 是两份漂移副本，
// 而且场景没有任何组件消费 mood——四个心境按钮是纯视觉空操作（只默默落盘）。
// 现在 Lighting（雾/环境光/暖灯）与 Atmosphere（薄雾/远雷）都读这张表。
//
// 基准是 cool（默认世界的主基调：冷夜镜面水 + 暖灯回廊）——cool 的取值即"改动前的样子"，
// 其余三档围绕它做克制的偏移：暖=灯更醇、雾更薄；中=更素净；雨=雾浓、光冷、远雷偶鸣。

export interface MoodPreset {
  /** 按钮上的单字。 */
  label: string;
  /** 持久化进 world.room.mood.fog 的参数（数据契约维持不变）。 */
  fog: number;
  /** 场景雾（FogExp2）密度与颜色。天空/水面是自定义 shader 不受雾影响——星空始终清澈，雾只吃回廊。 */
  fogDensity: number;
  fogColor: string;
  /** 环境光色温与强度乘子（基准 0.32）。 */
  ambientColor: string;
  ambientMul: number;
  /** 半球光强度（基准 0.92）。 */
  hemiIntensity: number;
  /** Lighting 里两盏暖补光的强度乘子。 */
  lampMul: number;
  /** 薄雾颜色与浓度乘子。 */
  mistColor: string;
  mistMul: number;
  /** 偶发远雷（雨夜）。 */
  thunder: boolean;
}

export const MOOD_PRESETS: Record<Mood, MoodPreset> = {
  rainy: {
    label: "雨",
    fog: 0.32,
    fogDensity: 0.038,
    fogColor: "#0c1220",
    ambientColor: "#48587e",
    ambientMul: 0.85,
    hemiIntensity: 0.72,
    lampMul: 0.85,
    mistColor: "#7e93b8",
    mistMul: 2.0,
    thunder: true,
  },
  warm: {
    label: "暖",
    fog: 0.2,
    fogDensity: 0.01,
    fogColor: "#151222",
    ambientColor: "#6f6494",
    ambientMul: 1.0,
    hemiIntensity: 0.92,
    lampMul: 1.28,
    mistColor: "#a89db8",
    mistMul: 0.85,
    thunder: false,
  },
  cool: {
    label: "冷",
    fog: 0.28,
    fogDensity: 0.014,
    fogColor: "#0e1526",
    ambientColor: "#5a6ea0",
    ambientMul: 1.0,
    hemiIntensity: 0.92,
    lampMul: 1.0,
    mistColor: "#9fb6d8",
    mistMul: 1.0,
    thunder: false,
  },
  neutral: {
    label: "中",
    fog: 0.18,
    fogDensity: 0.011,
    fogColor: "#10141f",
    ambientColor: "#5f6a92",
    ambientMul: 0.92,
    hemiIntensity: 0.84,
    lampMul: 1.08,
    mistColor: "#93a8c8",
    mistMul: 0.8,
    thunder: false,
  },
};

/** UI 展示顺序。 */
export const MOOD_ORDER: readonly Mood[] = ["rainy", "warm", "cool", "neutral"];
