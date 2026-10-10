'use strict';
/**
 * Oficina IA icon, drawn from code (no binary files in the repo).
 * 32x32 pixel-art robot in a suit. Writes docs/logo.png, build/icon.png, build/icon.ico.
 * To change the icon: edit RECTS (x0, y0, x1, y1, color) on the 32x32 grid.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const O = '#0e1120';
const RECTS = [
  [0, 0, 31, 31, '#1d2440'], [0, 26, 31, 31, '#232c4d'],
  // antenna
  [15, 3, 16, 6, '#aeb4c2'], [14, 1, 17, 3, '#f39a2e'], [15, 1, 16, 1, '#ffd08a'],
  // ears
  [4, 11, 6, 16, O], [5, 12, 6, 15, '#c3c7d2'], [25, 11, 27, 16, O], [25, 12, 26, 15, '#aeb4c2'],
  // head
  [6, 6, 25, 21, O], [7, 7, 24, 20, '#e9ebf1'], [21, 7, 24, 20, '#cdd1db'], [7, 7, 24, 7, '#ffffff'],
  // visor + eyes
  [9, 10, 22, 15, '#121a2b'], [9, 10, 22, 10, '#1c2840'],
  [11, 11, 13, 13, '#4fd1ff'], [18, 11, 20, 13, '#4fd1ff'], [11, 11, 11, 11, '#e8fbff'], [18, 11, 18, 11, '#e8fbff'],
  // mouth
  [13, 17, 18, 17, '#8a90a0'], [12, 16, 12, 16, '#8a90a0'], [19, 16, 19, 16, '#8a90a0'],
  // neck
  [14, 22, 17, 22, O], [14, 21, 17, 22, '#9aa0ae'],
  // suit, shirt, lapels, tie
  [5, 23, 26, 31, O], [6, 24, 25, 31, '#2e3547'], [6, 24, 9, 31, '#262c3c'],
  [12, 23, 19, 27, '#f4f4f6'], [11, 23, 11, 25, '#3a4258'], [20, 23, 20, 25, '#3a4258'],
  [14, 23, 17, 24, '#e0861a'], [15, 25, 16, 30, '#f39a2e'], [15, 30, 16, 30, '#c66f12'],
];

const N = 32;
const grid = Array.from({ length: N * N }, () => [0, 0, 0, 0]);
for (const [x0, y0, x1, y1, hex] of RECTS) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * N + x] = c;
}

function render(size, rounded) {
  const px = Buffer.alloc(size * size * 4);
  const r = Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = grid[Math.floor((y * N) / size) * N + Math.floor((x * N) / size)];
      let a = c[3];
      if (rounded) {
        const cx = x < r ? r : x > size - 1 - r ? size - 1 - r : x;
        const cy = y < r ? r : y > size - 1 - r ? size - 1 - r : y;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) a = 0;
      }
      px.set([c[0], c[1], c[2], a], (y * size + x) * 4);
    }
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rounded) {
  const px = render(size, rounded);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function ico(sizes) {
  const imgs = sizes.map((s) => png(s, true));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
    off += imgs[i].length;
  });
  return Buffer.concat([head, ...imgs]);
}

module.exports = function writeBrand(app) {
  fs.writeFileSync(path.join(app, 'docs', 'logo.png'), png(512, false));
  fs.writeFileSync(path.join(app, 'build', 'icon.png'), png(1024, true));
  fs.writeFileSync(path.join(app, 'build', 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
};
