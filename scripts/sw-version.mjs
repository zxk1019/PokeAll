// Se ejecuta después de vite build (npm run build): pone en dist/sw.js un hash de todo lo demás
// (datos, JS, CSS, index.html). Así la caché del service worker cambia sola cuando cambia algo.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const sw = join(DIST, 'sw.js');
const files = (await readdir(DIST, { recursive: true, withFileTypes: true }))
  .filter(f => f.isFile() && f.name !== 'sw.js')
  .map(f => join(f.parentPath, f.name))
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(relative(DIST, file).replaceAll('\\', '/')).update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);

const code = await readFile(sw, 'utf8');
if (!code.includes('__BUILD_VERSION__')) throw new Error('dist/sw.js no tiene __BUILD_VERSION__');
await writeFile(sw, code.replace('__BUILD_VERSION__', version));
console.log(`sw.js: versión ${version} (${files.length} archivos)`);
