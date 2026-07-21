import { useEffect } from "react";
import { useWorld } from "../store/useWorld";
import { SCENE_DATA, resolveScene } from "../scenes/registryData";
import { audioEngine } from "./engine";
import { useAudio } from "./useAudio";

// 场景音频档的唯一应用点：订阅 world.room.style，进场即把引擎三旋钮
// （水床增益 / 音乐总线曲库+响度 / 空间化锚点）拨到该场景的档位。
//
// 为什么集中在这里而不是各场景 Stage 的 mount/unmount：
//   · 旧模式「mount 改、unmount 恢复 loft」在 attic→courtyard 这类切换里会经由 loft
//     兜一圈（白白重拉夜曲字节、曲库/锚点瞬时错位），恢复目标也硬编码死了 loft；
//   · 挂在 App 层（Canvas 外）→ 首次启动落在非 loft 场景时同样生效，不依赖 Stage 挂载时序；
//   · 引擎三个接口都容忍未 start（先记下，start() 采用最新值），所以进场早于「进入」手势也安全。
//
// 曲库经 useAudio.setLibrary 走（同步 RecordPanel 曲目单镜像）；同库引用是空操作，
// 场景档里的 tracks 是模块级常量 → 重进同场景零开销。
export function useSceneAudio(): void {
  const style = useWorld((s) => s.world.room.style);
  const setLibrary = useAudio((s) => s.setLibrary);
  useEffect(() => {
    const p = SCENE_DATA[resolveScene(style)].audio;
    audioEngine.setMusicGain(p.musicGain ?? 1);
    audioEngine.setMusicPosition(p.musicPos);
    audioEngine.setWaterGain(p.waterGain);
    setLibrary(p.tracks);
  }, [style, setLibrary]);
}
