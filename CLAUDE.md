# CLAUDE.md

Personal portfolio site: a single-page React app with Three.js (react-three-fiber) 3D scenes, Tailwind styling, and Framer Motion scroll animations. The structure follows the well-known "3D developer portfolio" tutorial layout, and some tutorial leftovers are still in the code (see **Known issues**).

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
- Poppins font is self-hosted via `@fontsource/poppins` (weights 400/500/600/700/800/900 imported in `main.jsx`). Don't reintroduce the Google Fonts `@import`, because the CSP blocks it.
- `@emailjs/browser` v4 handles the contact form (no backend)
- No router. It's a single page, and all navigation uses `#anchor` links. `react-router-dom` was removed: it was only used for one home link and carried open-redirect advisories. Don't add it back for anchor navigation.
- Two tilt libraries: `react-parallax-tilt` (About) and `react-tilt` (Works)
- `react-helmet` (only in the unused `OpenGraph` component)

## Layout

```
index.html              # <head>: title, OG meta tags (no favicon right now)
src/main.jsx            # React root (StrictMode)
src/App.jsx             # page composition; order of sections lives here
src/index.css           # Tailwind layers, global Poppins font-family, gradient + loader classes
src/styles.js           # shared Tailwind class strings (padding, hero/section heading text)
src/utils/motion.js     # Framer Motion variant factories: textVariant, fadeIn, zoomIn, slideIn, staggerContainer
src/hoc/SectionWrapper.jsx  # HOC: wraps a section in motion.section + anchor span
src/constants/index.js  # ALL site content: navLinks, services, technologies, experiences, testimonials, projects
src/assets/index.js     # central re-export of every image in src/assets
src/components/         # page sections (Navbar, Hero, About, Experience, Tech, Works, Feedbacks, Contact, Loader, OpenGraph)
src/components/canvas/  # r3f canvases: Computers, Earth, Ball, Stars
public/                 # GLTF models loaded at runtime by URL (not imported)
```

Barrel files: `src/components/index.js`, `src/components/canvas/index.js`, `src/hoc/index.js`, `src/assets/index.js`. When you add a component or asset, also export it from its barrel.

## Page composition (`src/App.jsx`)

Order: `Navbar` + `Hero` (inside the `bg-city-pattern` background div), then `About`, `Experience`, `Tech`.
`Works` (projects), `Feedbacks` (testimonials), `OpenGraph`, and the `Contact` + `StarsCanvas` block are commented out. Contact is **temporarily disabled**; App.jsx has a comment listing what to restore.

## Conventions and patterns

- **Content changes go in `src/constants/index.js`**, not in the components. Experience entries are listed oldest first. Each entry has `title`, `company_name`, `icon`, `iconBg`, `date`, `points[]`.
- **Adding an image:** put it in `src/assets/` (or `tech/` or `company/`), import and re-export it in `src/assets/index.js`, then reference it from constants.
- **Sections:** export as `SectionWrapper(Component, "anchorId")`. The id becomes the `#anchor` target, and `navLinks[].id` must match it. Current ids are `about` and `work` (the Experience section). The `contact` nav link is commented out while Contact is disabled. Child elements animate by using `variants={...}` from `utils/motion.js`. The wrapper's `staggerContainer` drives `hidden` → `show` on scroll into view (`once: true`).
- **Headings:** use `styles.sectionSubText` (small uppercase label) followed by `styles.sectionHeadText` (big title, conventionally ending with a period, e.g. "Overview.").
- **Colors:** use the Tailwind theme tokens `primary` `#1D256E`, `secondary` `#aaa6c3`, `tertiary` `#151030`, `black-100`, `black-200`, `white-100`. The accent purple `#915eff` is hard-coded inline. Gradient utility classes (`violet-gradient`, `green-pink-gradient`, `*-text-gradient`, `black-gradient`) are defined in `index.css`.
- Custom breakpoint `xs: 450px`. `ComputersCanvas` separately uses `matchMedia('(max-width: 500px)')` for its mobile scale and position.
- Code style is loose: mixed quotes and semicolons, 2-space indent, and Tailwind class strings often broken across lines. Match the surrounding file rather than reformatting it.

## 3D / canvas notes

- Models are loaded by URL from `public/` with `useGLTF('planet/scene.gltf')`. Keep these paths relative (no leading `/`). The git history shows deploy breakage that was fixed by switching to relative paths.
- **`ComputersCanvas` (Hero) does not render the desktop PC.** It renders `public/planet`, and so does `EarthCanvas` (Contact). The component names are historical. Unused models in `public/` are `desktop_pc` (15 MB), `marcus_aurelius` (14 MB), `st_maria` (28 MB), and `pixel_low_poly_spaceship(.glb)`. These are swapped in and out by editing the `useGLTF` path. Mind bundle and deploy size: an earlier commit had to delete a huge PC file.
- Canvases use `frameloop="demand"` and `gl={{ preserveDrawingBuffer: true }}`, plus `<Suspense fallback={<CanvasLoader />}>` and `<Preload all />`. `Loader.jsx` shows a `useProgress` percentage.
- `BallCanvas` creates **one WebGL context per technology**, about 12 of them. Browsers cap active contexts at around 16, so adding many more tech balls can cause older contexts to be lost. Consider this before growing `technologies`.
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
- CSP allows only `'self'` (no third-party origins at all while Contact is disabled). Adding any third-party script, font, image host, analytics, CDN, or API means adding it to the CSP in both places, or it will silently break in production. Test with `npm run build && npm run preview` and check the browser console for CSP violations.
- **Always call `useGLTF(path, false, false)`** (Draco and meshopt off). By default drei sets up the meshopt decoder, which compiles WebAssembly and is blocked by `script-src 'self'` ("violates ... 'unsafe-eval'" in the console). Draco fetches its decoder from `www.gstatic.com`. No current model is compressed. If you swap in one that is, prefer decompressing it (e.g. `gltf-transform`). Otherwise enable the flag and add `'wasm-unsafe-eval'` to `script-src` (plus the gstatic origin for Draco) in both header configs.
- `style-src` keeps `'unsafe-inline'` as a precaution for runtime-injected styles. It may not be needed: to test, try `style-src 'self'` under `npm run preview` and watch the console.
- Permissions-Policy blocks camera, microphone, geolocation, payment, and usb, but deliberately not gyroscope/accelerometer, because `react-parallax-tilt` uses device orientation on phones.
- When re-enabling `Feedbacks`, its `randomuser.me` images will be blocked by `img-src`. Self-host them or add the origin.
- On Amplify, `customHttp.yml` path patterns use a leading slash (`/assets/*`). `**` matches everything.
- External links opened from JS need `window.open(url, "_blank", "noopener,noreferrer")`, and `<a target="_blank">` needs `rel="noopener noreferrer"`.
- `.env` and `.env.*` are gitignored (except `.env.example`).

## Known issues / leftovers (as of Nov 2026)

Fix these when asked, or flag them when touching nearby code:

- `npm audit` (dev only) still reports esbuild/vite dev-server advisories. They're fixed only in Vite 6+ (a major upgrade) and don't affect the deployed bundle, since production deps audit clean.

- `index.html` OG tags are placeholder/joke content (a news headline and image about a hippo), not real site metadata. The page `<title>` is "IM Website". The favicon `<link>` is commented out. The last several commits were attempts to get the OG preview working. Note that OG tags must be in static `index.html` because crawlers don't run JS, so the `react-helmet` `OpenGraph` component can't fix link previews.
- `Works.jsx`: has the typo `fond-bold` and an undefined class `card-img_hover`. It is wrapped with an empty anchor id `""`. `projects` in constants is tutorial placeholder data (Car Rent / Job IT / Trip Guide).
- `Feedbacks.jsx` is a stub. `testimonials` is tutorial placeholder data.
- `Loader.jsx` uses class `canvas-load`, but the CSS defines `.canvas-loader`, so the spinner never shows (only the % text).
- `Tech.jsx` imports `SectionWrapper` but doesn't use it, so the Tech section has no anchor and no section padding.
- `About.jsx`: `options` is passed to a plain `<div>` (no effect). Tilt is configured on the wrong element.
- `Navbar.jsx`: `scrolled` state and the `logo` import are unused. Typos `object-conatin` and `min-w[140px]`.
- `Contact.jsx`: `flex[0.75]` should be `flex-[0.75]`.
- Several imports in `constants/index.js` are unused (meta, tesla, etc.). `src/assets/tech/` has both `splunk.png` and `splunk.jpg`.
- Lint likely fails on the current tree (unused vars, `react/prop-types` from `plugin:react/recommended`). Run it before relying on it as a gate.
