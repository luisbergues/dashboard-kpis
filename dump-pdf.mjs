// Muestra lo que el parser REALMENTE ve dentro de un PDF.
//
// El generador no lee el PDF como lo ves vos en pantalla: lee los fragmentos de
// texto que extrae pdf.js, que pueden venir en otro orden, partidos por la
// mitad, o con espacios donde no los hay. Por eso un screenshot no alcanza para
// calibrar: hay que ver el texto crudo.
//
//   node dump-pdf.mjs ruta/al/quote.pdf
//   node dump-pdf.mjs ruta/al/drawings.pdf --pos    (agrega coordenadas x/y)
//
// --pos importa sólo para Drawings: ahí la asociación entre una etiqueta
// (OPENING/HEIGHT/DEPTH) y su número depende de qué tan cerca están, y ese
// umbral es la perilla más frágil de todo el pipeline.

import { readFileSync } from 'node:fs';
import { extractPdfPages } from './src/utils/essPdfExtract.js';

const [path, ...flags] = process.argv.slice(2);
if (!path) {
  console.error('Uso: node dump-pdf.mjs ruta/al/archivo.pdf [--pos]');
  process.exit(1);
}
const showPos = flags.includes('--pos');

const buffer = readFileSync(path);
const pages = await extractPdfPages(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

console.log(`\n${path} — ${pages.length} página(s)\n${'='.repeat(60)}`);

for (const page of pages) {
  console.log(`\n--- Página ${page.pageNumber} — ${page.items.length} fragmentos ---\n`);

  if (page.items.length === 0) {
    console.log('  (sin texto: es un escaneo, o una imagen. Ningún ajuste del parser lo arregla.)');
    continue;
  }

  if (showPos) {
    for (const item of page.items) {
      console.log(`  x=${String(Math.round(item.x)).padStart(5)} y=${String(Math.round(item.y)).padStart(5)}  ${JSON.stringify(item.text)}`);
    }
  } else {
    // Reagrupa por renglón (misma y, con tolerancia) para que se lea parecido a
    // como se ve en pantalla — pero mostrando los cortes reales entre fragmentos.
    const rows = new Map();
    for (const item of page.items) {
      const key = Math.round(item.y / 3) * 3;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(item);
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of sorted) {
      const line = items.sort((a, b) => a.x - b.x).map(i => i.text).join('');
      if (line.trim()) console.log(`  ${line}`);
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('Pegame esta salida completa.\n');
