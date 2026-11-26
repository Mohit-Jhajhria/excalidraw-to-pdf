// Builds the static website into ./site (this folder is what Cloudflare Pages publishes).
// Run:  npm run web:build
import { build } from "esbuild";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT = "site";

function findPackage(name) {
  let dir = process.cwd();
  while (true) {
    const p = path.join(dir, "node_modules", name);
    if (existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`${name} not found - run: npm install`);
    dir = parent;
  }
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, "fonts", "ui"), { recursive: true });

await build({
  entryPoints: ["src/web/main.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: path.join(OUT, "app.js"),
  minify: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env": '{"MODE":"production","DEV":false,"PROD":true}',
  },
  loader: { ".woff2": "dataurl", ".woff": "dataurl", ".svg": "dataurl", ".png": "dataurl" },
});

await fs.copyFile("web/index.html", path.join(OUT, "index.html"));
await fs.copyFile("web/style.css", path.join(OUT, "style.css"));
// robots.txt, sitemap.xml, og-image.png ... anything in web/public goes to the site root
if (existsSync("web/public")) await fs.cp("web/public", OUT, { recursive: true });

// Excalidraw's own fonts, served from the site itself (no CDN)
const excalidrawFonts = path.join(findPackage("@excalidraw/excalidraw"), "dist/prod/fonts");
await fs.cp(excalidrawFonts, path.join(OUT, "fonts"), { recursive: true });
// Devanagari fallback font
await fs.copyFile(
  path.join(findPackage("@fontsource/noto-sans-devanagari"), "files/noto-sans-devanagari-devanagari-400-normal.woff2"),
  path.join(OUT, "fonts/noto-sans-devanagari-400.woff2"),
);

// Fonts for the page itself (headline and interface), under steady names.
// Excalifont is the hand-drawn Excalidraw font; its Latin letters are in this one file.
const UI_FONTS = {
  "hand.woff2": "Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2",
  "sans-400.woff2": "Assistant/Assistant-Regular.woff2",
  "sans-600.woff2": "Assistant/Assistant-SemiBold.woff2",
  "sans-700.woff2": "Assistant/Assistant-Bold.woff2",
};
for (const [name, from] of Object.entries(UI_FONTS)) {
  const src = path.join(excalidrawFonts, from);
  if (!existsSync(src)) throw new Error(`UI font missing: ${from} (did the @excalidraw/excalidraw version change?)`);
  await fs.copyFile(src, path.join(OUT, "fonts/ui", name));
}

// The same fonts, packed into one script. index.html loads it ONLY when the page is
// opened straight from disk (file://), where browsers block fetching font files.
// (The big Chinese/Japanese Xiaolai font is left out to keep this small.)
const embedded = {};
for (const family of await fs.readdir(path.join(OUT, "fonts"))) {
  const dir = path.join(OUT, "fonts", family);
  if (family === "Xiaolai" || family === "ui" || !(await fs.stat(dir)).isDirectory()) continue;
  for (const f of await fs.readdir(dir)) {
    if (f.endsWith(".woff2")) embedded[`${family}/${f}`] = (await fs.readFile(path.join(dir, f))).toString("base64");
  }
}
embedded["noto-sans-devanagari-400.woff2"] = (await fs.readFile(path.join(OUT, "fonts/noto-sans-devanagari-400.woff2"))).toString("base64");
await fs.writeFile(path.join(OUT, "fonts-embedded.js"), "window.__EMBEDDED_FONTS=" + JSON.stringify(embedded) + ";");
console.log(`embedded ${Object.keys(embedded).length} font files for offline use`);

// License texts of the libraries and fonts that ship inside the site
const NOTICE_PACKAGES = ["react", "react-dom", "pdf-lib", "@fontsource/noto-sans-devanagari"];
let notices = (await fs.readFile("THIRD-PARTY-NOTICES.md", "utf8")).trimEnd() + "\n";
for (const name of NOTICE_PACKAGES) {
  const dir = findPackage(name);
  const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
  const file = (await fs.readdir(dir)).find((f) => /^licen[sc]e/i.test(f));
  if (!file) throw new Error(`no license file found for ${name}`);
  notices += `\n\n---\n\n## Full license text: ${name} ${pkg.version} (${pkg.license})\n\n` + (await fs.readFile(path.join(dir, file), "utf8")).trim() + "\n";
}
await fs.writeFile(path.join(OUT, "third-party-notices.txt"), notices);

console.log(`site ready in ./${OUT}`);
