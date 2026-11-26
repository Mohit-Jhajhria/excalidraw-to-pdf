import { build } from "esbuild";

await build({
  entryPoints: ["src/entry.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: "dist/bundle.js",
  minify: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env": '{"MODE":"production","DEV":false,"PROD":true}',
  },
  loader: { ".woff2": "dataurl", ".woff": "dataurl", ".svg": "dataurl", ".png": "dataurl" },
});
