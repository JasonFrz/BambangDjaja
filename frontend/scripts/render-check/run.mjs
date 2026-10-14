// Pemeriksaan render tanpa browser: bundel panel baru dengan Vite (SSR) memakai stub data
// berbentuk respons backend nyata, lalu renderToString dan cek teks kunci + konsistensi preset.
// Pakai: npm run check:render   (dari folder frontend)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FE = path.resolve(HERE, '..', '..');
const req = createRequire(path.join(FE, 'package.json'));
const { build } = await import(pathToFileURL(req.resolve('vite')).href);
const react = (await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href)).default;
const out = mkdtempSync(path.join(os.tmpdir(), 'tmu-render-check-'));
try {
  await build({
    root: FE, configFile: false, logLevel: 'error', plugins: [react()],
    resolve: { alias: [
      { find: /.*hooks\/useTrafoApi$/, replacement: path.join(HERE, 'stubs.js') },
      { find: /.*contexts\/ApiContext$/, replacement: path.join(HERE, 'stubs.js') },
      { find: /^SRC\//, replacement: path.join(FE, 'src') + '/' },
    ] },
    build: { ssr: path.join(HERE, 'entry.jsx'), outDir: out, emptyOutDir: true, minify: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'out.cjs' } } },
  });
  const r = spawnSync(process.execPath, [path.join(out, 'out.cjs')], { stdio: 'inherit', env: { ...process.env, NODE_PATH: path.join(FE, 'node_modules') } });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
