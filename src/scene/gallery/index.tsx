import GramophoneModel from "../GramophoneModel";
import Lanterns from "./Lanterns";
import BookWall from "./BookWall";
import Deck from "./Deck";
import Lectern from "./Lectern";
import Pedestals from "./Pedestals";
import FloatingBooks from "./FloatingBooks";
import ListeningNook from "./ListeningNook";

// 舞台（authored）：潮汐图书馆的建筑外壳，按陈设一件一个文件：
//   Lanterns 环广场灯笼 · BookWall 书墙骨架 · Deck 观星台+坡道 · Lectern 写作台
//   Pedestals 浮岛基座 · FloatingBooks 漂浮书 · ListeningNook 听歌角 · GramophoneModel 留声机(GLB)
// 共用件在 profiles.ts（车削轮廓）与 materials.ts（黄铜/木/纸单例材质）。
// 几何常量一律来自 theme.ts → walk.ts 碰撞与视觉永远一致。用户内容由 zones/* 数据驱动叠加。

export default function Gallery() {
  return (
    <group>
      <Lanterns />
      <BookWall />
      <Deck />
      <Lectern />
      <Pedestals />
      <FloatingBooks />
      <GramophoneModel />
      <ListeningNook />
    </group>
  );
}
