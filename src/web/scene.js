// Scene loading, slide detection, cut-line bands and per-region SVG export.
// Everything here runs in the browser; no server is needed.
import {
  exportToSvg,
  restoreElements,
  restoreAppState,
  getCommonBounds,
} from "@excalidraw/excalidraw";

const FRAMES = new Set(["frame", "magicframe"]);
const SLIDE_ID = "__slide__";
const DEVANAGARI = "Noto Sans Devanagari";
const SVG_NS = "http://www.w3.org/2000/svg";
const BAND_PAD = 8; // blank space kept around the content of a page

// ------------------------------------------------------------------ load ---
export async function loadScene(json) {
  if (!json || !Array.isArray(json.elements)) {
    throw new Error("This doesn't look like an .excalidraw file (no elements found).");
  }
  const elements = restoreElements(json.elements, null).filter((e) => !e.isDeleted);
  if (!elements.length) throw new Error("This drawing is empty.");

  const appState = restoreAppState(json.appState || {}, null);
  const bounds = new Map(elements.map((e) => [e.id, getCommonBounds([e])]));
  const content = elements.filter((e) => !FRAMES.has(e.type));
  const [x1, y1, x2, y2] = getCommonBounds(content.length ? content : elements);
  const m = 40;
  const sceneRect = {
    x: Math.floor(x1) - m,
    y: Math.floor(y1) - m,
    w: Math.ceil(x2 - x1) + 2 * m,
    h: Math.ceil(y2 - y1) + 2 * m,
  };
  // a fully formed frame element to clone for every export region
  const frameTemplate = restoreElements(
    [{ type: "frame", id: "__tpl", x: 0, y: 0, width: 10, height: 10, name: null }],
    null,
  )[0];

  return {
    elements,
    files: json.files || {},
    appState,
    bounds,
    sceneRect,
    content: { x1, y1, x2, y2 },
    frameTemplate,
    dark: appState.theme === "dark",
    background: appState.viewBackgroundColor || "#ffffff",
  };
}

// ---------------------------------------------------------------- export ---
// Excalidraw sets its frame clipping with setAttributeNS(SVG_NS, "clip-path", ...).
// That is a *namespaced* attribute, which browsers do not treat as a presentation
// attribute when the SVG is used live in the page, so nothing was being clipped
// (parts of a picture outside the slide box showed up). Re-set every such
// attribute without a namespace so the clip really applies.
function fixNamespacedAttrs(svg) {
  for (const el of [svg, ...svg.querySelectorAll("*")]) {
    for (const a of Array.from(el.attributes)) {
      if (a.namespaceURI === SVG_NS) {
        const { localName, value } = a;
        el.removeAttributeNode(a);
        el.setAttributeNS(null, localName, value);
      }
    }
  }
}

/**
 * Export any rectangle of the canvas as its own SVG.
 * Excalidraw only draws the children of the frame it is exporting, so we make
 * a temporary frame at the rectangle and re-parent whatever overlaps it.
 */
export async function exportRegion(scene, r, { dark, background, skipFonts = true }) {
  const frame = {
    ...scene.frameTemplate,
    id: SLIDE_ID,
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    name: null,
    frameId: null,
  };
  const kids = [];
  for (const e of scene.elements) {
    if (FRAMES.has(e.type)) continue;
    const b = scene.bounds.get(e.id);
    if (b[0] < r.x + r.w && b[2] > r.x && b[1] < r.y + r.h && b[3] > r.y) {
      kids.push({ ...e, frameId: SLIDE_ID });
    }
  }
  const svg = await exportToSvg({
    elements: [frame, ...kids],
    appState: {
      exportBackground: true,
      exportScale: 1,
      // Excalidraw's own dark export uses a CSS filter, which Chrome prints as a
      // bitmap. We recolour in vector below instead.
      exportWithDarkMode: false,
      exportEmbedScene: false,
      viewBackgroundColor: background,
      frameRendering: { enabled: true, clip: true, name: false, outline: false },
    },
    files: scene.files,
    exportPadding: 0,
    exportingFrame: frame,
    skipInliningFonts: skipFonts ? true : undefined,
    reuseImages: true,
  });
  fixNamespacedAttrs(svg);
  addFallbackFont(svg);
  if (dark) applyDarkColors(svg);
  // the box is always shown at exactly its own shape, so never letterbox
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.overflow = "hidden";
  return svg;
}

/** Excalidraw's fonts (as data URLs) are declared once, document-wide. */
export async function installSceneFonts(scene) {
  const svg = await exportRegion(scene, scene.sceneRect, {
    dark: false,
    background: "#ffffff",
    skipFonts: false,
  });
  const css = [...svg.querySelectorAll("style")]
    .map((s) => s.textContent)
    .filter((t) => t.includes("@font-face"))
    .join("\n");
  document.getElementById("scene-fonts").textContent = css;
  scene.fontCss = css; // reused when pages are rendered to pictures for the direct download
  await document.fonts.ready;
}

let devanagariCss = null;
/**
 * Every font a slide needs, as @font-face rules with the font data inside, so a
 * slide can be drawn from a stand-alone SVG picture (which cannot see page fonts).
 */
export async function rasterFontCss(scene) {
  if (devanagariCss === null) {
    try {
      const res = await fetch(new URL("fonts/noto-sans-devanagari-400.woff2", document.baseURI).href);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      devanagariCss =
        `@font-face{font-family:"${DEVANAGARI}";font-weight:400;font-style:normal;` +
        `src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");` +
        `unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF}`;
    } catch {
      devanagariCss = "";
    }
  }
  return (scene.fontCss || "") + "\n" + devanagariCss;
}

function addFallbackFont(svg) {
  svg.querySelectorAll("text").forEach((t) => {
    const ff = t.getAttribute("font-family");
    if (ff && !ff.includes(DEVANAGARI)) t.setAttribute("font-family", `${ff}, "${DEVANAGARI}"`);
  });
}

// ------------------------------------------------- dark mode, kept vector ---
const INVERT = 0.93;
const HUE_180 = [
  [-0.574, 1.43, 0.144],
  [0.426, 0.43, 0.144],
  [0.426, 1.43, -0.856],
];
const darkMapper = (() => {
  let ctx, cache = new Map();
  const SENTINEL = "#010203";
  const skip = new Set(["none", "transparent", "currentcolor", "inherit", "initial"]);
  const parse = (value) => {
    ctx ||= document.createElement("canvas").getContext("2d");
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = value;
    const out = ctx.fillStyle;
    if (out === SENTINEL && value.trim().toLowerCase() !== SENTINEL) return null;
    if (out.startsWith("#")) {
      return [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16)).concat(1);
    }
    const m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(parseFloat);
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
        result =
          rgba[3] < 1
            ? `rgba(${r}, ${g}, ${b}, ${rgba[3]})`
            : "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
      }
    }
    cache.set(value, result);
    return result;
  };
})();

const COLOR_PROPS = ["fill", "stroke", "stop-color", "flood-color", "color"];
function applyDarkColors(svg) {
  for (const el of [svg, ...svg.querySelectorAll("*")]) {
    if (el.tagName.toLowerCase() === "image" || el.closest("image")) continue; // pictures keep their colours
    for (const p of COLOR_PROPS) {
      if (el.hasAttribute(p)) el.setAttribute(p, darkMapper(el.getAttribute(p)));
      const v = el.style?.getPropertyValue(p);
      if (v) el.style.setProperty(p, darkMapper(v));
    }
  }
}

// ------------------------------------------------------------- cut lines ---
/** True when a horizontal line at y would slice through something. */
export function cutsThrough(scene, y) {
  for (const e of scene.elements) {
    if (FRAMES.has(e.type)) continue;
    const b = scene.bounds.get(e.id);
    if (b[1] < y - 3 && b[3] > y + 3) return true;
  }
  return false;
}

/**
 * Turn cut lines into pages. A page is everything between two cut lines, trimmed on
 * all four sides to what is really in it (plus a small margin), so the content
 * fills the page. Nothing is ever ignored.
 */
export function bandsFromCuts(scene, cuts) {
  const c = scene.content;
  const ys = [c.y1, ...cuts.filter((y) => y > c.y1 && y < c.y2).sort((a, b) => a - b), c.y2];
  const out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y1 = ys[i], y2 = ys[i + 1];
    let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
    for (const e of scene.elements) {
      if (FRAMES.has(e.type)) continue;
      const b = scene.bounds.get(e.id);
      if (!(b[1] < y2 && b[3] > y1)) continue;
      top = Math.min(top, Math.max(b[1], y1));
      bottom = Math.max(bottom, Math.min(b[3], y2));
      left = Math.min(left, b[0]);
      right = Math.max(right, b[2]);
    }
    if (!(bottom > top)) continue;
    const x1 = left - BAND_PAD, x2 = right + BAND_PAD;
    const t = Math.max(y1, top - BAND_PAD), b = Math.min(y2, bottom + BAND_PAD);
    out.push({ x: Math.floor(x1), y: Math.floor(t), w: Math.ceil(x2 - x1), h: Math.ceil(b - t) });
  }
  return out;
}

const isPicture = (e) => e.type === "image" && e.width >= 120 && e.height >= 70;

/**
 * Where to cut so that every slide picture gets a page of its own, with the pen marks
 * and notes around it. Works from the pictures, so it does not matter how far apart
 * the slides are. Without pictures it cuts at every large empty gap instead.
 */
export function smartCuts(scene, minGap = 60) {
  const spans = scene.elements
    .filter((e) => !FRAMES.has(e.type))
    .map((e) => {
      const b = scene.bounds.get(e.id);
      return [b[1], b[3]];
    })
    .sort((a, b) => a[0] - b[0]);
  const runs = []; // vertical stretches that have something in them
  for (const [a, b] of spans) {
    const last = runs[runs.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else runs.push([a, b]);
  }
  const gaps = []; // empty stretches between them
  for (let i = 0; i < runs.length - 1; i++) gaps.push([runs[i][1], runs[i + 1][0]]);

  const rows = []; // slide pictures; pictures side by side share one row (= one page)
  const pics = scene.elements
    .filter(isPicture)
    .map((e) => {
      const b = scene.bounds.get(e.id);
      return { top: b[1], bottom: b[3] };
    })
    .sort((a, b) => a.top - b.top);
  for (const p of pics) {
    const r = rows[rows.length - 1];
    if (r && p.top < r.bottom - 0.3 * Math.min(p.bottom - p.top, r.bottom - r.top)) r.bottom = Math.max(r.bottom, p.bottom);
    else rows.push({ ...p });
  }

  if (rows.length < 2) {
    return gaps.filter(([a, b]) => b - a >= minGap).map(([a, b]) => Math.round((a + b) / 2));
  }
  const cuts = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const lo = rows[i].bottom, hi = rows[i + 1].top;
    const between = gaps.filter(([a, b]) => a >= lo - 1 && b <= hi + 1);
    if (between.length) {
      const [a, b] = between.reduce((m, g) => (g[1] - g[0] > m[1] - m[0] ? g : m));
      cuts.push(Math.round((a + b) / 2));
    } else cuts.push(Math.round((lo + hi) / 2)); // no clean gap: cut halfway and let the user adjust
  }
  return cuts;
}
