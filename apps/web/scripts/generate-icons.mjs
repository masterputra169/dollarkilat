/**
 * Generate PWA install icons (PNG) from the SVG sources.
 *
 * Why: Chrome/Brave/Edge require PNG icons ≥192×192 in the manifest before
 * they expose a PWA install entry-point (address-bar icon, "Install…" menu,
 * `beforeinstallprompt` event). SVG icons are honored for tab favicon but
 * NOT counted toward installability.
 *
 * Run once after editing the SVG sources:
 *   npm run icons:gen
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, "..", "public", "icons");

const TARGETS = [
  { src: "icon.svg", out: "icon-192.png", size: 192 },
  { src: "icon.svg", out: "icon-512.png", size: 512 },
  { src: "icon-maskable.svg", out: "icon-maskable-192.png", size: 192 },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png", size: 512 },
];

async function main() {
  for (const t of TARGETS) {
    const srcPath = resolve(ICONS_DIR, t.src);
    const outPath = resolve(ICONS_DIR, t.out);
    const svg = await readFile(srcPath);
    const buf = await sharp(svg)
      .resize(t.size, t.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(outPath, buf);
    console.log(`✓ ${t.out} (${t.size}×${t.size}, ${buf.byteLength} bytes)`);
  }
  console.log("\nDone. Update manifest.ts to reference these PNGs.");
}

main().catch((err) => {
  console.error("✗ icon generation failed:", err);
  process.exit(1);
});
