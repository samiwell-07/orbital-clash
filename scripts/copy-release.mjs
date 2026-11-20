import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('release', { recursive: true });
copyFileSync('dist/index.html', 'release/orbital-clash.html');
console.log('release/orbital-clash.html updated');
