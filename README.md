# The Pile — cockpile.com

A single-page physics toy. No build step: `index.html`, the physics library in `js/`, cut-outs in `images/`, background gallery in `images/gallery/`. Hosted on Cloudflare — push to GitHub and it redeploys within a minute.

## What it does

- Cut-outs fall from the top and pile up. They're floppy: each one is a chain of jointed slices (traced automatically from the image's outline), drawn as one smoothly bending image.
- Now and then a piece squirms.
- Grab one to pull it around — it grows and comes "closer to camera", shoving the others aside.
- Fling one hard and it flies off, leaving a wet, drippy slime streak across the screen that dries up over 6 seconds.
- Sound effects (made in code, no files): a wet squelch and a moan when you grab one (each piece has its own voice pitch), a soft plap when you let go, a gloopy flapping schlorp when you throw, and fleshy wet slaps when they hit each other. The **Sound** button mutes it (remembered per browser). Sound starts after the first tap — browsers require that.
- Behind everything, the gallery images scroll past as one continuous reel, left to right, in random order.

## Adding cut-outs

1. **Prepare each image**
   - Cut the drawing out onto a **transparent background** (PNG).
   - Any pose works. Thin bits (ribs, limbs, hatching) are filled in for the physics automatically.
   - Optimise: crop tight, about **640px** on the longest side, save as **WebP** (quality ~85) — around 30–40 KB each.
   - Name it lowercase with hyphens, e.g. `big-grumpy.webp`.
2. Put it in `images/`.
3. In `index.html`, find `const CUTOUTS` and add a line: `"images/big-grumpy.webp",`
4. Commit and push.

To take one out of the pile, delete its line from `CUTOUTS`.

## Adding gallery images

1. Export JPG, about **1600px** on the longest side, quality ~78 (100–200 KB).
2. Put it in `images/gallery/`.
3. In `index.html`, find `const GALLERY` and add a line: `"images/gallery/new-one.jpg",`
4. Change the reel speed with `GALLERY_SECONDS` (roughly how long each image takes to pass).

## Tweaking the feel

Near the top of the script, `const FEEL = { ... }`:

| Setting | What it does |
|---|---|
| `floppiness` | Spring stiffness of the joints. Lower = floppier (1 is a limp noodle, 6 is stiff; currently 3.6). |
| `bounce` | Lower = more wobble after a knock. |
| `maxBend` | How far one joint can fold (radians). |
| `squirm` | How lively the squirming is. 0 turns it off. |
| `fallDrag` | Higher = slower, floatier fall. |
| `grabSize` | How much bigger a grabbed piece gets. |
| `throwSpeed` | How hard you have to fling to throw one away. |
| `trailSeconds` | How long a thrown one's slime trail stays on screen. |

Sound: `const SOUND = { volume, bumpVolume, moanVolume }` sets overall loudness, the collision slaps and the moans. The individual sounds are in `sfx` (`grab`, `moan`, `drop`, `throw`, `bump`).

Other things: page colours are `--bg1`, `--bg2`, `--accent` at the top of the `<style>`; how fast new ones drop is `spawnInterval()`; how full the pile gets is `capacity()`.

### Testing

- Add `#debug` to the address (`cockpile.com/#debug`) to see the physics shapes (blue = moving, grey = asleep).
- On a computer you can drag image files onto the page to try them in the pile — just for you, until you refresh.

## Connecting to Cloudflare (one-time, already done)

Workers & Pages → Create → Connect to Git → this repo. Framework preset **None**, no build command, output directory `/`. Custom domain `cockpile.com`.

Physics by [Planck.js](https://piqnt.com/planck.js/) (a JavaScript port of Box2D, MIT licence — `js/planck-LICENSE.txt`). Drawing uses WebGL, with a plain canvas fallback.
