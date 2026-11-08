# The Pile — cockpile.com

A single-page physics toy. No build step: it's just `index.html`, the physics library in `js/`, and your cut-outs in `images/`, hosted on Cloudflare.

## Adding your cut-outs

1. **Prepare each image**
   - Cut the drawing out onto a **transparent background** and save as PNG.
   - Any pose works — the physics shape is traced automatically from each image's outline.
   - Optimise it: crop tight, about **640px** on the longest side, and save as **WebP** (quality ~85) — each one ends up around 30–40 KB. A PNG works too, just bigger.
   - Name it lowercase with hyphens, no spaces, e.g. `big-grumpy.webp`.

2. **Add the file** to the `images/` folder.

3. **Add one line to the list in `index.html`.** Search for `const CUTOUTS` and add:

   ```js
   "images/big-grumpy.webp",
   ```

   Once the list has at least one image, every falling piece uses your cut-outs (picked at random) and the cartoon placeholders and **Faces** button disappear. Empty the list to get the placeholders back.

4. **Commit and push.** Cloudflare redeploys automatically within a minute.

### Editing on github.com (no software needed)

- Open the repo → `images` → **Add file → Upload files** to add images.
- Open `index.html` → pencil icon → edit the `CUTOUTS` list → **Commit changes**.

### Trying images before uploading

On a computer, drag PNGs straight onto the live page. They're used just for you, in that tab, until you refresh — nothing is uploaded.

### Seeing the physics shapes

Add `#debug` to the address (`cockpile.com/#debug`) and reload to see the traced outlines drawn in blue.

## Other things you can change in `index.html`

- Title — the `<h1>` near the bottom of the HTML, and `<title>` in the `<head>`.
- Colours — `--bg1`, `--bg2`, `--accent` near the top.
- Placeholder colours — the `SKINS` list in the script.
- How fast they fall in — `spawnInterval()` (starts at one every 1.7s, speeds up to one every 0.35s).
- How full the pile gets — `capacity()` (about 65% of the screen).
- How big a grabbed one gets — `d.target = 1.75` in the `startdrag` handler.

## Connecting to Cloudflare (one-time)

1. Cloudflare dashboard → **Workers & Pages → Create → Connect to Git**.
2. Pick this repository.
3. Framework preset: **None**. Build command: *(leave empty)*. Build output directory: `/`.
4. Deploy, then **Custom domains → Set up a custom domain** → `cockpile.com`. The domain is already on Cloudflare, so DNS is added for you.

Physics by [Matter.js](https://brm.io/matter-js/) (MIT licence, `js/matter-LICENSE.txt`).
