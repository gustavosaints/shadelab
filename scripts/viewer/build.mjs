/**
 * Empacota o visualizador 3D (viewer/src/main.js + three.js) em um único arquivo:
 *   assets/viewer/smile3d.html  → carregado pelo WebView do app (sem internet)
 *   viewer/dev/smile3d.js       → usado pela página de testes no navegador do PC
 *
 *   node scripts/viewer/build.mjs [--watch]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.resolve('.');
const outJs = path.join(root, 'viewer/dev/smile3d.js');
const outHtml = path.join(root, 'assets/viewer/smile3d.html');

async function bundle() {
  const r = await esbuild.build({
    entryPoints: [path.join(root, 'viewer/src/main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020', 'safari15'],
    write: false,
    legalComments: 'none',
  });
  const js = r.outputFiles[0].text;
  fs.mkdirSync(path.dirname(outJs), { recursive: true });
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outJs, js);
  const tpl = fs.readFileSync(path.join(root, 'viewer/src/template.html'), 'utf8');
  fs.writeFileSync(outHtml, tpl.replace('/*__BUNDLE__*/', () => js));
  console.log(`visualizador: ${(js.length / 1024).toFixed(0)} kB → ${path.relative(root, outHtml)} e ${path.relative(root, outJs)}`);
}

await bundle();
if (process.argv.includes('--watch')) {
  fs.watch(path.join(root, 'viewer/src'), { recursive: true }, () => bundle().catch((e) => console.error(e.message)));
  console.log('observando viewer/src…');
}
