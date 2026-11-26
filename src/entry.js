// Runs inside headless Chromium. Uses Excalidraw's own exporter, so the
// geometry, hand-drawn strokes, arrowheads, bound text, images and frame
// clipping are identical to what Excalidraw draws on its canvas.
import {
  exportToSvg,
  restoreElements,
  restoreAppState,
} from "@excalidraw/excalidraw";

const DEVANAGARI_FAMILY = "Noto Sans Devanagari";

// Excalidraw does not ship a Devanagari font, so Hindi/Marathi/Sanskrit text
// would fall back to whatever the machine happens to have. Load a known font
// and append it to every text element's font stack.
function installFallbackFont() {
  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "${DEVANAGARI_FAMILY}";
      src: url("/noto/noto-sans-devanagari-devanagari-400-normal.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: block;
      unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9,
        U+25CC, U+A830-A839, U+A8E0-A8FF;
    }
    html, body { margin: 0; padding: 0; background: transparent; }
    svg { display: block; }
  `;
  document.head.appendChild(style);
}

function addFallbackToText(svg) {
  svg.querySelectorAll("text").forEach((t) => {
    const attr = t.getAttribute("font-family");
    if (attr && !attr.includes(DEVANAGARI_FAMILY)) {
      t.setAttribute("font-family", `${attr}, "${DEVANAGARI_FAMILY}"`);
    }
    if (t.style && t.style.fontFamily && !t.style.fontFamily.includes(DEVANAGARI_FAMILY)) {
      t.style.fontFamily = `${t.style.fontFamily}, "${DEVANAGARI_FAMILY}"`;
    }
  });
}

// ---- Dark mode, kept as vector ------------------------------------------
// Excalidraw's own dark export wraps the SVG in `filter: invert(93%)
// hue-rotate(180deg)`. Chrome rasterizes filtered content when printing, so
// the PDF would become one big bitmap (no selectable text, huge file).
// Instead we apply the *same colour maths* to every colour in the SVG, which
// keeps everything as vector paths and real text.
const INVERT = 0.93;
const HUE_180 = [
  [-0.574, 1.43, 0.144],
  [0.426, 0.43, 0.144],
  [0.426, 1.43, -0.856],
];

function makeDarkMapper() {
  const ctx = document.createElement("canvas").getContext("2d");
  const cache = new Map();
  const SENTINEL = "#010203";
  const skip = new Set(["none", "transparent", "currentcolor", "inherit", "initial"]);

  const parse = (value) => {
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = value; // invalid colours are ignored by the canvas
    const out = ctx.fillStyle;
    if (out === SENTINEL && value.trim().toLowerCase() !== SENTINEL) return null;
    if (out.startsWith("#")) {
      return [
        parseInt(out.slice(1, 3), 16), parseInt(out.slice(3, 5), 16),
        parseInt(out.slice(5, 7), 16), 1,
      ];
    }
    const m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };

  return (value) => {
    if (!value) return value;
    if (cache.has(value)) return cache.get(value);
    let result = value;
    const v = value.trim().toLowerCase();
    if (!skip.has(v) && !v.startsWith("url(")) {
      const rgba = parse(value);
      if (rgba) {
        const inv = rgba.slice(0, 3).map((c) => INVERT + (c / 255) * (1 - 2 * INVERT));
        const rot = HUE_180.map((row) => row[0] * inv[0] + row[1] * inv[1] + row[2] * inv[2]);
        const [r, g, b] = rot.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
        const a = rgba[3];
        result = a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})`
          : "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
      }
    }
    cache.set(value, result);
    return result;
  };
}

const COLOR_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "color"];
const COLOR_STYLE_PROPS = ["fill", "stroke", "stop-color", "flood-color", "color"];

function applyDarkColors(svg) {
  const map = makeDarkMapper();
  const nodes = [svg, ...svg.querySelectorAll("*")];
  for (const el of nodes) {
    if (el.closest("image") || el.tagName.toLowerCase() === "image") continue; // never recolour pictures
    for (const attr of COLOR_ATTRS) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, map(el.getAttribute(attr)));
    }
    if (el.style) {
      for (const prop of COLOR_STYLE_PROPS) {
        const val = el.style.getPropertyValue(prop);
        if (val) el.style.setProperty(prop, map(val));
      }
    }
  }
}

function sortFrames(frames, order) {
  const list = [...frames];
  if (order === "name") {
    list.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { numeric: true }),
    );
  } else if (order === "position") {
    // reading order: top to bottom, then left to right
    list.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }
  return list; // "array" keeps Excalidraw's own element order
}

window.__pages = [];
window.__excalidraw = { exportToSvg, restoreElements, restoreAppState, makeDarkMapper }; // for debugging/tests

/**
 * scene: parsed .excalidraw JSON
 * opts: { mode, order, padding, scale, dark, background }
 * returns: [{ name, width, height }] and keeps the SVG nodes in window.__pages
 */
window.renderScene = async (scene, opts) => {
  installFallbackFont();

  const elements = restoreElements(scene.elements || [], null).filter(
    (e) => !e.isDeleted,
  );
  const savedState = restoreAppState(scene.appState || {}, null);
  const files = scene.files || {};

  const dark = opts.dark ?? savedState.theme === "dark";
  const baseState = {
    exportBackground: opts.background,
    exportScale: opts.scale,
    viewBackgroundColor: opts.backgroundColor || savedState.viewBackgroundColor || "#ffffff",
    // never use Excalidraw's filter-based dark export (it rasterizes the PDF)
    exportWithDarkMode: false,
    exportEmbedScene: false,
  };

  const frames = elements.filter(
    (e) => e.type === "frame" || e.type === "magicframe",
  );
  const mode = opts.mode === "auto" ? (frames.length ? "frames" : "single") : opts.mode;

  const jobs = [];
  if (mode === "frames") {
    if (!frames.length) throw new Error("No frames found in this file (use --mode single).");
    for (const f of sortFrames(frames, opts.order)) {
      jobs.push({
        name: f.name || `Frame ${jobs.length + 1}`,
        frame: f,
        padding: opts.padding ?? 0,
        // crop exactly to the frame: no title label, no outline
        frameRendering: { enabled: true, clip: true, name: false, outline: false },
      });
    }
  } else {
    jobs.push({
      name: "Drawing",
      frame: null,
      padding: opts.padding ?? 24,
      frameRendering: savedState.frameRendering,
    });
  }

  const meta = [];
  for (const job of jobs) {
    // NB: the public exportToSvg takes ONE options object (the positional
    // signature in the internal types is not what the package exports).
    const svg = await exportToSvg({
      elements,
      appState: { ...baseState, frameRendering: job.frameRendering },
      files,
      exportPadding: job.padding,
      exportingFrame: job.frame,
      renderEmbeddables: false,
    });
    addFallbackToText(svg);
    if (dark) applyDarkColors(svg);
    const width = parseFloat(svg.getAttribute("width"));
    const height = parseFloat(svg.getAttribute("height"));
    window.__pages.push(svg);
    meta.push({ name: job.name, width, height });
  }
  return { mode, dark, pages: meta };
};

// Put page `i` on screen at a given size, sized exactly like the PDF page.
window.showPage = async (i, pageWidth, pageHeight) => {
  const svg = window.__pages[i];
  svg.style.width = `${pageWidth}px`;
  svg.style.height = `${pageHeight}px`;
  document.body.replaceChildren(svg);

  let pageStyle = document.getElementById("__page");
  if (!pageStyle) {
    pageStyle = document.createElement("style");
    pageStyle.id = "__page";
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = `
    @page { size: ${pageWidth}px ${pageHeight}px; margin: 0; }
    html, body { width: ${pageWidth}px; height: ${pageHeight}px; overflow: hidden; }
  `;

  // wait until every font used on the page is really loaded before printing
  await document.fonts.ready;
  const used = new Set();
  svg.querySelectorAll("text").forEach((t) => used.add(t.textContent));
  await document.fonts.load(`16px "${DEVANAGARI_FAMILY}"`, "अ");
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
