// Draws the purple star icon as PNG files without any image library.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const POINTS = [[12, 2], [14.81, 8.63], [22, 9.24], [16.54, 13.97], [18.18, 21], [12, 17.27], [5.82, 21], [7.46, 13.97], [2, 9.24], [9.19, 8.63]];

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = POINTS.length - 1; i < POINTS.length; j = i++) {
    const [xi, yi] = POINTS[i];
    const [xj, yj] = POINTS[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(size) {
  const scale = 24 / size;
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = [0];
    for (let x = 0; x < size; x += 1) {
      let cover = 0;
      for (let sy = 0; sy < 4; sy += 1) for (let sx = 0; sx < 4; sx += 1) cover += inside((x + (sx + 0.5) / 4) * scale, (y + (sy + 0.5) / 4) * scale) ? 1 : 0;
      row.push(0x7b, 0x1f, 0xa2, Math.round((cover / 16) * 255));
    }
    rows.push(Buffer.from(row));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) writeFileSync(`icons/${size}.png`, png(size));
