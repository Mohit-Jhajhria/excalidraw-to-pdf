#!/usr/bin/env node
import { parseArgs } from "node:util";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `
excalidraw2pdf - convert an .excalidraw file to a vector PDF

Usage:
  excalidraw2pdf <input.excalidraw> [options]

Options:
  -o, --output <file>     Output PDF (default: <input>.pdf)
  -m, --mode <mode>       auto | frames | single            (default: auto)
                            frames: one PDF page per Excalidraw frame
                            single: whole drawing on one page, cropped to content
                            auto:   frames if the file has any, otherwise single
      --order <order>     Frame order: array | name | position   (default: array)
      --padding <px>      Padding around content (default: 0 for frames, 24 for single)
      --scale <n>         Scale factor for page size (default: 1)
      --dark              Force dark mode        (default: follow the file's theme)
      --light             Force light mode
      --background <css>  Page background colour, e.g. "#1b1b1f" (default: the file's own)
      --transparent       Do not paint the background colour
      --chrome <path>     Path to Chrome / Chromium / Edge
  -q, --quiet             Only print errors
  -h, --help              Show this help
`;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o" },
    mode: { type: "string", short: "m", default: "auto" },
    order: { type: "string", default: "array" },
    padding: { type: "string" },
    scale: { type: "string", default: "1" },
    dark: { type: "boolean", default: false },
    light: { type: "boolean", default: false },
    transparent: { type: "boolean", default: false },
    background: { type: "string" },
    chrome: { type: "string" },
    quiet: { type: "boolean", short: "q", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const log = (...a) => { if (!args.quiet) console.log(...a); };
const fail = (msg) => { console.error(`error: ${msg}`); process.exit(1); };

if (args.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(args.help ? 0 : 1);
}
if (!["auto", "frames", "single"].includes(args.mode)) fail(`bad --mode "${args.mode}"`);
if (!["array", "name", "position"].includes(args.order)) fail(`bad --order "${args.order}"`);

const input = path.resolve(positionals[0]);
const output = path.resolve(args.output ?? input.replace(/\.excalidraw(\.json)?$/i, "") + ".pdf");

// ---------------------------------------------------------------- Chrome ---
function findChrome() {
  const candidates = [
    args.chrome,
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

// ---------------------------------------------------------- local server ---
// Some packages don't export their package.json, so find the install folder
// by walking up through node_modules directories instead of require.resolve.
function findPackageDir(name) {
  let dir = ROOT;
  while (true) {
    const candidate = path.join(dir, "node_modules", name);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) fail(`package ${name} not found - run: npm install`);
    dir = parent;
  }
}
const EXCALIDRAW_DIST = path.join(findPackageDir("@excalidraw/excalidraw"), "dist/prod");
const NOTO_DIR = path.join(findPackageDir("@fontsource/noto-sans-devanagari"), "files");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" };

function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const p = decodeURIComponent(url.pathname);
      let file;
      if (p === "/") file = path.join(ROOT, "src/harness.html");
      else if (p === "/bundle.js") file = path.join(ROOT, "dist/bundle.js");
      else if (p.startsWith("/noto/")) file = path.join(NOTO_DIR, path.basename(p));
      else file = path.join(EXCALIDRAW_DIST, p);
      const base = p.startsWith("/noto/") ? NOTO_DIR : p === "/" || p === "/bundle.js" ? ROOT : EXCALIDRAW_DIST;
      if (!path.resolve(file).startsWith(base)) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// ------------------------------------------------------------------ main ---
const MAX_PAGE_PX = 18000; // Chrome's PDF page limit is 200in = 19200 css px

let scene;
try {
  scene = JSON.parse(await fs.readFile(input, "utf8"));
} catch (e) {
  fail(`cannot read ${input}: ${e.message}`);
}
if (!Array.isArray(scene.elements)) fail("this does not look like an .excalidraw file (no elements array)");
if (!existsSync(path.join(ROOT, "dist/bundle.js"))) fail("dist/bundle.js missing - run: npm run build");

const chromePath = findChrome();
if (!chromePath) fail("Chrome/Chromium/Edge not found. Install one or pass --chrome <path>.");

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: process.getuid?.() === 0 ? ["--no-sandbox"] : [],
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[browser error]", e.message));
  page.on("requestfailed", (r) => console.error("[request failed]", r.url()));
  await page.goto(origin + "/", { waitUntil: "load" });

  const result = await page.evaluate(
    (scene, opts) => window.renderScene(scene, opts),
    scene,
    {
      mode: args.mode,
      order: args.order,
      padding: args.padding === undefined ? undefined : Number(args.padding),
      scale: Number(args.scale),
      dark: args.dark ? true : args.light ? false : undefined,
      background: !args.transparent,
      backgroundColor: args.background,
    },
  );
  log(`mode: ${result.mode}${result.dark ? " (dark)" : ""}, ${result.pages.length} page(s)`);

  const merged = await PDFDocument.create();
  merged.setTitle(path.basename(input).replace(/\.excalidraw$/i, ""));
  merged.setProducer("excalidraw2pdf");

  for (let i = 0; i < result.pages.length; i++) {
    const { name, width, height } = result.pages[i];
    const fit = Math.min(1, MAX_PAGE_PX / Math.max(width, height));
    const w = Math.round(width * fit * 100) / 100;
    const h = Math.round(height * fit * 100) / 100;

    await page.evaluate((i, w, h) => window.showPage(i, w, h), i, w, h);
    const bytes = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      pageRanges: "1",
      preferCSSPageSize: true,
    });
    const part = await PDFDocument.load(bytes);
    const [copied] = await merged.copyPages(part, [0]);
    merged.addPage(copied);
    log(`  page ${i + 1}: ${name} (${Math.round(width)} x ${Math.round(height)} px)`);
  }

  await fs.writeFile(output, await merged.save());
  log(`wrote ${output}`);
} finally {
  await browser.close();
  server.close();
}
