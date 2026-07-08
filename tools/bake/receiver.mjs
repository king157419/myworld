// 烘焙管线的本地文件接收器（仅开发期工具，不进运行时）。
// 浏览器里的 devExport 把导出的 GLB / JSON POST 到这里，落盘到 tools/bake/work/。
// 用法：node tools/bake/receiver.mjs  （默认监听 127.0.0.1:5199）
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WORK = resolve(dirname(fileURLToPath(import.meta.url)), "work");
mkdirSync(WORK, { recursive: true });

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-filename");
  if (req.method === "OPTIONS") return res.end();
  if (req.method !== "POST" || req.url !== "/save") {
    res.statusCode = 404;
    return res.end("only POST /save");
  }
  const name = String(req.headers["x-filename"] ?? "out.bin").replace(/[^\w.-]/g, "_");
  const target = normalize(resolve(WORK, name));
  if (!target.startsWith(WORK)) {
    res.statusCode = 400;
    return res.end("bad name");
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    writeFileSync(target, buf);
    console.log(`saved ${name} (${buf.length} bytes)`);
    res.end(JSON.stringify({ ok: true, bytes: buf.length }));
  });
});

server.listen(5199, "127.0.0.1", () => console.log(`bake receiver on http://127.0.0.1:5199 -> ${WORK}`));
