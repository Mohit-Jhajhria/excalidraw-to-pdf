# Contributing

Thanks for helping. This project has one job: turn an Excalidraw drawing into a good multi-page PDF, simply.

## Reporting a problem

Please open an issue and include:

- A screenshot of the page list in the tool
- A screenshot of the PDF page that looks wrong
- Your `.excalidraw` file, if you can share it (remove private content first)
- Your browser and operating system

## Suggesting a feature

Ideas are welcome. Please explain the problem you want solved, not only the feature. The tool aims to stay simple, so a new feature should work without adding settings for the user to learn.

## Changing the code

The website is built from these files:

| Where | What |
| --- | --- |
| `web/index.html` | The page text, FAQ and search-engine tags |
| `web/style.css` | All the styling |
| `web/public/` | `robots.txt`, `sitemap.xml`, `og-image.png` (copied to the site as they are) |
| `src/web/` | The tool itself (opening the file, cut lines, making the PDF) |
| `build-web.mjs` | Builds everything into the `site` folder |

```bash
npm install
npm run web        # builds the site and serves it at http://localhost:8080
npm run web:build  # only builds
```

The `site` folder is the finished website. It is committed on purpose, so Cloudflare Pages can publish it without running a build. After you change anything in `web/`, `src/` or `build-web.mjs`, run `npm run web:build` and commit the updated `site` folder together with your change.

Keep the FAQ in `web/index.html` identical to the FAQ data in the page's JSON-LD block (the `<script type="application/ld+json">` near the top). Search engines compare the two.

## Pull requests

- Keep changes small and focused: one idea per pull request
- Say what you tested and in which browser
- By contributing, you agree that your code is shared under the MIT license of this repository
