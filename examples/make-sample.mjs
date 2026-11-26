// Generates examples/sample.excalidraw: 3 dark 16:9 frames with mixed
// Hindi + English text, shapes, bound text and arrows. Used to test the tool.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
let n = 0;
const id = (p) => `${p}${++n}`;
const seed = () => 1000 + ++n * 7919;

const base = (type, x, y, width, height, extra = {}) => ({
  id: id(type[0]), type, x, y, width, height, angle: 0,
  strokeColor: "#e9ecef", backgroundColor: "transparent", fillStyle: "solid",
  strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100,
  groupIds: [], frameId: null, roundness: null, seed: seed(), version: 1,
  versionNonce: seed(), isDeleted: false, boundElements: null, updated: 1,
  link: null, locked: false, ...extra,
});

const text = (x, y, str, fontSize, frameId, extra = {}) =>
  base("text", x, y, Math.max(20, str.length * fontSize * 0.55), fontSize * 1.25 * str.split("\n").length, {
    text: str, originalText: str, fontSize, fontFamily: 5, textAlign: "left",
    verticalAlign: "top", containerId: null, autoResize: true, lineHeight: 1.25,
    frameId, ...extra,
  });

const W = 1920, H = 1080, GAP = 200;
const items = [
  ["एक जैसा काम", "Function / Purpose"],
  ["भाग और पूर्ण", "Part : Whole"],
  ["कारण और परिणाम", "Cause : Effect"],
  ["जनक और संतान", "Parent : Child"],
  ["औज़ार और कारीगर", "Tool : Worker"],
  ["गुण और वस्तु", "Quality : Object"],
  ["विलोम शब्द", "Antonyms"],
  ["समानार्थी शब्द", "Synonyms"],
  ["स्थान और वस्तु", "Place : Thing"],
  ["क्रिया और कर्ता", "Action : Doer"],
];

const elements = [];
for (let s = 0; s < 3; s++) {
  const fy = s * (H + GAP);
  const frame = base("frame", 0, fy, W, H, {
    name: `Slide ${s + 1}`, strokeColor: "#bbb", id: `frame${s + 1}`,
  });
  elements.push(frame);
  const f = frame.id;

  elements.push(base("rectangle", 0, fy, W, H, {
    backgroundColor: "#1b1b1f", strokeColor: "#1b1b1f", strokeWidth: 1, frameId: f,
  }));
  elements.push(text(380, fy + 70, `Types of Analogy (सादृश्यता के प्रकार) - Part ${s + 1}`, 56, f, {
    strokeColor: "#ffffff",
  }));

  items.forEach(([hi, en], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 140 + col * 900, y = fy + 260 + row * 110;
    elements.push(text(x, y, `${i + 1}. ${hi}`, 36, f, { strokeColor: "#ffd43b" }));
    elements.push(text(x + 40, y + 48, en, 26, f, { strokeColor: "#a5d8ff", fontFamily: 6 }));
  });

  // a rectangle with bound text + an arrow, to exercise shapes and binding
  const boxId = `box${s}`, boxText = `boxtext${s}`;
  elements.push(base("rectangle", 1380, fy + 900, 420, 110, {
    id: boxId, strokeColor: "#69db7c", backgroundColor: "#2b8a3e55", fillStyle: "hachure",
    roundness: { type: 3 }, frameId: f, boundElements: [{ id: boxText, type: "text" }],
  }));
  elements.push(text(1400, fy + 930, "याद रखें!\nRemember this", 28, f, {
    id: boxText, containerId: boxId, textAlign: "center", verticalAlign: "middle",
    strokeColor: "#69db7c", width: 380, height: 70,
  }));
  elements.push(base("arrow", 1250, fy + 955, 110, 0, {
    strokeColor: "#ff8787", frameId: f, points: [[0, 0], [110, 0]],
    startArrowhead: null, endArrowhead: "arrow", startBinding: null, endBinding: null,
    lastCommittedPoint: null, roundness: { type: 2 },
  }));
}

const scene = {
  type: "excalidraw", version: 2, source: "excalidraw2pdf-sample",
  elements,
  appState: { viewBackgroundColor: "#ffffff", gridSize: null },
  files: {},
};
fs.writeFileSync(path.join(dir, "sample.excalidraw"), JSON.stringify(scene, null, 2));
console.log(`wrote examples/sample.excalidraw (${elements.length} elements, 3 frames)`);
