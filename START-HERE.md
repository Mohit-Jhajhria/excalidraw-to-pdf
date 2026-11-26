# Start here: put your website online

You need three things, and all of them are free: your GitHub account (`Mohit-Jhajhria`), the GitHub Desktop app you already have, and a Cloudflare account. You do not need to buy a domain.

The finished website is already built and sits in the `site` folder. Cloudflare will publish that folder. You never have to run a build.

Do the parts in order. Part 1 and Part 2 take about 15 minutes.

---

## Part 1: Put the folder on GitHub

1. Unzip the file you downloaded. You get a folder named `excalidraw-to-pdf`. Move it somewhere you will remember, such as Documents.
2. Open **GitHub Desktop** and sign in to GitHub if it asks.
3. Choose **File → Add local repository…** and pick the `excalidraw-to-pdf` folder.
4. GitHub Desktop says the folder is not a Git repository. Click **create a repository**.
5. In the window that opens, leave everything as it is (the name should be `excalidraw-to-pdf`). Do not tick "Initialize this repository with a README", and leave Git ignore and License on **None**: the folder already has them. Click **Create repository**.
6. On the left you will see a list of files (about 270). Type `First version` in the **Summary** box and click **Commit to main**.
7. Click **Publish repository** (top bar). Keep the name `excalidraw-to-pdf`. **Untick "Keep this code private"**, because the project is open source. Click **Publish repository**.

If the left side says the branch is `master` instead of `main`, tell me before you go on.

Your code is now at `https://github.com/Mohit-Jhajhria/excalidraw-to-pdf`.

---

## Part 2: Let Cloudflare publish it

Cloudflare's screens change from time to time, so the wording may differ a little. The settings that matter are the ones in the table.

1. Go to **dash.cloudflare.com** and sign in (make a free account if you do not have one).
2. Open **Workers & Pages** and click **Create application**. Choose the **Pages** option (look for "Looking to deploy Pages?" or "Import an existing Git repository") and click **Connect to Git**.
3. Choose **GitHub**, allow Cloudflare to read your repositories (you can allow only `excalidraw-to-pdf`), and pick the `excalidraw-to-pdf` repository.
4. Fill in the settings like this:

| Setting | What to enter |
| --- | --- |
| Project name | `excalidraw-to-pdf` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | leave empty |
| Build output directory | `site` |
| Environment variable (optional, recommended) | name `SKIP_DEPENDENCY_INSTALL`, value `1` (it makes publishing faster, because nothing needs to be installed) |

5. Click **Save and Deploy**. After a minute or two Cloudflare shows your address.

**Check the address.** It should be `https://excalidraw-to-pdf.pages.dev`. If Cloudflare shows a different address (for example with a few extra letters), tell me the exact address. The address is written in a few places on the website, and I will change them for you.

From now on, every time you save a change to GitHub, Cloudflare publishes it again by itself.

---

## Part 3: Check that it works

Open your address in Chrome and try these:

- The start page loads and the cut-line picture appears.
- Drop in an `.excalidraw` file, check the pages, and press **Download PDF**.
- `https://excalidraw-to-pdf.pages.dev/robots.txt` and `https://excalidraw-to-pdf.pages.dev/sitemap.xml` show text.
- Paste your address into WhatsApp or Discord. A card with the pink-and-indigo picture should appear (it can take a few minutes the first time).

---

## Part 4: Fill in the GitHub page

On `github.com/Mohit-Jhajhria/excalidraw-to-pdf`:

1. Click the small gear next to **About** and fill in:
   - **Description:** `Convert Excalidraw to PDF with one slide per page and no blank space. Free, runs in your browser.`
   - **Website:** `https://excalidraw-to-pdf.pages.dev`
   - **Topics:** `excalidraw`, `excalidraw-to-pdf`, `pdf`, `pdf-converter`, `converter`, `export`, `diagram`, `whiteboard`, `slides`, `open-source`
2. **Settings → General → Social preview:** upload `site/og-image.png`.
3. Click **Releases → Create a new release**, write the tag `v1.0.0`, title `First version`, and publish. This makes the project look active.
4. Later, replace `docs/before-after.png` with a real before and after: the bad PDF from another converter on the left, a PDF from your tool on the right. This picture convinces people more than anything else.

---

## Part 5: Tell Google and Bing

Search engines find new sites slowly unless you introduce yourself. Both are free.

**Google Search Console** (search.google.com/search-console)

1. Click **Add property** and choose **URL prefix**. Enter `https://excalidraw-to-pdf.pages.dev/`.
2. Choose the **HTML tag** way to verify. Google shows a line that starts with `<meta name="google-site-verification"`. Send me that line (or paste it into `web/index.html` where the comment says "Google Search Console"). Then the site must be rebuilt, which I can do for you, and published.
3. Click **Verify**.
4. Open **Sitemaps** on the left, enter `sitemap.xml` and click **Submit**.

**Bing Webmaster Tools** (bing.com/webmasters): sign in and choose **Import from Google Search Console**. This is the quickest way. Several search tools and AI assistants use Bing's results.

Expect a few days to a few weeks before the site appears in search.

---

## Part 6: Tell people about it

Do one place per day, always say that you made it, and read each community's rules on self-promotion first. Do not paste the same post everywhere.

- **Reddit, r/excalidraw:** "I made a free tool that converts an Excalidraw drawing to a multi-page PDF, one slide per page, with no blank space. It runs in your browser, so the file is never uploaded. Feedback welcome." Add the before and after picture and the link.
- **Hacker News:** the title `Show HN: Excalidraw to PDF, one slide per page, runs in your browser` and the link.
- **A short blog post** on dev.to or Medium: "Why my Excalidraw PDF had tiny slides on blank pages, and how I fixed it". It gives search engines and AI tools another page that mentions your tool.
- **Questions people already ask:** wherever someone asks how to export Excalidraw to PDF (GitHub issues, forums, Q&A sites), answer helpfully and mention your tool as one option.
- **Answer issues quickly** in the first month. Early visitors decide whether the project is alive.

---

## Changing the website later

The easy way: ask me, and I will give you the changed files.

The do-it-yourself way: edit the files in `web/` (the page text is `web/index.html`), then in a terminal inside the folder run `npm install` once and `npm run web:build`. This rebuilds the `site` folder. In GitHub Desktop, commit the changes and click **Push origin**. Cloudflare publishes it within a minute or two.

The `site` folder is rebuilt from `web/` and `src/` every time, so never edit files inside `site` by hand.
