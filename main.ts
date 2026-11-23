// THE WORLD IN ONE DAY - Monday 23 November 2026
// A newspaper front page drawn from scratch: own PNG encoder, own 5x7
// bitmap font, standard library only, no network, deterministic output.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- CRC32 (PNG chunk checksums) ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Encode raw RGB rows (filter byte 0 per scanline) as a PNG.
function encodePNG(rgb: Uint8Array, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), rowStart + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font ----
// Each glyph is 7 rows; each row is a 5-bit number, bit 4 = leftmost pixel.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};

// ---- Canvas ----
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const NAVY: RGB = [20, 33, 61];
const INK: RGB = [28, 28, 28];
const BODY: RGB = [70, 66, 60];
const RED: RGB = [178, 34, 34];
const GOLD: RGB = [232, 184, 75];
const WHITE: RGB = [255, 255, 255];
const DIVIDER: RGB = [205, 197, 180];

class Canvas {
  px = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(PAPER);
  }
  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.px[i * 3] = c[0];
      this.px[i * 3 + 1] = c[1];
      this.px[i * 3 + 2] = c[2];
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w);
    const y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }
  textWidth(text: string, scale: number): number {
    return text.length * 6 * scale - scale;
  }
  text(text: string, x: number, y: number, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of text) {
      const glyph = FONT[ch] ?? FONT[" "];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            this.rect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }
  centered(text: string, y: number, scale: number, c: RGB): void {
    this.text(text, Math.floor((W - this.textWidth(text, scale)) / 2), y, scale, c);
  }
}

// ---- The day's news: Monday 23 November 2026 ----
// Every story happened on, or was first reported on, 23 November 2026.
interface Story {
  tag: string;
  color: RGB;
  headline: string;
  line1: string;
  line2: string;
}
const STORIES: Story[] = [
  {
    tag: "UKRAINE",
    color: [178, 34, 34],
    headline: "RUSSIAN STRIKE KILLS AT LEAST 10 IN DYMER",
    line1: "A RUSSIAN STRIKE ON A BLOCK OF FLATS NORTH OF KYIV KILLED",
    line2: "AT LEAST 10 PEOPLE; RESCUERS PULLED A 7-YEAR-OLD BOY ALIVE.",
  },
  {
    tag: "LIBYA",
    color: [20, 33, 61],
    headline: "KYIV: SEA DRONES SANK RUSSIAN WARSHIP",
    line1: "SEVEN UKRAINIAN SEA DRONES HIT THE CORVETTE MERKURY",
    line2: "IN BENGHAZI, LIBYA, AND STRUCK THE CARGO SHIP MV ANGARA.",
  },
  {
    tag: "MARKETS",
    color: [0, 122, 90],
    headline: "AI FEARS SEND STOCKS TUMBLING",
    line1: "JAPAN'S NIKKEI FELL 5.06% AND THE S&P 500 FELL 3.7%",
    line2: "AS FEARS GREW THAT AI SHARES ARE OVERPRICED.",
  },
  {
    tag: "GULF",
    color: [120, 60, 140],
    headline: "IRAN SAYS IT DOWNED A US DRONE",
    line1: "TEHRAN CLAIMS ITS FORCES SHOT DOWN AN MQ-9 REAPER",
    line2: "OVER THE STRAIT OF HORMUZ ON MONDAY.",
  },
  {
    tag: "USA",
    color: [30, 90, 160],
    headline: "DEMOCRATS CLINCH 258 HOUSE SEATS",
    line1: "THE FINAL COUNT GIVES DEMOCRATS 258 SEATS IN THE",
    line2: "US HOUSE, THEIR LARGEST MAJORITY IN 30 YEARS.",
  },
  {
    tag: "ASIA",
    color: [200, 120, 20],
    headline: "NEPAL PM WELCOMED IN NEW DELHI",
    line1: "BALEN SHAH MET PM MODI ON HIS FIRST OFFICIAL VISIT",
    line2: "TO INDIA AS NEPAL'S PRIME MINISTER.",
  },
  {
    tag: "CULTURE",
    color: [90, 140, 30],
    headline: "MOLLY MELDRUM DIES AT 83",
    line1: "AUSTRALIA'S BELOVED MUSIC BROADCASTER DIED IN",
    line2: "MELBOURNE AFTER A LONG ILLNESS; TRIBUTES POURED IN.",
  },
  {
    tag: "EUROPE",
    color: [140, 90, 40],
    headline: "BELGIAN AIRPORTS SHUT BY STRIKE",
    line1: "AIR TRAFFIC CONTROL STOPPED AS WORKERS PROTESTED",
    line2: "AUSTERITY CUTS, GROUNDING ALMOST ALL FLIGHTS.",
  },
];

function drawStory(cv: Canvas, s: Story, index: number, y: number): void {
  // Numbered colour chip on the left.
  cv.rect(32, y + 6, 52, 80, s.color);
  const num = String(index + 1);
  cv.text(num, 32 + Math.floor((52 - cv.textWidth(num, 4)) / 2), y + 28, 4, WHITE);
  // Tag above the headline, in the chip colour.
  cv.text(s.tag, 100, y + 4, 2, s.color);
  // Headline and two summary lines.
  cv.text(s.headline, 100, y + 26, 3, INK);
  cv.text(s.line1, 100, y + 56, 2, BODY);
  cv.text(s.line2, 100, y + 76, 2, BODY);
  // Divider under the block.
  cv.rect(32, y + 94, W - 64, 2, DIVIDER);
}

function main(): void {
  const cv = new Canvas();
  // Masthead.
  cv.rect(0, 0, W, 128, NAVY);
  cv.centered("THE WORLD IN ONE DAY", 26, 6, WHITE);
  cv.centered("MONDAY 23 NOVEMBER 2026", 82, 3, GOLD);
  cv.rect(0, 128, W, 6, RED);
  // Stories.
  for (let i = 0; i < STORIES.length; i++) {
    drawStory(cv, STORIES[i], i, 148 + i * 100);
  }
  // Footer strip.
  cv.rect(0, 956, W, H - 956, NAVY);
  cv.centered("ALL EVENTS HAPPENED OR WERE FIRST REPORTED ON 23 NOVEMBER 2026", 984, 2, WHITE);
  // Write the PNG deterministically.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "./out";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(cv.px, W, H);
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

main();
