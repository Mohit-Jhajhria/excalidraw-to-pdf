// Scene loading, slide detection, cut-line bands and per-region SVG export.
// Everything here runs in the browser; no server is needed.
import {
  exportToSvg,
  restoreElements,
  restoreAppState,
  getCommonBounds,
} from "@excalidraw/excalidraw";

// Pure layout logic lives in core.mjs so it can be tested without a DOM.
export { cutsThrough, bandsFromCuts, smartCuts } from "../core.mjs";

const FRAMES = new Set(["frame", "magicframe"]);
const SLIDE_ID = "__slide__";
const DEVANAGARI = "Noto Sans Devanagari";
const SVG_NS = "http://www.w3.org/2000/svg";

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

// The cut-line and band functions are in ../core.mjs (re-exported above).
