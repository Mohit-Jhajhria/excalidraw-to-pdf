/**
 * Pure layout functions — no browser APIs, no Excalidraw imports.
 * Extracted so they can be unit-tested with node:test without a DOM.
 *
 * A "scene" passed here only needs:
 *   scene.elements  – array of elements (with .type and .id)
 *   scene.bounds    – Map<id, [x1, y1, x2, y2]>
 *   scene.content   – { x1, y1, x2, y2 }  (bounding box of all non-frame elements)
 */

const FRAMES = new Set(["frame", "magicframe"]);
const BAND_PAD = 8; // blank space kept around the content of a page (must match scene.js)

// ---------------------------------------------------------------- cut lines ---

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
 * Turn cut lines into pages. Each page is the region between two cut lines,
 * trimmed on all four sides to the actual content (plus a small margin), so
 * the content fills the page and nothing is ever dropped.
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
      top    = Math.min(top,    Math.max(b[1], y1));
      bottom = Math.max(bottom, Math.min(b[3], y2));
      left   = Math.min(left,   b[0]);
      right  = Math.max(right,  b[2]);
    }
    if (!(bottom > top)) continue;
    const x1 = left  - BAND_PAD, x2 = right + BAND_PAD;
    const t  = Math.max(y1, top    - BAND_PAD);
    const b  = Math.min(y2, bottom + BAND_PAD);
    out.push({ x: Math.floor(x1), y: Math.floor(t), w: Math.ceil(x2 - x1), h: Math.ceil(b - t) });
  }
  return out;
}

const isPicture = (e) => e.type === "image" && e.width >= 120 && e.height >= 70;

/**
 * Where to cut so that every slide picture gets a page of its own, keeping the
 * pen marks and notes around it. Without pictures it cuts at every large empty
 * gap instead.
 */
export function smartCuts(scene, minGap = 60) {
  const spans = scene.elements
    .filter((e) => !FRAMES.has(e.type))
    .map((e) => { const b = scene.bounds.get(e.id); return [b[1], b[3]]; })
    .sort((a, b) => a[0] - b[0]);

  const runs = []; // vertical stretches that contain something
  for (const [a, b] of spans) {
    const last = runs[runs.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else runs.push([a, b]);
  }
  const gaps = []; // empty vertical stretches between runs
  for (let i = 0; i < runs.length - 1; i++) gaps.push([runs[i][1], runs[i + 1][0]]);

  const rows = []; // slide pictures; pictures side-by-side share one row (= one page)
  const pics = scene.elements
    .filter(isPicture)
    .map((e) => { const b = scene.bounds.get(e.id); return { top: b[1], bottom: b[3] }; })
    .sort((a, b) => a.top - b.top);
  for (const p of pics) {
    const r = rows[rows.length - 1];
    if (r && p.top < r.bottom - 0.3 * Math.min(p.bottom - p.top, r.bottom - r.top))
      r.bottom = Math.max(r.bottom, p.bottom);
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
    } else {
      cuts.push(Math.round((lo + hi) / 2)); // no clean gap: cut halfway, let the user adjust
    }
  }
  return cuts;
}
