/**
 * Unit tests for the pure layout functions in src/core.mjs.
 * Run with:  node --test test/scene.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cutsThrough, bandsFromCuts, smartCuts } from "../src/core.mjs";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a minimal scene from a list of {id, x1, y1, x2, y2, type?} boxes. */
function makeScene(boxes) {
  const elements = boxes.map(({ id, x1, y1, x2, y2, type = "rectangle", width, height }) => ({
    id, type,
    x: x1, y: y1,
    width:  width  ?? x2 - x1,
    height: height ?? y2 - y1,
  }));
  const bounds = new Map(boxes.map(({ id, x1, y1, x2, y2 }) => [id, [x1, y1, x2, y2]]));
  const xs = boxes.map((b) => b.x1);
  const ys = boxes.map((b) => b.y1);
  const xe = boxes.map((b) => b.x2);
  const ye = boxes.map((b) => b.y2);
  const content = {
    x1: Math.min(...xs), y1: Math.min(...ys),
    x2: Math.max(...xe), y2: Math.max(...ye),
  };
  return { elements, bounds, content };
}

// ─── cutsThrough ────────────────────────────────────────────────────────────

test("cutsThrough – line misses all elements (above everything)", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 100, x2: 200, y2: 200 }]);
  assert.equal(cutsThrough(scene, 50), false);
});

test("cutsThrough – line misses all elements (below everything)", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 100, x2: 200, y2: 200 }]);
  assert.equal(cutsThrough(scene, 250), false);
});

test("cutsThrough – line passes through the middle of an element", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 100, x2: 200, y2: 200 }]);
  assert.equal(cutsThrough(scene, 150), true);
});

test("cutsThrough – line at the top edge of an element is not a cut-through", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 100, x2: 200, y2: 200 }]);
  // y = 100: element starts at 100, so b[1] < y - 3 is 100 < 97 → false
  assert.equal(cutsThrough(scene, 100), false);
});

test("cutsThrough – frame elements are ignored", () => {
  const scene = makeScene([{ id: "f", x1: 0, y1: 0, x2: 500, y2: 500, type: "frame" }]);
  assert.equal(cutsThrough(scene, 250), false);
});

test("cutsThrough – line in the gap between two elements is not a cut-through", () => {
  const scene = makeScene([
    { id: "a", x1: 0, y1:   0, x2: 100, y2: 100 },
    { id: "b", x1: 0, y1: 200, x2: 100, y2: 300 },
  ]);
  assert.equal(cutsThrough(scene, 150), false);
});

// ─── bandsFromCuts ───────────────────────────────────────────────────────────

test("bandsFromCuts – no cuts produces one band covering all content", () => {
  const scene = makeScene([
    { id: "a", x1: 10, y1:  10, x2: 200, y2: 100 },
    { id: "b", x1: 10, y1: 200, x2: 200, y2: 300 },
  ]);
  const bands = bandsFromCuts(scene, []);
  assert.equal(bands.length, 1);
  assert.ok(bands[0].h > 0, "band should have positive height");
});

test("bandsFromCuts – one cut between two elements produces two bands", () => {
  const scene = makeScene([
    { id: "a", x1: 10, y1:  10, x2: 200, y2: 100 },
    { id: "b", x1: 10, y1: 200, x2: 200, y2: 300 },
  ]);
  const bands = bandsFromCuts(scene, [150]);
  assert.equal(bands.length, 2);
  // first band should contain element a
  assert.ok(bands[0].y <= 10 + 8, "first band top should be near element a");
  // second band should contain element b
  assert.ok(bands[1].y + bands[1].h >= 300 - 8, "second band should reach element b");
});

test("bandsFromCuts – cuts outside the content range are ignored", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 100, x2: 200, y2: 200 }]);
  const bands = bandsFromCuts(scene, [-999, 999]);
  assert.equal(bands.length, 1, "out-of-range cuts should be ignored");
});

test("bandsFromCuts – empty band between two cuts is dropped", () => {
  const scene = makeScene([
    { id: "a", x1: 0, y1:   0, x2: 100, y2:  80 },
    { id: "b", x1: 0, y1: 320, x2: 100, y2: 400 },
  ]);
  // cuts at 100 and 300 create a middle region with nothing in it → dropped
  const bands = bandsFromCuts(scene, [100, 300]);
  assert.equal(bands.length, 2, "empty band should be dropped");
});

// ─── smartCuts ───────────────────────────────────────────────────────────────

test("smartCuts – single element: no cuts", () => {
  const scene = makeScene([{ id: "a", x1: 0, y1: 0, x2: 400, y2: 300 }]);
  assert.deepEqual(smartCuts(scene), []);
});

test("smartCuts – two elements with a large gap: one cut in the middle of the gap", () => {
  const scene = makeScene([
    { id: "a", x1: 0, y1:   0, x2: 400, y2: 100 },
    { id: "b", x1: 0, y1: 300, x2: 400, y2: 400 },
  ]);
  const cuts = smartCuts(scene);
  assert.equal(cuts.length, 1);
  assert.ok(cuts[0] > 100 && cuts[0] < 300, `cut ${cuts[0]} should be in the gap 100–300`);
});

test("smartCuts – gap smaller than minGap is ignored", () => {
  const scene = makeScene([
    { id: "a", x1: 0, y1:   0, x2: 400, y2: 100 },
    { id: "b", x1: 0, y1: 120, x2: 400, y2: 200 }, // gap = 20px, below default 60
  ]);
  assert.deepEqual(smartCuts(scene), []);
});

test("smartCuts – two slide pictures get one cut between them", () => {
  // 'image' elements larger than 120x70 are treated as slides
  const scene = makeScene([
    { id: "s1", x1: 10, y1:   0, x2: 410, y2: 230, type: "image", width: 400, height: 230 },
    { id: "s2", x1: 10, y1: 350, x2: 410, y2: 580, type: "image", width: 400, height: 230 },
  ]);
  const cuts = smartCuts(scene);
  assert.equal(cuts.length, 1);
  assert.ok(cuts[0] > 230 && cuts[0] < 350, `cut ${cuts[0]} should be between the two slides`);
});

test("smartCuts – three slide pictures get two cuts", () => {
  const scene = makeScene([
    { id: "s1", x1: 0, y1:   0, x2: 400, y2: 200, type: "image", width: 400, height: 200 },
    { id: "s2", x1: 0, y1: 320, x2: 400, y2: 520, type: "image", width: 400, height: 200 },
    { id: "s3", x1: 0, y1: 640, x2: 400, y2: 840, type: "image", width: 400, height: 200 },
  ]);
  const cuts = smartCuts(scene);
  assert.equal(cuts.length, 2);
  assert.ok(cuts[0] < cuts[1], "cuts should be in ascending order");
});
