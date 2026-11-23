"use strict";

// 密钥公开在前端：审核码只防 P 图/随手伪造，挡不住扒 JS 提取密钥的技术性伪造。
const MR_CODE_KEY = "MR-2026-k7Q2m9X4pA-vN3bR8tY5wZ1";
const MR_B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MR_THRESHOLD = 30 * 60 * 1000;

function mrBase32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += MR_B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += MR_B32[(value << (5 - bits)) & 31];
  return out;
}

function mrBase32Decode(s) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    const idx = MR_B32.indexOf(ch);
    if (idx < 0) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function mrNormalizeCode(s) {
  return String(s).toUpperCase().replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1").replace(/O/g, "0");
}

function mrWriteU32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function mrReadU32(b, off) {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

async function mrSign(msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(MR_CODE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// 码 = base32(开始秒[4] + 结束秒[4] + 有效秒[4] + HMAC(学号|开始|结束|有效)截断[6])，共 18 字节 → 29 位。
async function mrComputeCode(id, startMs, endMs, activeMs) {
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);
  const activeSec = Math.floor(activeMs / 1000);
  const sig = await mrSign([id, startSec, endSec, activeSec].join("|"));
  const bytes = new Uint8Array([
    ...mrWriteU32(startSec), ...mrWriteU32(endSec), ...mrWriteU32(activeSec), ...sig.slice(0, 6),
  ]);
  const b32 = mrBase32(bytes);
  return [
    b32.slice(0, 5), b32.slice(5, 10), b32.slice(10, 15),
    b32.slice(15, 20), b32.slice(20, 25), b32.slice(25),
  ].join("-");
}

async function mrCheckCode(id, codeStr) {
  const bytes = mrBase32Decode(mrNormalizeCode(codeStr));
  if (!bytes || bytes.length !== 18) return { match: false };
  const startSec = mrReadU32(bytes, 0);
  const endSec = mrReadU32(bytes, 4);
  const activeSec = mrReadU32(bytes, 8);
  const sig = bytes.slice(12, 18);
  const expected = (await mrSign([id, startSec, endSec, activeSec].join("|"))).slice(0, 6);
  let match = true;
  for (let i = 0; i < 6; i++) if (sig[i] !== expected[i]) match = false;
  const startMs = startSec * 1000, endMs = endSec * 1000, activeMs = activeSec * 1000;
  return { match, startMs, endMs, activeMs, ok: activeMs >= MR_THRESHOLD };
}