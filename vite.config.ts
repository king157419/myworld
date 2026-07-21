/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.BASE_PATH ?? "/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // three 核心单拎一个 chunk：它最大、也最少变——app 代码日常迭代时，
    // 回头客的浏览器还能命中 three chunk 的缓存（配合内容哈希文件名）。
    // 其余 node_modules 归入 vendor；场景 Stage 由 React.lazy 各自成 chunk（见 scenes/registry.ts）。
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return "three";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
