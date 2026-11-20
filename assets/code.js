"use strict";

// 密钥公开在前端：审核码只防 P 图/随手伪造，挡不住扒 JS 提取密钥的技术性伪造。
const MR_CODE_KEY = "MR-2026-k7Q2m9X4pA-vN3bR8tY5wZ1";
const MR_B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

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

async function mrComputeCode(name, id, startStr, endStr) {
  const enc = new TextEncoder();
  const msg = [name, id, startStr, endStr].join("|");
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(MR_CODE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  const b32 = mrBase32(sig.slice(0, 6));
  return b32.slice(0, 5) + "-" + b32.slice(5, 10);
}

function mrNormalizeCode(s) {
  return String(s).toUpperCase().replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1").replace(/O/g, "0");
}