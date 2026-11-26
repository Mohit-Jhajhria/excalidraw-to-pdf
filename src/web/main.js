import "./filefonts.js";
import { PDFDocument } from "pdf-lib";
import {
  loadScene, installSceneFonts, exportRegion, rasterFontCss,
  bandsFromCuts, smartCuts, cutsThrough,
} from "./scene.js";

const $ = (s, r = document) => r.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
function sv(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

// ----------------------------------------------------------------- state ---
// The whole app is: a drawing, some cut lines, and the pages they make.
const state = {
  fileName: "",
  scene: null,
  cuts: [], // y positions of the cut lines (drawing units)
  selCut: null,
  pages: [], // {x,y,w,h,off}  one per area between two cut lines
};
const view = { tx: 0, ty: 0, z: 1 };
let uid = 0, guideY = null, overlayEl = null;
const stage = $("#stage"), world = $("#world"), board = $("#board");
const sr = () => state.scene.sceneRect;

function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), ms);
}

// ------------------------------------------------------- page rendering ---
// LRU cache: keeps the most-recently-used SVG promises, drops the oldest first.
// Avoids the stampede that a plain cache.clear() causes when the limit is hit.
const MAX_CACHE = 80;
const cache = new Map();
function rawSvg(p) {
  const key = `${p.x},${p.y},${p.w},${p.h}`;
  if (cache.has(key)) {
    // Bump to the end of the Map so it counts as most-recently used.
    const v = cache.get(key);
    cache.delete(key);
    cache.set(key, v);
    return v;
  }
  // Evict the oldest entry before adding a new one.
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  const promise = exportRegion(state.scene, p, { dark: state.scene.dark, background: state.scene.background });
  cache.set(key, promise);
  return promise;
}
// the same SVG can be on screen twice, so its internal ids must be unique per copy
function uniqueClone(svg) {
  const c = svg.cloneNode(true);
  const p = `u${++uid}-`;
  const ids = new Set();
  c.querySelectorAll("[id]").forEach((el) => { ids.add(el.id); el.id = p + el.id; });
  if (ids.size) {
    c.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        let v = a.value;
        if (!v.includes("#")) continue;
        v = v.replace(/url\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${p}${id})` : m));
        if ((a.name === "href" || a.name === "xlink:href") && v[0] === "#" && ids.has(v.slice(1))) v = "#" + p + v.slice(1);
        if (v !== a.value) el.setAttribute(a.name, v);
      }
    });
  }
  return c;
}

// ----------------------------------------------------------- pages list ---
const THUMB_W = 300, THUMB_H = 220;
const included = () => state.pages.filter((p) => !p.off);

function updateSummary() {
  const n = state.pages.length, k = included().length;
  $("#summary").textContent = n ? `${n} page${n === 1 ? "" : "s"}${k < n ? `, ${n - k} left out` : ""}` : "";
  $("#btn-download").disabled = !k;
}

function renderPages() {
  if (!state.scene) return;
  board.replaceChildren();
  state.pages.forEach((p, i) => {
    // fit the side panel (card padding + border = 22px), including on narrow phones
    const maxW = board.clientWidth ? Math.min(THUMB_W, board.clientWidth - 22) : THUMB_W;
    const f = Math.min(maxW / p.w, THUMB_H / p.h);
    const thumb = h("div", { class: "thumb", style: `width:${Math.round(p.w * f)}px;height:${Math.round(p.h * f)}px` });
    rawSvg(p).then((svg) => {
      const c = uniqueClone(svg);
      c.setAttribute("width", "100%");
      c.setAttribute("height", "100%");
      thumb.append(c);
    });
    const box = h("input", { type: "checkbox", "aria-label": `Include page ${i + 1}` });
    box.checked = !p.off;
    box.addEventListener("change", () => {
      p.off = !box.checked;
      card.classList.toggle("off", p.off);
      updateSummary();
      renderOverlay();
    });
    const card = h("div", { class: "page" + (p.off ? " off" : "") },
      h("div", { class: "page-head" }, h("label", {}, box, `Page ${i + 1}`)),
      thumb);
    thumb.addEventListener("click", () => focusPage(p));
    board.append(card);
  });
  updateSummary();
}

// ------------------------------------------------------------- cut lines ---
/** Make the pages from the cut lines. A page you had left out stays left out. */
function rebuildPages() {
  const old = state.pages;
  state.pages = bandsFromCuts(state.scene, state.cuts).map((b) => {
    const mid = b.y + b.h / 2;
    return { ...b, off: old.some((o) => o.off && mid >= o.y && mid <= o.y + o.h) };
  });
}
function renderAll() {
  renderOverlay();
  renderPages();
}
const clampCut = (y) => clamp(Math.round(y), Math.ceil(state.scene.content.y1) + 3, Math.floor(state.scene.content.y2) - 3);

function addCut(y) {
  const c = state.scene.content;
  y = Math.round(y);
  if (y <= c.y1 + 2 || y >= c.y2 - 2) return;
  if (state.cuts.some((v) => Math.abs(v - y) < 4)) return;
  state.cuts.push(y);
  state.cuts.sort((a, b) => a - b);
  state.selCut = state.cuts.indexOf(y);
  rebuildPages();
  renderAll();
}
function removeCut(i) {
  if (i == null || i < 0 || i >= state.cuts.length) return;
  state.cuts.splice(i, 1);
  state.selCut = null;
  rebuildPages();
  renderAll();
}

// ---------------------------------------------------------- canvas view ---
function applyView() {
  clampView();
  world.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.z})`;
  $("#z-val").textContent = Math.round(view.z * 100) + "%";
  scheduleOverlay();
  updateScrollbar();
}
// keep at least a little of the drawing on screen
function clampView() {
  if (!state.scene) return;
  const r = stage.getBoundingClientRect(), s = sr(), m = 80;
  view.tx = clamp(view.tx, m - s.w * view.z, r.width - m);
  view.ty = clamp(view.ty, m - s.h * view.z, r.height - m);
}
let overlayQueued = false;
function scheduleOverlay() {
  if (overlayQueued) return;
  overlayQueued = true;
  requestAnimationFrame(() => { overlayQueued = false; renderOverlay(); });
}
/** Fit the width of the drawing and start at the top, like opening a document. */
function fitWidth() {
  const r = stage.getBoundingClientRect(), s = sr(), pad = 20;
  view.z = clamp((r.width - pad * 2) / s.w, 0.02, 2);
  view.tx = (r.width - s.w * view.z) / 2;
  view.ty = s.h * view.z < r.height ? (r.height - s.h * view.z) / 2 : pad;
  applyView();
}
function zoomAt(cx, cy, f) {
  const r = stage.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
  const nz = clamp(view.z * f, 0.02, 4);
  view.tx = px - (px - view.tx) * (nz / view.z);
  view.ty = py - (py - view.ty) * (nz / view.z);
  view.z = nz;
  applyView();
}
/** Bring a page to the top of the canvas. */
function focusPage(p) {
  const r = stage.getBoundingClientRect();
  view.tx = r.width / 2 - (p.x + p.w / 2 - sr().x) * view.z;
  view.ty = 16 - (p.y - sr().y) * view.z;
  applyView();
}
const toScene = (e) => {
  const r = stage.getBoundingClientRect();
  return { x: sr().x + (e.clientX - r.left - view.tx) / view.z, y: sr().y + (e.clientY - r.top - view.ty) / view.z };
};

// a slim scrollbar on the right of the canvas, for long drawings
const vbar = $("#vbar"), vthumb = $("#vthumb");
function updateScrollbar() {
  if (!state.scene) return;
  const vis = stage.clientHeight, total = sr().h * view.z;
  if (total <= vis * 1.02) { vbar.hidden = true; return; }
  vbar.hidden = false;
  const track = vbar.clientHeight;
  const size = Math.max(28, (track * vis) / total);
  const frac = clamp(-view.ty / (total - vis), 0, 1);
  vthumb.style.height = size + "px";
  vthumb.style.transform = `translateY(${frac * (track - size)}px)`;
}
let vdrag = null;
vthumb.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  vdrag = { y: e.clientY, ty: view.ty };
  vthumb.setPointerCapture(e.pointerId);
});
vthumb.addEventListener("pointermove", (e) => {
  if (!vdrag) return;
  const vis = stage.clientHeight, total = sr().h * view.z, track = vbar.clientHeight;
  const size = Math.max(28, (track * vis) / total);
  view.ty = vdrag.ty - ((e.clientY - vdrag.y) * (total - vis)) / Math.max(1, track - size);
  applyView();
});
vthumb.addEventListener("pointerup", () => { vdrag = null; });
vbar.addEventListener("pointerdown", (e) => {
  if (e.target !== vbar) return;
  const r = vbar.getBoundingClientRect();
  view.ty = -(((e.clientY - r.top) / r.height) * sr().h * view.z - stage.clientHeight / 2);
  applyView();
});

async function renderPreview() {
  const s = sr();
  const svg = await exportRegion(state.scene, s, { dark: state.scene.dark, background: state.scene.background });
  const clone = uniqueClone(svg);
  clone.setAttribute("width", s.w);
  clone.setAttribute("height", s.h);
  clone.classList.add("preview");
  world.querySelector("svg.preview")?.remove();
  world.prepend(clone);
}

function renderOverlay() {
  if (!state.scene || !overlayEl) return;
  const z = view.z;
  overlayEl.replaceChildren();
  state.pages.forEach((p, i) => {
    const g = sv("g", { class: p.off ? "off" : "" });
    g.append(sv("rect", { class: "box", x: p.x, y: p.y, width: p.w, height: p.h }));
    const label = String(i + 1), fs = 14 / z;
    const tag = sv("g", { class: "tag" });
    tag.append(sv("rect", { x: p.x, y: p.y, width: (0.7 * label.length + 1.1) * fs, height: 1.6 * fs, rx: 0.3 * fs }));
    const t = sv("text", { x: p.x + 0.5 * fs, y: p.y + 1.17 * fs, "font-size": fs });
    t.textContent = label;
    tag.append(t);
    g.append(tag);
    overlayEl.append(g);
  });
  const R = sr(), fs = 13 / z;
  state.cuts.forEach((y, i) => {
    const through = cutsThrough(state.scene, y);
    const g = sv("g", { class: "cut" + (state.selCut === i ? " sel" : "") + (through ? " through" : "") });
    g.append(sv("line", { class: "cut-line", x1: R.x, x2: R.x + R.w, y1: y, y2: y }));
    g.append(sv("line", { class: "cut-hit", "data-cut": i, x1: R.x, x2: R.x + R.w, y1: y, y2: y }));
    const tag = sv("g", { class: "cut-tag" });
    tag.append(sv("rect", { x: R.x + 6 / z, y: y - 0.8 * fs, width: (through ? 5.6 : 2.6) * fs, height: 1.6 * fs, rx: 0.3 * fs }));
    const tt = sv("text", { x: R.x + 6 / z + 0.5 * fs, y: y + 0.38 * fs, "font-size": fs });
    tt.textContent = through ? "✂ cuts through!" : "✂";
    tag.append(tt);
    g.append(tag);
    const del = sv("g", { class: "cut-del", "data-cutdel": i });
    del.append(sv("circle", { cx: R.x + R.w - 16 / z, cy: y, r: 10 / z }));
    const xt = sv("text", { x: R.x + R.w - 16 / z, y: y + 0.36 * fs, "font-size": 1.15 * fs, "text-anchor": "middle" });
    xt.textContent = "×";
    del.append(xt);
    g.append(del);
    overlayEl.append(g);
  });
  if (guideY != null) overlayEl.append(sv("line", { class: "guide", x1: R.x, x2: R.x + R.w, y1: guideY, y2: guideY }));
}

// ------------------------------------------------------ pointer handling ---
// Click = new cut line. Drag the background = move the view. Drag a pink line = move it.
let drag = null, spaceDown = false;
stage.addEventListener("pointerdown", (e) => {
  if (!state.scene || e.target.closest?.("#vbar")) return;
  stage.focus();
  const cutDel = e.target.closest?.("[data-cutdel]");
  const cutEl = e.target.closest?.("[data-cut]");
  if (e.button === 1 || spaceDown) drag = { type: "pan" };
  else if (e.button !== 0) return;
  else if (cutDel) { removeCut(+cutDel.dataset.cutdel); return; }
  else if (cutEl) {
    state.selCut = +cutEl.dataset.cut;
    drag = { type: "cutmove", idx: state.selCut, moved: false };
    renderOverlay();
  } else drag = { type: "click", start: toScene(e) };
  drag.sx = e.clientX; drag.sy = e.clientY; drag.tx = view.tx; drag.ty = view.ty;
  if (drag.type === "pan") stage.classList.add("pan");
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) {
    if (state.scene) { guideY = toScene(e).y; scheduleOverlay(); }
    return;
  }
  if (drag.type === "click" && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) >= 5) {
    drag.type = "pan"; // it was a drag, not a click
    stage.classList.add("pan");
    guideY = null;
  }
  if (drag.type === "pan") {
    view.tx = drag.tx + (e.clientX - drag.sx);
    view.ty = drag.ty + (e.clientY - drag.sy);
    applyView();
    return;
  }
  if (drag.type === "cutmove") {
    const y = clampCut(toScene(e).y);
    state.cuts[drag.idx] = y;
    state.cuts.sort((a, b) => a - b);
    drag.idx = state.cuts.indexOf(y);
    state.selCut = drag.idx;
    drag.moved = true;
    rebuildPages();
    renderOverlay();
  }
});
function endDrag(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  stage.classList.remove("pan");
  if (d.type === "click") addCut(d.start.y);
  else if (d.type === "cutmove" && d.moved) renderAll();
}
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("pointerleave", () => { if (guideY != null) { guideY = null; scheduleOverlay(); } });

// Mouse wheel / two-finger scroll moves the drawing like a document.
// Ctrl + wheel (and pinch on a touchpad) zooms.
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    zoomAt(e.clientX, e.clientY, Math.exp(-clamp(e.deltaY, -100, 100) * 0.0025));
    return;
  }
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1;
  let dx = e.deltaX * k, dy = e.deltaY * k;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  view.tx -= dx;
  view.ty -= dy;
  applyView();
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, select, textarea, dialog")) return;
  if (e.code === "Space") { spaceDown = true; if (e.target === stage) e.preventDefault(); }
  if (!state.scene) return;
  const step = e.target === stage;
  if (e.key === "Escape") { state.selCut = null; renderOverlay(); }
  else if (e.key === "0") fitWidth();
  else if ((e.key === "Delete" || e.key === "Backspace") && state.selCut != null) { e.preventDefault(); removeCut(state.selCut); }
  else if (step && e.key === "ArrowDown") { view.ty -= 90; applyView(); e.preventDefault(); }
  else if (step && e.key === "ArrowUp") { view.ty += 90; applyView(); e.preventDefault(); }
  else if (step && e.key === "PageDown") { view.ty -= stage.clientHeight * 0.9; applyView(); e.preventDefault(); }
  else if (step && e.key === "PageUp") { view.ty += stage.clientHeight * 0.9; applyView(); e.preventDefault(); }
  else if (step && e.key === "Home") { view.ty = 1e9; applyView(); e.preventDefault(); }
  else if (step && e.key === "End") { view.ty = -1e9; applyView(); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") spaceDown = false; });

// ------------------------------------------------------------ open a file ---
async function openScene(json, name = "drawing.excalidraw") {
  const scene = await loadScene(json);
  state.scene = scene;
  state.fileName = name.replace(/\.(excalidraw|json)$/i, "");
  state.cuts = []; state.pages = []; state.selCut = null;
  cache.clear();
  await installSceneFonts(scene);
  $("#empty").hidden = true;
  $("#workspace").hidden = false;
  document.body.classList.add("working"); // the top bar switches from start screen to editing
  if (!overlayEl) {
    overlayEl = sv("svg", { class: "overlay" });
    world.append(overlayEl);
  }
  const s = scene.sceneRect;
  world.style.width = s.w + "px";
  world.style.height = s.h + "px";
  overlayEl.setAttribute("viewBox", `${s.x} ${s.y} ${s.w} ${s.h}`);
  overlayEl.setAttribute("width", s.w);
  overlayEl.setAttribute("height", s.h);
  await renderPreview();
  fitWidth();
  state.cuts = smartCuts(scene);
  rebuildPages();
  renderAll();
  const n = state.pages.length;
  toast(n > 1
    ? `Split into ${n} pages. Check the pink lines: click to add one, click a line's × to remove it.`
    : "One page so far. Click between two slides to start a new page.", 7000);
}

async function openFile(file) {
  const err = $("#load-error");
  err.hidden = true;
  try {
    await openScene(JSON.parse(await file.text()), file.name);
  } catch (e) {
    console.error(e);
    err.textContent = e instanceof SyntaxError ? "That file isn't valid JSON, so it can't be an .excalidraw file." : e.message;
    err.hidden = false;
    toast(err.textContent, 6000);
  }
}
$("#btn-open").addEventListener("click", () => $("#file").click());
$("#btn-open2").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ""; });
window.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); $("#dropzone").classList.add("over"); } });
window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("#dropzone").classList.remove("over"); });
window.addEventListener("drop", (e) => {
  $("#dropzone").classList.remove("over");
  const f = e.dataTransfer?.files?.[0];
  if (f) { e.preventDefault(); openFile(f); }
});
$("#z-in").addEventListener("click", () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); });
$("#z-out").addEventListener("click", () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); });
$("#z-fit").addEventListener("click", fitWidth);
window.addEventListener("resize", () => { if (state.scene) applyView(); });

// ------------------------------------------------------------ PDF download ---
// Every page is drawn as a sharp picture (in tiles, so even a very tall page stays
// sharp) and put in a PDF whose page is exactly the shape of the content: no margins,
// no blank space. No print window is involved.
const TILE_PX = 4080; // a multiple of 8; the biggest picture piece we draw at once
const PT = 0.75; // one drawing unit = one screen pixel = 0.75 PDF points
const busy = $("#busy");
let cancelPdf = false;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not draw a page"));
    img.src = url;
  });
}
/** Draw one SVG (with its fonts packed inside) onto the canvas at exactly w x h pixels. */
async function drawSvg(ctx, svg, w, h, fontCss) {
  const c = svg.cloneNode(true);
  c.setAttribute("width", w);
  c.setAttribute("height", h);
  const style = document.createElementNS(NS, "style");
  style.textContent = fontCss;
  c.insertBefore(style, c.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    ctx.drawImage(await loadImage(url), 0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** How many picture pixels per drawing unit. Normal pages get 3, very large ones 2. */
const pickScale = (p) => (p.w * p.h <= 2.5e6 ? 3 : 2);

async function addPageToPdf(pdf, p, fontCss) {
  const scale = pickScale(p);
  const k = Math.min(PT, 14000 / Math.max(p.w, p.h)); // PDF pages cannot be taller than ~14000 pt
  const page = pdf.addPage([p.w * k, p.h * k]);
  const ts = TILE_PX / scale; // drawing units per tile
  for (let ty = 0; ty < p.h; ty += ts) {
    for (let tx = 0; tx < p.w; tx += ts) {
      const tw = Math.min(ts, p.w - tx), th = Math.min(ts, p.h - ty);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(tw * scale);
      canvas.height = Math.round(th * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = state.scene.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const whole = tw === p.w && th === p.h;
      const svg = whole ? await rawSvg(p) : await exportRegion(state.scene, { x: p.x + tx, y: p.y + ty, w: tw, h: th }, { dark: state.scene.dark, background: state.scene.background });
      await drawSvg(ctx, svg, canvas.width, canvas.height, fontCss);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      canvas.width = canvas.height = 0; // free the memory right away
      const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      page.drawImage(jpg, { x: tx * k, y: (p.h - ty - th) * k, width: tw * k, height: th * k });
      if (cancelPdf) throw new Error("cancelled");
      await new Promise((r) => setTimeout(r, 0)); // let the progress bar repaint
    }
  }
}

async function makePdfBytes(onProgress = () => {}) {
  const fontCss = await rasterFontCss(state.scene);
  const pdf = await PDFDocument.create();
  pdf.setTitle(state.fileName || "Excalidraw");
  pdf.setProducer("Excalidraw to PDF");
  pdf.setCreator("Excalidraw to PDF");
  const pages = included();
  for (let i = 0; i < pages.length; i++) {
    onProgress(i, pages.length);
    await addPageToPdf(pdf, pages[i], fontCss);
  }
  onProgress(pages.length, pages.length);
  return pdf.save();
}

async function downloadPdf() {
  if (!included().length) return;
  cancelPdf = false;
  $("#busy-text").textContent = "Starting…";
  $("#busy-bar").value = 0;
  busy.showModal();
  try {
    const bytes = await makePdfBytes((i, n) => {
      $("#busy-text").textContent = i < n ? `Making page ${i + 1} of ${n}…` : "Saving…";
      $("#busy-bar").value = (i / n) * 100;
    });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = h("a", { href: url, download: (state.fileName || "slides") + ".pdf" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const n = included().length;
    toast(`PDF saved: ${n} page${n === 1 ? "" : "s"}, ${(bytes.length / 1048576).toFixed(1)} MB`, 5000);
  } catch (e) {
    if (e.message !== "cancelled") {
      console.error(e);
      toast("Could not make the PDF: " + e.message, 9000);
    }
  } finally {
    busy.close();
  }
}
$("#btn-download").addEventListener("click", downloadPdf);
$("#busy-cancel").addEventListener("click", () => { cancelPdf = true; });
busy.addEventListener("cancel", (e) => { e.preventDefault(); cancelPdf = true; });

// handles for automated tests
window.__app = { state, view, openScene, addCut, removeCut, makePdfBytes, fitView: fitWidth };
