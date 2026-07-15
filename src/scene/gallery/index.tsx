import GramophoneModel from "../GramophoneModel";
import TelescopeModel from "../TelescopeModel";
import Lanterns from "./Lanterns";
import BookWall from "./BookWall";
import Deck from "./Deck";
import Lectern from "./Lectern";
import Pedestals from "./Pedestals";
import FloatingBooks from "./FloatingBooks";
import ListeningNook from "./ListeningNook";
import BakedShell, { hasBakedShell } from "./BakedShell";

// 舞台（authored）：潮汐图书馆的建筑外壳，按陈设一件一个文件：
//   Lanterns 环广场灯笼 · BookWall 书墙骨架 · Deck 观星台+坡道 · Lectern 写作台
//   Pedestals 浮岛基座 · FloatingBooks 漂浮书 · ListeningNook 听歌角 · GramophoneModel 留声机(GLB)
// 共用件在 profiles.ts（车削轮廓）与 materials.ts（黄铜/木/纸单例材质）。
// 几何常量一律来自 theme.ts → walk.ts 碰撞与视觉永远一致。用户内容由 zones/* 数据驱动叠加。
//
// 高画质档：静态壳换成 BakedShell（Blender 分灯 lightmap，见 tools/bake/），
// 各组件收到 baked=true 时跳过被替换的静态网格，灯/光晕/自发光件照常。
// 低画质档或烘焙产物缺席时完全回退程序化渲染（和从前逐像素一致）。

export default function Gallery({ low = false }: { low?: boolean }) {
  const baked = !low && hasBakedShell;
  return (
    <group>
      <Lanterns baked={baked} />
      <BookWall baked={baked} />
      <Deck baked={baked} />
      <Lectern />
      <Pedestals baked={baked} />
      <FloatingBooks />
      <GramophoneModel />
      <TelescopeModel />
      <ListeningNook />
      {baked && <BakedShell />}
    </group>
  );
}
