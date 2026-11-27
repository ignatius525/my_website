# CLAUDE.md

Personal portfolio site: a single-page React app with Three.js (react-three-fiber) 3D scenes, Tailwind styling, and Framer Motion scroll animations. **Theme: 16-bit pixel art, "shepherd at dusk"**, matching the owner's LinkedIn banner (the owner's analogy for their role is a sheep herder). The structure follows the well-known "3D developer portfolio" tutorial layout, and some tutorial leftovers are still in the code (see **Known issues**).

## Commands

```bash
npm install        # node_modules is not committed
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm run preview    # serve the built dist/ locally
npm run lint       # eslint src, --max-warnings 0 (any warning fails)
```

Always commit `package-lock.json` after any dependency change. Amplify installs from the lockfile, and a lockfile out of sync with `package.json` fails `npm ci`.

There are **no tests**. `vite.config.js` has a `test` block (jsdom, `./src/test/setup.ts`), but vitest is not installed and that setup file does not exist. It is leftover config. The `resolve.alias` for `./runtimeConfig` is also leftover (an AWS SDK/Amplify workaround) and nothing uses it.

Deployed on **AWS Amplify Hosting**, with the domain on Route 53. Amplify builds from the git repo. Production response headers (CSP, HSTS, etc.) come from `customHttp.yml` at the repo root; see **Security**.

## Stack

- Vite 4, React 18 (JSX only, no TypeScript; `@types/*` are installed only for editor hints)
- `three`, `@react-three/fiber` v8, `@react-three/drei` v9, `maath` (star field)
- `framer-motion` v10 for section and element animations
- Tailwind 3 with PostCSS. Custom theme is in `tailwind.config.cjs`.
- Pixel fonts are self-hosted via `@fontsource`: **Press Start 2P** for headings (`font-pixel`) and **Pixelify Sans** for body text (`font-sans`, the default, set on `html, body` in `index.css`, not on `*`, so `font-pixel` spans can override it). Both are imported in `main.jsx`. Don't use Google Fonts, because the CSP blocks them. Pixelify's own "5" looks like an "S", so a tiny **"Pixel Five"** face (`src/assets/fonts/pixel-five-*.woff2`, one redrawn glyph per weight, `unicode-range: U+0035`, OFL) sits in front of it in the stack (`index.css` and Tailwind `sans`). If the Pixelify version changes, re-measure the grid table `P` in `scripts/pixel-five.py` from the new S/5 outlines, then rerun it (fonttools). Its `fi`/`fl` ligatures look like a capital "A", so `index.css` sets `font-variant-ligatures: no-common-ligatures` on `html, body`.
- `@emailjs/browser` v4 handles the contact form (no backend)
- No router. It's a single page, and all navigation uses `#anchor` links. `react-router-dom` was removed: it was only used for one home link and carried open-redirect advisories. Don't add it back for anchor navigation.
- `react-parallax-tilt` (About cards)
- `maplibre-gl` **6.x** (live subway map only, lazy-loaded). Stay on ≥ 6.4.1: everything up to 6.4.0, including the whole 5.x line, has a critical XSS advisory in `DOM.sanitize()`.

## Layout

```
index.html              # <head>: title, OG meta tags (no favicon right now)
src/main.jsx            # React root (StrictMode)
src/App.jsx             # page composition; order of sections lives here
src/index.css           # Tailwind layers, base font, pixel-art utilities (.pixel-frame, .pixel-shadow, .sun-gradient, .night-sky, .grass-edge, .pixelated, .pixel-img)
src/styles.js           # shared Tailwind class strings (padding, hero/section heading text)
src/utils/motion.js     # Framer Motion variant factories: textVariant, fadeIn, zoomIn, slideIn, staggerContainer
src/hoc/SectionWrapper.jsx  # HOC: wraps a section in motion.section + anchor span
src/constants/index.js  # ALL site content: navLinks, services, technologies, experiences, profile, testimonials, projects
src/assets/index.js     # central re-export of every image in src/assets
src/components/         # page sections (Navbar, Hero, About, SteamProfile, Tech, Footer, Feedbacks, Contact, Loader)
src/components/SteamProfile.jsx  # Work experience as a Steam-style gamer profile (+ Workshop = projects)
src/components/canvas/  # r3f canvases: pasture/ (hero scene), Ball (tech wool balls), Earth + Stars (only used by disabled Contact)
src/components/canvas/pasture/  # Pasture.jsx (Canvas, camera rig), herd.js (all character behaviour), Characters.jsx (Sheep, Dog + bark bubble, Shepherd), Landscape.jsx (sky, sun, clouds, stars, hills, ground, pen), voxel.jsx (shared cube, toon materials, <Vox>), palette.js + layout.js (pure data: colors, PEN, mulberry32)
src/components/PixelArt.jsx  # <PixelSprite> + SPRITES: pixel art as char grids -> crisp SVG (navbar sheep logo, About icons, footer)
src/components/Footer.jsx    # grass strip with sheep sprites
public/                 # GLTF models loaded at runtime by URL (not imported)
src/components/Subway.jsx    # the #subway section; lazy-loads src/subway/map/SubwayMap.jsx when scrolled near
src/subway/engine/      # fun-mta's Python backend ported to JS, run in a Web Worker (worker.js): feeds -> placed trains + drawn lines
src/subway/map/         # SubwayMap.jsx (React shell: HUD, legend), controller.js (MapLibre + 1 Hz animation), theme.js (pasture skin + basemap style), icons.js
src/subway/data/        # network.json (static network, generated) and landmarks.json (popularity-ranked allow-list)
scripts/mta/            # export_network.py (regenerates network.json) and the parity check vs the original Python
```

Barrel files: `src/components/index.js`, `src/components/canvas/index.js`, `src/hoc/index.js`, `src/assets/index.js`. When you add a component or asset, also export it from its barrel.

## Page composition (`src/App.jsx`)

Order: `Navbar`, `Hero` (full-screen 3D pasture), then `<main className="night-sky">` containing `About`, `SteamProfile` (anchor `#work`), `Subway` (anchor `#subway`, the live map), `Tech`, then `Footer`.
`Feedbacks` (testimonials) and the `Contact` + `StarsCanvas` block are commented out. Contact is **temporarily disabled**; App.jsx has a comment listing what to restore.

## Conventions and patterns

- **Content changes go in `src/constants/index.js`**, not in the components. Experience entries are listed oldest first. Each has `game` (display name), `title`, `company_name`, `icon`, `iconBg`, `start`/`end` (`"YYYY-MM"`, `end: null` = current job), and `achievements: [{ title, icon, text, metric?, team? }]`. `text` is the resume bullet, verbatim. `icon` is a `SPRITES` key. `metric` puts it in "Rarest Achievements". `team` groups bullets under a subheading (Bloomberg). `profile` holds the header, skills (sidebar badges), education (groups) and contact links (friends). `projects` feeds the Workshop showcase (`status: "released" | "coming-soon"`). Pixelify Sans's capital B reads like an 8, so spell out figures like "$13 billion" rather than "$13B".
- **Adding an image:** put it in `src/assets/` (or `tech/` or `company/`), import and re-export it in `src/assets/index.js`, then reference it from constants.
- **Steam profile (`SteamProfile.jsx`):** layout borrowed from Steam Community profiles (header + Level, showcases on the left, sidebar on the right; on phones the sidebar comes last), restyled in the pixel palette. Never use Valve/Steam logos or wordmarks. Derived values:
  - Level = full years since `profile.careerStart`.
  - Hours on record ≈ 40 hrs/week between `start` and `end` (or today).
  - "Currently In-Game" = the entry with `end: null`.
  - Achievement lists are native `<details>`, with no JS state.
- **Sections:** export as `SectionWrapper(Component, "anchorId")`. The id becomes the `#anchor` target, and `navLinks[].id` must match it. Current ids are `about`, `work` (the Steam profile), `subway` (live map) and `tech`; the Workshop showcase also has `#projects`, and `#recent-activity` is a jump target inside the profile. The `contact` nav link is commented out while Contact is disabled. Child elements animate by using `variants={...}` from `utils/motion.js`. The wrapper's `staggerContainer` drives `hidden` → `show` on scroll into view (`once: true`). The trigger is `amount: "some"` with a bottom margin, not a fraction: `amount: 0.25` can never fire for sections taller than 4× the viewport (the Steam profile on phones), which then stay invisible.
- **Headings:** use `styles.sectionSubText` (small uppercase label) followed by `styles.sectionHeadText` (big title, conventionally ending with a period, e.g. "Overview.").
- **Colors:** the palette was sampled from the banner. It's defined twice, as Tailwind tokens in `tailwind.config.cjs` and as `PALETTE` in `pasture/palette.js`; keep them in sync. Surfaces: `night`/`primary` `#1c1938`, `tertiary` (cards) `#2c2547`. Text: `white-100` (cream) `#f6eac6`, `secondary` (lavender) `#b9aed0`. Accents: `sun` `#ffc666`, `ember`, `horizon`, `wood`/`wood-light`/`wood-dark`, `grass*`, `wool*`, `lantern`. Use tokens, not new hex values.
- **Pixel-art look:** no rounded corners. Frame panels with `.pixel-frame` (a 4px wood frame with notched corners; set `--frame` to recolor, or use `.pixel-frame-sun`/`.pixel-frame-plum`). Headings get `.pixel-shadow`. For new icons, add a char-grid sprite to `SPRITES` in `PixelArt.jsx` (all rows must be the same width) instead of using raster images. Any r3f canvas should sit inside a `.pixelated` wrapper with a fractional `dpr` and `antialias: false`.
- Custom breakpoint `xs: 450px`. The hero scene reframes for portrait viewports in `CameraRig` (`Pasture.jsx`).
- Code style is loose: mixed quotes and semicolons, 2-space indent, and Tailwind class strings often broken across lines. Match the surrounding file rather than reformatting it.

## Live subway map (`src/subway/`)

A port of the owner's **fun-mta** project (Python FastAPI + MapLibre, built for a Raspberry Pi wall display): every NYC subway train, live. Read its README for the why behind the algorithms; the key comments are carried over into the JS.

- **No backend / no extra Amplify deployment.** The MTA feeds send `Access-Control-Allow-Origin: *` and need no API key, so the browser polls them directly. The Python backend is ported to `src/subway/engine/` and runs in a **module Web Worker** (`worker.js`), which plays the FastAPI server's part: `store.js` produces what `/api/trains`, `/api/network.geojson` and `/api/health` returned. The alerts feed (~490 kB, unused by the map) is not fetched.
- **The feeds carry no coordinates.** A train is placed from the stop it is heading for, the stop it last left (remembered across polls in `tracker.js`, inferred from the graph on first sight) and the predicted arrival, interpolated along a per-stop-pair segment table (`locator.js`). `active.js` + `network.js` redraw only the track in current use and fan shared rails into parallel lines.
- **Static data** (`src/subway/data/network.json`, 1.5 MB, ~270 kB gzipped, imported with `?url` so it ships as a hashed, immutably cached asset): built by fun-mta's own Python, vendored verbatim in `scripts/mta/mta_map/` (config, geo, static_gtfs, network; if they change in fun-mta, copy them again).
  - **Refreshed nightly** by `.github/workflows/refresh-subway-data.yml` (05:00 UTC; also runnable from the Actions tab): it downloads the current static GTFS (3 tries), exports, validates (sanity floors, refuses a >20% shrink with exit 3, then `scripts/mta/check_network.mjs` loads it into the browser engine) and, only if the data changed, commits to `main` as github-actions[bot], which triggers the Amplify deploy. Two jobs: `build` (read-only token, no persisted credentials) runs pip, Python and the download and hands over only the JSON as an artifact; `publish` (contents: write) runs nothing but git on a clean checkout, rebasing onto `main` before pushing. If a night fails with "shrank", check MTA really cut service, then use "Run workflow" with `allow_shrink` ticked (by hand: `--allow-shrink`). MTA republishes every few weeks, so most nights commit nothing. Actions are SHA-pinned and Python deps hash-pinned (`scripts/mta/requirements.txt`). GitHub pauses scheduled workflows after 60 days without repo activity; re-enable it in the Actions tab if that happens.
  - **By hand:** `python3.12 -m venv .venv-mta && .venv-mta/bin/pip install --require-hashes -r scripts/mta/requirements.txt && .venv-mta/bin/python scripts/mta/export_network.py --fresh` (`--fresh` skips the 7-day download cache in `scripts/mta/.cache/`).
  - The export is deterministic: no timestamps, and segments sorted by stop pair (fun-mta's own order follows Python's per-process string hash seed). An unchanged schedule rewrites the file byte for byte. An old export keeps working (unknown stop pairs fall back to graph/straight paths).
- **Parity with the Python is the test.** `network.js` reproduces Python's iteration order exactly, because walk order decides which side of the rails each route is drawn on. That order depends on CPython's 2-point `frozenset` iteration, which JS can't compute, so the exporter records it per edge (`pFirstPQ`/`pFirstQP` flags and first-occurrence positions). `engine/py.js` mirrors the CPython float semantics used (`%`, `//`, Neumaier `sum`). After any engine or exporter change, run `scripts/mta/parity_reference.py` (needs the full fun-mta package installed, since it drives its Store and API) + `parity_check.mjs` (usage in their headers) on recorded feeds (fun-mta's `tests/fixtures/pair/a`, `b`, or a fresh capture). Drawn geometry must match bit for bit; train numbers to within Python's output rounding. The one deliberate difference: the browser pauses while the map is off screen, so after a gap over `RESUME_GAP` (150 s) the store forgets its cross-poll memory and starts fresh (otherwise ~20% of trains were drawn on straight chords from stale history); `parity_reference.py` mirrors that reset. The engine also corrects for a visitor clock more than 90 s off the feeds' header times.
- **GTFS-RT decoding is hand-written** (`gtfsrt.js`): protobuf libraries compile decoders with `new Function`, which the CSP forbids. It is bounds-checked and treats the feed as untrusted (2 MB / 3000-train caps, `redirect: 'error'`, no credentials or referrer). `vite.config.js` emits MapLibre's `.mjs` worker as `.js`, so hosts serve it with a JavaScript MIME type (module workers require one, and `nosniff` is on).
- **Feed strings are untrusted.** Popups and the legend use DOM nodes / React text, never HTML strings; keep it that way.
- **MapLibre under the CSP:** `setWorkerUrl()` points at its worker file imported with `?url` (same origin, module worker); without it MapLibre falls back to a `blob:` worker that `worker-src 'self'` blocks. MapLibre's CSS forces `position: relative` on the map container, so size it with `w-full h-full`, not `absolute inset-0` (that collapsed it to 0 px).
- **Cost control:** `Subway.jsx` lazy-loads the map (MapLibre ~300 kB gzipped, the engine, the network data) only when the section comes within 300 px of the viewport, and `controller.setActive()` stops polling and animating while the map is off-screen or the tab hidden. Each active visitor fetches the 8 feeds (~140 kB gzipped) once a minute.
- **Pasture skin** (`map/theme.js`): site palette tokens for the basemap (OpenMapTiles schema served by OpenFreeMap) and chrome; route colours keep MTA hues, warmed for dusk. Trains are the navbar's pixel sheep (`SPRITES.sheep`) with route-coloured wool, facing their direction of travel. Map labels use OpenFreeMap's Noto Sans glyphs (MapLibre needs SDF glyph PBFs, so the site's pixel fonts can't be used on the map; the HUD and legend use them). The map renders at pixelRatio 1, upscaled with `image-rendering: pixelated`.
- **Gestures:** `cooperativeGestures` (Ctrl/⌘ + scroll, two-finger pan) so the page still scrolls past the map; it is switched off in fullscreen (the fullscreen control takes the whole shell, HUD and legend included).
- The map adds one more WebGL (2) context to the page: hero + ~12 tech balls + map ≈ 14 of the browser's ~16.

## 3D / canvas notes

- **Hero = `PastureCanvas`** (`canvas/pasture/`). It's a voxel scene built entirely in code (no GLTF, no textures to download): sheep, two shepherds (red/blue shirts like the banner), two border collies, a pen with a lantern, a banded dusk sky, a sun with a dithered halo, clouds, stars, and hills.
  - Cursor orbits the camera around the look-at target (`MAX_YAW` ≈ 24°, `MAX_LIFT` in `Pasture.jsx`), eased.
  - **Clicks:** `ClickToHerd` is one `click` listener on the canvas plus an analytic ray-vs-ground-plane (y=0) hit. There are no meshes or per-move raycasts, and sky clicks are ignored. `ClickMarker` shows a pixel target until a dog arrives. A one-time hint ("Click"/"Tap the field to send the dogs") sits just above the scroll indicator. None of these mount under reduced motion. Anything overlaid on the hero must be `pointer-events-none` (except real links) or it swallows clicks on the field.
  - **Pixel look:** it renders at `dpr = 1/4` (1/3 on phones) and the canvas is upscaled with `image-rendering: pixelated`. `MeshToonMaterial` with a 3-step ramp gives banded shading. Everything is a scaled shared unit cube (`<Vox s p c />`). Sky objects use unlit `flat()` materials so they show exact palette colors. `Canvas flat` disables tone mapping so colors match the palette.
  - **Layout is deterministic** (`mulberry32` seeds). **Behaviour lives in `herd.js`**, which has no React/three imports, so it runs in plain Node. Per-character "brain" objects are mutated by `stepWorld()` once per frame, and the components in `Characters.jsx` only pose meshes from them (no React state per frame).
    - Sheep modes: graze, idle (looks around), amble, browse (head-down slow walk), follow (trails a flock-mate), frolic (hops), regroup, flee (from dogs; from further away when a dog barks). Targets are chosen by `freeSpot()` away from other sheep, and steering avoids sheep ahead.
    - Dogs (collie + brown-orange, `DOG_COATS`) modes: herd (orbit the flock), dash (to the stray), trot, sit, watch, bark (pops a "!" bubble), and **command** (click-to-herd, below). A shepherd's "signal" (raising the crook) sends the nearest non-commanded dog on a dash.
    - **Click-to-herd:** `commandHerd(w, x, z)` sends both dogs to opposite flanks of the clicked spot. They bark on arrival, circle it, and spook sheep within 4 units (vs 2.4 normally). The nearest idle shepherd signals. A repeat click within 2 units only extends the job. After `COMMAND_TIME` (7s) without clicks, the dogs resume their routines. Command targets are clamped to `CMD_ROAM` (which reaches nearer the camera than `ROAM`, for portrait phones) and kept outside the pen.
    - Shepherds: stand, walk (inside `SHEPHERD_ZONE`), signal.
    - **Collisions:** the pen is a solid box (`PEN_BLOCK`). `steerTo()` routes around it via corner waypoints, and `pushOutOfBox` is the backstop. Character-vs-character pushes are capped per frame (`maxStep`) so overlaps ease apart instead of teleporting.
    - When changing behaviour, soak-test it headlessly: import `createWorld`/`stepWorld` in Node, step about 36k frames with jittered `dt`, and assert no dog/shepherd inside the fence, no sheep pairs closer than ~1.5, no NaN, and a small max per-frame move. Mix in random `commandHerd` calls, including points inside the pen, far off the field, near pen corners, and near the camera, and check that commanded dogs actually arrive (none stuck at pen corners).
  - The sky dome, sun, stars and clouds live in a group that follows the camera (no parallax). The sky texture is a stepped gradient keyed by elevation (`SKY_BANDS`), tuned so the warm bands sit just above the hills, as in the banner.
  - It pauses when off-screen (IntersectionObserver → `frameloop="demand"`) and is static for `prefers-reduced-motion`.
- `EarthCanvas` (disabled Contact) still loads `public/planet` via `useGLTF`. Keep model paths relative (no leading `/`). The git history shows deploy breakage fixed by relative paths. The models in `public/` (`planet`, `desktop_pc` 15 MB, `marcus_aurelius` 14 MB, `st_maria` 28 MB, spaceship) are leftovers from the old theme; none are used by the visible page.
- Canvases use `frameloop="demand"` and `gl={{ preserveDrawingBuffer: true }}`, plus `<Suspense fallback={<CanvasLoader />}>` and `<Preload all />`. `Loader.jsx` shows a `useProgress` percentage.
- `BallCanvas` (tech "wool balls", rendered at `dpr 0.5` + `.pixelated`) creates **one WebGL context per technology**, about 12 of them. Browsers cap active contexts at around 16, so adding many more tech balls can cause older contexts to be lost. Consider this before growing `technologies`.
- `Stars` imports `maath/random/dist/maath-random.esm` by deep path.

## Contact form / env

**Currently disabled** (not rendered, nav link removed, EmailJS removed from the CSP). To re-enable it, uncomment the block in `App.jsx`, restore the `contact` entry in `navLinks`, and add `https://api.emailjs.com` to `connect-src` in both `customHttp.yml` and `vite.config.js`.

`Contact.jsx` sends through EmailJS using the env vars listed in `.env.example`. Set them in `.env.local` for local work and in Amplify → Environment variables for production. Anything prefixed `VITE_` is compiled into the public bundle. The EmailJS public key is meant to be public, but never put a private key or other secret in a `VITE_` var.

Template params sent: `from_name`, `from_email`, `reply_to`, `message`. The **recipient address lives in the EmailJS template**, not in the client. Never send a `to_email` param: if the template read it, anyone with the public key could send mail to arbitrary addresses through the account.

Spam and abuse protections in `Contact.jsx` (keep them when editing the form):
- Hidden `website` honeypot field. If it's filled in, the form fakes success and sends nothing.
- `blockHeadless: true` and `limitRate` (one send per 60s per browser; error status 429) in the EmailJS v4 options
- Trimmed input, email pattern check, `maxLength` limits (`LIMITS`), and the button is disabled while sending
- The real enforcement is in the EmailJS dashboard (allowed origins/domain restriction, optional CAPTCHA). Client checks are only a first filter.

## Security

- **Response headers** are defined in `customHttp.yml` (Amplify) and mirrored in `securityHeaders` in `vite.config.js` (applied only to `npm run preview`). **Change both together.** The preview copy deliberately leaves out HSTS and `upgrade-insecure-requests`, which would break `http://localhost`. The dev server deliberately gets no CSP, because Vite's HMR needs inline scripts and websockets.
- CSP: code (`script-src`, `worker-src`) is `'self'` only. The only third-party origins are **data** for the live subway map, in `connect-src`: `https://api-endpoint.mta.info` (realtime feeds) and `https://tiles.openfreemap.org` (vector tiles + label glyphs). Adding any other third-party script, font, image host, analytics, CDN, or API means adding it to the CSP in both places, or it will silently break in production. Test with `npm run build && npm run preview` and check the browser console for CSP violations.
- **Always call `useGLTF(path, false, false)`** (Draco and meshopt off). By default drei sets up the meshopt decoder, which compiles WebAssembly and is blocked by `script-src 'self'` ("violates ... 'unsafe-eval'" in the console). Draco fetches its decoder from `www.gstatic.com`. No current model is compressed. If you swap in one that is, prefer decompressing it (e.g. `gltf-transform`). Otherwise enable the flag and add `'wasm-unsafe-eval'` to `script-src` (plus the gstatic origin for Draco) in both header configs.
- `style-src` keeps `'unsafe-inline'` as a precaution for runtime-injected styles. It may not be needed: to test, try `style-src 'self'` under `npm run preview` and watch the console.
- Permissions-Policy blocks camera, microphone, geolocation, payment, and usb, but deliberately not gyroscope/accelerometer, because `react-parallax-tilt` uses device orientation on phones.
- When re-enabling `Feedbacks`, its `randomuser.me` images will be blocked by `img-src`. Self-host them or add the origin.
- On Amplify, `customHttp.yml` path patterns use a leading slash (`/assets/*`). `**` matches everything.
- External links opened from JS need `window.open(url, "_blank", "noopener,noreferrer")`, and `<a target="_blank">` needs `rel="noopener noreferrer"`.
- `.env` and `.env.*` are gitignored (except `.env.example`).
- **AI crawler opt-out** (the policy is: allow search engines and link previews, block AI). It's made of `public/robots.txt` (named AI user agents → `Disallow: /`, plus a Content-Signal line), `public/.well-known/tdmrep.json`, and the `tdm-reservation: 1` and `X-Robots-Tag: noai, noimageai` headers. These are requests, not enforcement. Never block `Googlebot`, `Bingbot`, `Applebot`, or link-preview bots (`facebookexternalhit`, `LinkedInBot`, `Twitterbot`, `Slackbot`, `Discordbot`). Don't add an `llms.txt`, because it invites LLM use rather than blocking it. New AI user agents appear regularly, so update the list in `robots.txt`.

## Known issues / leftovers (as of Nov 2026)

Fix these when asked, or flag them when touching nearby code:

- `npm audit` (dev only) still reports esbuild/vite dev-server advisories. They're fixed only in Vite 6+ (a major upgrade) and don't affect the deployed bundle, since production deps audit clean.

- Link previews: OG/Twitter tags live in static `index.html` (crawlers don't run JS). `og:image` is the absolute URL `https://www.ignatmiagkov.com/og-banner.jpg` (`public/og-banner.jpg`, the LinkedIn banner, 1400×349). If the domain or image changes, update the absolute URLs. iMessage and other platforms cache previews, so changes can take a while to show. The page `<title>` is still "IM Website".
- `Feedbacks.jsx` is a stub. `testimonials` is tutorial placeholder data.
- `Loader.jsx` uses class `canvas-load`, but the CSS defines `.canvas-loader`, so the spinner never shows (only the % text).
- `Contact.jsx`: `flex[0.75]` should be `flex-[0.75]`.
- `src/assets/index.js` still re-exports images nothing imports (meta, tesla, starbucks, shopify; tech html, css, redux, tailwind, mongodb, threejs, spring, javascript, git). Vite tree-shakes them, so it's cosmetic.
- Old-theme assets are unused: `src/assets/city-bg.jpg`, `herobg.png`, `web-hog.png`, the `web/mobile/backend/creator.png` illustrations, and the GLTF models in `public/`.
- Lint fails on the current tree. Almost all errors are `react/no-unknown-property` on react-three-fiber JSX props (e.g. `args`, `position`, `intensity`) and `react/prop-types`. Fixing it is a config change: configure r3f props in `no-unknown-property` and turn off `prop-types`. Until then, lint isn't usable as a gate.
