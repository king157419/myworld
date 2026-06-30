import Experience from "./scene/Experience";
import Hud from "./ui/Hud";
import { usePersistence } from "./hooks/usePersistence";

// 布局：全屏 3D 画布 + DOM 覆盖层 UI。水合完成前盖一层"落入"提示。
export default function App() {
  const ready = usePersistence();
  return (
    <div className="app">
      <Experience />
      <Hud />
      {!ready && (
        <div className="boot">
          <div className="boot-text">正在落入你的灵境…</div>
        </div>
      )}
    </div>
  );
}
