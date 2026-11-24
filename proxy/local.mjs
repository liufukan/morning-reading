// 本地调试代理：node proxy/local.mjs  （真实转发需环境变量 USTC_API_KEY）
// 无 key 且 MOCK=1 时返回 canned SSE，用于无密钥验证前端流式链路。
import http from "node:http";
const PORT = 5174;
const ALLOWED = ["https://liufukan.github.io", "http://127.0.0.1:5173", "http://localhost:5173"];
const MODELS = ["qwen3.8-chat", "deepseek-flash", "glm-5.3-flash", "smart/default"];
const KEY = process.env.USTC_API_KEY || "";
const MOCK = process.env.MOCK === "1";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (req.method === "OPTIONS") { res.writeHead(204, cors(origin)); res.end(); return; }
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json", ...cors(origin) }); res.end(JSON.stringify(obj)); };
  if (!ALLOWED.includes(origin)) return send(403, { error: "origin not allowed" });
  if (req.method !== "POST") return send(405, { error: "method not allowed" });
  let body = "";
  for await (const c of req) body += c;
  let payload;
  try { payload = JSON.parse(body); } catch { return send(400, { error: "bad json" }); }
  if (!MODELS.includes(payload.model)) return send(400, { error: "model not allowed" });

  if (!KEY && MOCK) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", ...cors(origin) });
    const pieces = ["你好", "，世界", "。这是", "测试译文", "。"];
    for (const p of pieces) {
      res.write("data: " + JSON.stringify({ choices: [{ delta: { content: p } }] }) + "\n\n");
      await new Promise((r) => setTimeout(r, 60));
    }
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  if (!KEY) return send(500, { error: "proxy key not configured" });
  payload.stream = true;
  const up = await fetch("https://api.llm.ustc.edu.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
    body: JSON.stringify(payload),
  });
  res.writeHead(up.status, { "Content-Type": up.headers.get("content-type") || "text/event-stream", "Cache-Control": "no-store", ...cors(origin) });
  const reader = up.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
  res.end();
}).listen(PORT, "127.0.0.1", () => console.log("proxy on " + PORT + (KEY ? " (live)" : MOCK ? " (mock)" : " (no key)")));