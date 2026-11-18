#!/usr/bin/env node
// Links every illustration in public/img/bookNN/secNNN.webp to its section in data/books/NN-*.json
// (sets "image" where it is missing or points to a file that doesn't exist). Keeps the JSON formatting.
// Usage: node scripts/link-images.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of readdirSync(join(ROOT, 'data/books')).filter((f) => f.endsWith('.json'))) {
  const nn = file.slice(0, 2);
  const dir = join(ROOT, `public/img/book${nn}`);
  if (!existsSync(dir)) continue;
  const path = join(ROOT, 'data/books', file);
  const raw = readFileSync(path, 'utf8');
  const book = JSON.parse(raw);
  let linked = 0;
  for (const img of readdirSync(dir).filter((f) => /^sec\d+\.webp$/.test(f))) {
    const section = book.sections[String(parseInt(img.slice(3), 10))];
    const rel = `public/img/book${nn}/${img}`;
    if (!section || (section.image && existsSync(join(ROOT, section.image)))) continue;
    section.image = rel;
    linked++;
  }
  if (!linked) continue;
  const indent = (raw.match(/\n( +)"/) || [, '  '])[1];
  let out = JSON.stringify(book, null, indent) + (raw.endsWith('\n') ? '\n' : '');
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  writeFileSync(path, out);
  console.log(`${file}: ${linked} illustrations linked`);
}
