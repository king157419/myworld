// 种子化伪随机（LCG）：舞台的"随机"必须可复现——同一个世界每次进来长一样，
// 截图可对比、HMR 不重排。Bookshelf 的发光书脊与 BookWall 的装饰书脊共用。
export function seededRng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
