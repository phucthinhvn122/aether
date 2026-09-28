// Renders the Aether PNG icons and iOS splash (no dependencies). Run: npm run icons
import { existsSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TERRACOTTA = [0xc4, 0x5c, 0x26];
const CREAM = [0xfa, 0xf8, 0xf5];
// Asterisk mark in a 512×512 design space.
const SEGMENTS = [
  [256, 120, 256, 392],
  [138, 188, 374, 324],
  [138, 324, 374, 188],
];
const HALF_STROKE = 17;

function distToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * @param size   output edge in px
 * @param bg/fg  RGB triplets (no alpha — App Store icons must be opaque)
 * @param markScale fraction of the canvas the 512px design occupies
 */
function render(size, { bg, fg, markScale = 1, ss = 4 }) {
  const designPx = size * markScale;
  const offset = (size - designPx) / 2;
  const toDesign = 512 / designPx;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    const nearY = y >= offset - 2 && y <= offset + designPx + 2;
    for (let x = 0; x < size; x++) {
      let a = 0;
      if (nearY && x >= offset - 2 && x <= offset + designPx + 2) {
        let cover = 0;
        for (let sy = 0; sy < ss; sy++) {
          for (let sx = 0; sx < ss; sx++) {
            const px = (x + (sx + 0.5) / ss - offset) * toDesign;
            const py = (y + (sy + 0.5) / ss - offset) * toDesign;
            if (SEGMENTS.some((s) => distToSegment(px, py, s) <= HALF_STROKE)) cover++;
          }
        }
        a = cover / (ss * ss);
      }
      for (let i = 0; i < 3; i++) row[1 + x * 3 + i] = Math.round(bg[i] * (1 - a) + fg[i] * a);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const icon = { bg: TERRACOTTA, fg: CREAM };
const outputs = [
  ['public/apple-touch-icon.png', 180, icon],
  ['public/icon-192.png', 192, icon],
  ['public/icon-512.png', 512, icon],
];

const IOS_ASSETS = 'ios/App/App/Assets.xcassets';
if (existsSync(new URL(`../${IOS_ASSETS}`, import.meta.url))) {
  outputs.push([`${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, icon]);
  const splash = { bg: CREAM, fg: TERRACOTTA, markScale: 0.14, ss: 2 };
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    outputs.push([`${IOS_ASSETS}/Splash.imageset/${name}`, 2732, splash]);
  }
}

const cache = new Map();
for (const [path, size, opts] of outputs) {
  const key = `${size}:${JSON.stringify(opts)}`;
  if (!cache.has(key)) cache.set(key, render(size, opts));
  writeFileSync(new URL(`../${path}`, import.meta.url), cache.get(key));
  console.log(`${path} (${size}px)`);
}
