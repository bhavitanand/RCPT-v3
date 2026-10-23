// base58 / base58check helpers — used to tell Bitcoin, Tron and Solana addresses apart
const crypto = require('crypto');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

function decode(str) {
  let num = 0n;
  for (const ch of str) {
    if (!(ch in MAP)) return null;
    num = num * 58n + BigInt(MAP[ch]);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hex === '00' ? [] : [...Buffer.from(hex, 'hex')];
  let zeros = 0;
  for (const ch of str) { if (ch === '1') zeros++; else break; }
  return Buffer.from([...Array(zeros).fill(0), ...bytes]);
}

function encode(buf) {
  let num = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  for (const b of buf) { if (b === 0) out = '1' + out; else break; }
  return out;
}

const sha256 = b => crypto.createHash('sha256').update(b).digest();

// Returns { version, payload } when the checksum is valid, otherwise null
function decodeCheck(str) {
  const raw = decode(str);
  if (!raw || raw.length < 5) return null;
  const body = raw.subarray(0, raw.length - 4);
  const sum = raw.subarray(raw.length - 4);
  const want = sha256(sha256(body)).subarray(0, 4);
  if (!sum.equals(want)) return null;
  return { version: body[0], payload: body.subarray(1) };
}

function encodeCheck(body) {
  const sum = sha256(sha256(body)).subarray(0, 4);
  return encode(Buffer.concat([body, sum]));
}

// Tron returns hex addresses ("41…") in transaction bodies; convert to T… form
function tronHexToBase58(hex) {
  if (!hex) return null;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return encodeCheck(Buffer.from(clean, 'hex'));
}

module.exports = { decode, encode, decodeCheck, encodeCheck, tronHexToBase58 };
