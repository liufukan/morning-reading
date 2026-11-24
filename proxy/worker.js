// Cloudflare Worker：翻译代理。key 只存在环境变量 USTC_API_KEY（wrangler secret put），
// 浏览器 never 见到 key。部署: npx wrangler deploy && npx wrangler secret put USTC_API_KEY
const ALLOWED_ORIGINS = [
  "https://liufukan.github.io",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];
const ALLOWED_MODELS = ["qwen3.8-chat", "deepseek-flash", "glm-5.3-flash", "smart/default"];
const UPSTREAM = "https://api.llm.ustc.edu.cn/v1/chat/completions";
const RATE_LIMIT = 30; // 每 IP 每分钟
const hits = new Map();

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.reset > 60000) {
    hits.set(ip, { count: 1, reset: now });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin not allowed" }, 403, origin);
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, origin);
    if (!env.USTC_API_KEY) return json({ error: "proxy key not configured" }, 500, origin);
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    if (rateLimited(ip)) return json({ error: "rate limited" }, 429, origin);

    let payload;
    try {
      payload = JSON.parse(await request.text());
    } catch {
      return json({ error: "bad json" }, 400, origin);
    }
    if (!ALLOWED_MODELS.includes(payload.model)) return json({ error: "model not allowed" }, 400, origin);
    payload.stream = true;

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.USTC_API_KEY },
      body: JSON.stringify(payload),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-store",
      },
    });
  },
};