import Lighting from "../../scene/Lighting";
import Sky from "../../scene/Sky";
import Vista from "../../scene/Vista";
import Water from "../../scene/Water";
import Gallery from "../../scene/gallery";
import Atmosphere from "../../scene/Atmosphere";
import Zones from "../../scene/zones/Zones";
import SunkenThoughts from "../../scene/SunkenThoughts";

// 潮汐图书馆的全部 3D 内容（原 Experience 里的场景子树，原样搬来）：
//   Sky 星空穹顶 · Vista 远景层 · Lighting 光/雾 · Gallery 建筑外壳（含高配 BakedShell）
//   · Water 镜面水 · Atmosphere 薄雾微尘 · SunkenThoughts 沉字光点 · Zones 数据驱动内容。
// 内部原样引用现组件（文件仍在 scene/，import 路径不动）——loft 切回去逐像素一致。
export default function LoftStage({ low }: { low: boolean }) {
  return (
    <>
      <Sky />
      <Vista />
      <Lighting low={low} />
      <Gallery low={low} />
      <Water low={low} />
      <Atmosphere />
      <SunkenThoughts />
      <Zones />
    </>
  );
}
