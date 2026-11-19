#!/usr/bin/env node
// Makes the combat thumbnails (public/img/portraits/<slug>.webp, 256 px) from the full-body reference portraits
// in public/img/potrait/: the face for people, the middle of the picture for beasts. Skips thumbnails that exist.
// Needs ffmpeg on the PATH. Usage: node scripts/portrait-thumbs.mjs
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BEASTS = ['lupo-della-perdizione', 'cane-da-guerra', 'verme-di-pietra', 'kwaraz', 'yas', 'dhorgaan', 'orso-nero', 'serpente-alato',
  'ragno-talpa', 'itikar'];
const SKIP = ['banedon', 'capitano-dval', 'loi-kymar', 'lord-axim', 'madelon', 'rhygar']; // allies: never fought
const src = join(ROOT, 'public/img/potrait'), out = join(ROOT, 'public/img/portraits');
for (const file of readdirSync(src).filter((f) => f.endsWith('.webp'))) {
  const slug = file.toLowerCase().replace('.webp', '');
  const dest = join(out, `${slug}.webp`);
  if (SKIP.includes(slug) || existsSync(dest)) continue;
  const crop = BEASTS.includes(slug) ? 'crop=iw*0.7:iw*0.7:iw*0.15:ih*0.15' : 'crop=iw*0.5:iw*0.5:iw*0.25:ih*0.03';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(src, file), '-vf', `${crop},scale=256:256`, '-c:v', 'libwebp', '-quality', '78', dest]);
  console.log('thumbnail', slug);
}
