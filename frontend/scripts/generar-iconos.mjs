// Genera el set de íconos de la PWA a partir de un único glifo (el sillón de la
// marca Chaco Living). Correr con: npm run icons
//
// Sale a /public:
//   pwa-192.png / pwa-512.png          -> icons "any" (mosaico redondeado)
//   pwa-maskable-192/512.png           -> icons "maskable" (a sangre, glifo en zona segura)
//   apple-touch-icon.png (180)         -> iOS, opaco y a sangre (iOS recorta las esquinas)
//   favicon.svg                        -> el que ya existía, se deja igual
//
// Si cambia la marca, editar SOFA_PATHS / COLOR_* acá y volver a correr.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(AQUI, "..", "public");

const SAGE = "#3f6153"; // --accent-500
const BLANCO = "#ffffff";

// Sillón en una grilla 100x100 (escalado x3.125 desde el favicon original 32x32).
const SOFA = `
  <rect x="25"   y="23.4" width="50"   height="31.25" rx="9.4" fill="${BLANCO}"/>
  <rect x="12.5" y="37.5" width="17.2" height="34.4"  rx="7.8" fill="${BLANCO}"/>
  <rect x="70.3" y="37.5" width="17.2" height="34.4"  rx="7.8" fill="${BLANCO}"/>
  <rect x="18.75" y="50"  width="62.5" height="23.4"  rx="9.4" fill="${BLANCO}"/>
  <rect x="25"   y="73.4" width="7.5"  height="10"    rx="3"   fill="${BLANCO}"/>
  <rect x="67.5" y="73.4" width="7.5"  height="10"    rx="3"   fill="${BLANCO}"/>
`;

// "any": mosaico con esquinas redondeadas, como el favicon.
const svgTile = (escala = 0.92) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="23" fill="${SAGE}"/>
  <g transform="translate(50 50.5) scale(${escala}) translate(-50 -50)">${SOFA}</g>
</svg>`;

// "maskable" / apple: a sangre (sin esquinas), el SO aplica su propia máscara.
// El glifo se achica para caer dentro de la zona segura (círculo interior 80%).
const svgBleed = (escala) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${SAGE}"/>
  <g transform="translate(50 50.5) scale(${escala}) translate(-50 -50)">${SOFA}</g>
</svg>`;

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const salidas = [
  ["pwa-192.png", svgTile(), 192],
  ["pwa-512.png", svgTile(), 512],
  ["pwa-maskable-192.png", svgBleed(0.82), 192],
  ["pwa-maskable-512.png", svgBleed(0.82), 512],
  ["apple-touch-icon.png", svgBleed(0.88), 180],
];

await mkdir(PUBLIC, { recursive: true });
for (const [nombre, svg, size] of salidas) {
  await writeFile(join(PUBLIC, nombre), await png(svg, size));
  console.log("  ✓", nombre, `(${size}x${size})`);
}
console.log("Listo. Íconos en frontend/public/");
