// Copies the single-file build (dist/index.html) to release/orbital-clash.html.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'dist', 'index.html');
const outDir = resolve(root, 'release');
const dest = resolve(outDir, 'orbital-clash.html');

if (!existsSync(src)) {
  console.error(`Missing ${src}. Run "npm run build" first.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, dest);
console.log(`Copied to ${dest} (${(statSync(dest).size / 1024).toFixed(1)} KiB)`);
