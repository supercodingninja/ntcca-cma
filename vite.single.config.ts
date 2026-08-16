// One-off config: compile the WHOLE app into a single self-contained HTML
// file the boss can AirDrop — no server, no install, just open in Safari.
import path from "path"
import fs from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

const PUB = path.resolve(__dirname, "public");
const dataUri = (rel: string) => {
  const buf = fs.readFileSync(path.join(PUB, rel));
  const ext = rel.split('.').pop()!.toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp'
    : ext === 'pdf' ? 'application/pdf' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
};

// Every string-referenced public asset we can afford to embed.
const STRING_ASSETS = [
  '/earth-spin.webp', '/earth-still.png', '/dove-fly.png',
  '/fav-black.png', '/fav-bible.png', '/dove.png', '/favicon.png', '/ntcca-emblem.png',
  ...fs.readdirSync(path.join(PUB, 'files')).filter((f) => f.endsWith('.pdf')).map((f) => `/files/${f}`),
];
const REPLACEMENTS = new Map(STRING_ASSETS.map((p) => [p, dataUri(p)]));

// Photo reel: 44 jpgs embedded as a data-URI manifest.
const PHOTO_DATA = Object.fromEntries(
  fs.readdirSync(path.join(PUB, 'photos')).filter((f) => f.endsWith('.jpg'))
    .map((f) => [f.replace('.jpg', ''), dataUri(`photos/${f}`)])
);

function inlinePublicAssets(): Plugin {
  return {
    name: 'inline-public-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      let out = code;
      if (/src[/\\]main\.tsx$/.test(id)) {
        out = out.split('BrowserRouter').join('HashRouter'); // file:// has no server routes — hash routing survives AirDrop
      }
      if (/lib[/\\]photos\.ts$/.test(id)) {
        out = out.replace(
          '].map((n) => `/photos/${n}.jpg`);',
          `].map((n) => (PHOTO_DATA as Record<string, string>)[n]);`
        );
        out = `const PHOTO_DATA = ${JSON.stringify(PHOTO_DATA)};\n` + out;
      }
      for (const [pub, uri] of REPLACEMENTS) out = out.split(`"${pub}"`).join(`"${uri}"`).split(`'${pub}'`).join(`'${uri}'`);
      return out === code ? null : { code: out, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), inlinePublicAssets(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: '/tmp/single-dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
    minify: false,
  },
});
