// When index.html is opened straight from disk (file://), browsers refuse to
// fetch() the font files next to it, so Excalidraw silently falls back to a
// plain system font (or to a download from a CDN when online).
// fonts-embedded.js (loaded by index.html only for file://) carries the fonts
// inside the page, and this serves them from memory instead of fetching.
if (location.protocol === "file:") {
  const originalFetch = window.fetch.bind(window);
  const toBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const m = decodeURIComponent(url).match(/\/fonts\/((?:[^/?#]+\/)?[^/?#]+\.woff2)/);
      const data = m && window.__EMBEDDED_FONTS && window.__EMBEDDED_FONTS[m[1]];
      if (data) {
        return Promise.resolve(new Response(toBytes(data), { status: 200, headers: { "content-type": "font/woff2" } }));
      }
    } catch {
      /* fall through to the normal fetch */
    }
    return originalFetch(input, init);
  };
}
