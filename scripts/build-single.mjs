// Builds a single self-contained HTML page (JS + CSS inlined, hash routing)
// for hosting where only one file is served, e.g. a claude.ai artifact.
// Usage: npm run build:single  ->  dist-single/commanders-edge.html
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-single';
execSync(`npx vite build --outDir ${out}`, { stdio: 'inherit', env: { ...process.env, VITE_HASH_ROUTER: '1' } });

const assets = join(out, 'assets');
const files = readdirSync(assets);
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');

const html = `<title>Commander's Edge</title>
<meta name="theme-color" content="#07060b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap">
<style>
:root { color-scheme: dark; }
html, body { background: #07060b; color: #fff; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(join(out, 'commanders-edge.html'), html);
console.log(`Wrote ${join(out, 'commanders-edge.html')} (${(html.length / 1024).toFixed(0)} KB)`);
