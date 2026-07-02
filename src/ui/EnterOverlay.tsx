// 入场遮罩 · 题词页：华文中宋大字 + 琥珀横线 + 散文场景描述。
export default function EnterOverlay({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="overlay enter-overlay">
      <div className="enter-card">
        {/* 眉题：华文仿宋，像内页刊头 */}
        <span className="brand-eyebrow">潮汐图书馆　The Tide Library</span>

        {/* 大标题 — 华文中宋大字 */}
        <h1 className="brand-xl">灵境</h1>

        {/* 琥珀横线 — 左对齐 */}
        <div className="enter-rule" aria-hidden />

        {/* 场景描述 — 华文楷体，散文语感 */}
        <p className="enter-desc">
          夜里，一座暖灯的读书回廊，浮在一片映满星空的镜面水上。走上去——脚下是整片星海，每一步都荡开一圈涟漪。一墙旧书，几座浮岛，一台留声机正低低地转。
        </p>

        {/* 进入按钮 */}
        <button className="enter-btn" onClick={onEnter}>
          进入
        </button>

        {/* 出版信息行 */}
        <span className="brand-sub">INNERSCAPE · OFFLINE · PERSONAL</span>

        {/* 键位提示 */}
        <div className="enter-hint">WASD 行走 · 鼠标环视 · 建议戴耳机</div>
      </div>
    </div>
  );
}
