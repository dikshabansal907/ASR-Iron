// One-off generator for the monochrome notification badge (transparent PNG).
// Android renders the status-bar icon from the alpha channel, so we draw the
// white "ASR" wordmark on a fully transparent background. 2x2 supersampling
// smooths the diagonal strokes.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const SIZE = 96;

// CRC32 table + helper for PNG chunks.
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Geometry helpers.
function rect(px, py, x0, y0, x1, y1) {
  return px >= x0 && px < x1 && py >= y0 && py < y1;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Letter metrics.
const t = 7; // stroke thickness
const W = 18; // letter width
const y0 = 29;
const y1 = 67;
const midY = 48;
const xA = 16;
const xS = 39;
const xR = 62;

function inside(px, py) {
  // A — two legs + crossbar.
  const aLeft = distToSeg(px, py, xA, y1, xA + W / 2, y0) <= t / 2;
  const aRight = distToSeg(px, py, xA + W, y1, xA + W / 2, y0) <= t / 2;
  const aBar = rect(px, py, xA + 3, 50, xA + W - 3, 50 + t);
  const A = aLeft || aRight || aBar;

  // S — top / upper-left / middle / lower-right / bottom.
  const S =
    rect(px, py, xS, y0, xS + W, y0 + t) ||
    rect(px, py, xS, y0, xS + t, midY) ||
    rect(px, py, xS, midY - t, xS + W, midY) ||
    rect(px, py, xS + W - t, midY, xS + W, y1) ||
    rect(px, py, xS, y1 - t, xS + W, y1);

  // R — left stem, top bowl, middle bar, diagonal leg.
  const rLeg = distToSeg(px, py, xR + t, midY - 2, xR + W, y1) <= t / 2;
  const R =
    rect(px, py, xR, y0, xR + t, y1) ||
    rect(px, py, xR, y0, xR + W, y0 + t) ||
    rect(px, py, xR + W - t, y0, xR + W, midY) ||
    rect(px, py, xR, midY - t, xR + W, midY) ||
    rLeg;

  return A || S || R;
}

// Build RGBA pixels with 2x2 supersampling for smoother edges.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1), 0);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0; // PNG filter type 0 for this scanline
  for (let x = 0; x < SIZE; x++) {
    let hits = 0;
    for (const oy of [0.25, 0.75]) {
      for (const ox of [0.25, 0.75]) {
        if (inside(x + ox, y + oy)) hits++;
      }
    }
    const idx = rowStart + 1 + x * 4;
    if (hits) {
      raw[idx] = 255;
      raw[idx + 1] = 255;
      raw[idx + 2] = 255;
      raw[idx + 3] = Math.round((hits / 4) * 255);
    }
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "public", "icons", "asr-notification-badge.png");
fs.writeFileSync(out, png);
console.log("Wrote", out, png.length, "bytes");

// Optional: write a dark-background preview for eyeballing legibility.
if (process.env.ASR_BADGE_DEBUG) {
  const dbg = Buffer.alloc(SIZE * (SIZE * 4 + 1), 0);
  for (let y = 0; y < SIZE; y++) {
    const rs = y * (SIZE * 4 + 1);
    dbg[rs] = 0;
    for (let x = 0; x < SIZE; x++) {
      const i = rs + 1 + x * 4;
      const a = raw[y * (SIZE * 4 + 1) + 1 + x * 4 + 3];
      const on = a / 255;
      dbg[i] = Math.round(10 * (1 - on) + 255 * on);
      dbg[i + 1] = Math.round(62 * (1 - on) + 255 * on);
      dbg[i + 2] = Math.round(122 * (1 - on) + 255 * on);
      dbg[i + 3] = 255;
    }
  }
  const dpng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(dbg, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const dbgOut = path.join(__dirname, "badge-preview.png");
  fs.writeFileSync(dbgOut, dpng);
  console.log("Wrote debug", dbgOut);
}
