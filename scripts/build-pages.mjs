import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

// Preserve the published document's head, replacing only its generated body.
const root = new URL('../', import.meta.url);
const page = await readFile(new URL('docs/index.html', root), 'utf8');
const marker = page.indexOf('<body>');
if (marker < 0) throw new Error('Missing document body');
const source = await readFile(new URL('artifact/podcast-seo-studio.html', root), 'utf8');
const body = source.slice(source.indexOf('\n') + 1);
await writeFile(new URL('docs/index.html', root), page.slice(0, marker) + '<body>\n' + body + '</body>\n</html>\n');
await mkdir(new URL('docs/icons/', root), { recursive: true });
for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
  await copyFile(new URL('public/icons/' + name, root), new URL('docs/icons/' + name, root));
}
