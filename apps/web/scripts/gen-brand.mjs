// Builds the logo files in public/brand from the source lockup
// (src/assets/brand/valovertix-lockup.png), using Chromium's canvas.
// Usage (from apps/web): node scripts/gen-brand.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SOURCE = "src/assets/brand/valovertix-lockup.png";
const OUT = "public/brand";
// The V mark's bounds inside the lockup (measured: content rows 31-257, columns 52-352).
const MARK = { x: 52, y: 31, w: 301, h: 227 };
const PAD = 6;
const PAGE_BG = "#0e1117";

const src = "data:image/png;base64," + (await readFile(SOURCE)).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();

const files = await page.evaluate(
  async ({ src, MARK, PAD, PAGE_BG }) => {
    const img = new Image();
    img.src = src;
    await img.decode();

    const toDataUrl = async (canvas) => {
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (const b of buf) s += String.fromCharCode(b);
      return btoa(s);
    };

    // 1. Transparent mark: undo the blend with the near-black background so
    //    anti-aliased edges keep their true color instead of a dark fringe.
    const w = MARK.w + PAD * 2;
    const h = MARK.h + PAD * 2;
    const mark = new OffscreenCanvas(w, h);
    const mx = mark.getContext("2d");
    mx.drawImage(img, MARK.x - PAD, MARK.y - PAD, w, h, 0, 0, w, h);
    const px = mx.getImageData(0, 0, w, h);
    const d = px.data;
    const bg = [6, 7, 8];
    for (let i = 0; i < d.length; i += 4) {
      const lift = Math.max(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2], 0);
      const a = Math.min(1, lift / (255 - 8));
      if (a < 0.04) {
        d[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] - (1 - a) * bg[c]) / a)));
      }
      d[i + 3] = Math.round(a * 255);
    }
    mx.putImageData(px, 0, 0);

    // 2. App icons: the mark on a dark rounded square, so it shows on light and dark tabs.
    const icon = async (size) => {
      const c = new OffscreenCanvas(size, size);
      const x = c.getContext("2d");
      const r = size * 0.2;
      x.fillStyle = PAGE_BG;
      x.beginPath();
      x.roundRect(0, 0, size, size, r);
      x.fill();
      const scale = (size * 0.8) / Math.max(w, h);
      const dw = w * scale;
      const dh = h * scale;
      x.imageSmoothingQuality = "high";
      x.drawImage(mark, (size - dw) / 2, (size - dh) / 2 + size * 0.02, dw, dh);
      return toDataUrl(c);
    };

    return {
      "mark.png": await toDataUrl(mark),
      "icon-32.png": await icon(32),
      "icon-48.png": await icon(48),
      "icon-180.png": await icon(180),
      "icon-192.png": await icon(192),
      size: [w, h],
    };
  },
  { src, MARK, PAD, PAGE_BG },
);

await mkdir(OUT, { recursive: true });
for (const [name, b64] of Object.entries(files)) {
  if (name === "size") continue;
  await writeFile(`${OUT}/${name}`, Buffer.from(b64, "base64"));
}
console.log(`Wrote ${OUT}: mark.png (${files.size.join("x")}) and icons 32, 48, 180, 192`);
await browser.close();
