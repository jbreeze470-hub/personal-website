# Handoff — Nana Appiagyei Poku, personal portfolio site

> Working notes for picking this project back up. Not part of the app.
> Safe to delete or gitignore.

---

## 1. TL;DR

A Next.js 16 portfolio site whose hero is an interactive 3D space scene
(react-three-fiber). A spaceship flies from a home station near Earth to two
project planets and a black hole. Below the hero sits a complete, conventional
2D portfolio, which doubles as the accessibility / low-end-device fallback.

**Current state: feature-complete and green.** Typecheck, lint, and production
build all pass. The last round of visual bugs (bloom haze, planet/text overlap)
is fixed and visually confirmed.

---

## 2. ⚠️ Read this first — the work is uncommitted

```
$ git log --oneline
e8d70f4 Initial commit from Create Next App     <- the ONLY commit

$ git status --short
 M package.json / package-lock.json
 M src/app/globals.css / layout.tsx / page.tsx
?? src/components/          <- ~35 files, entirely untracked
?? src/content/             <- untracked
?? src/lib/                 <- untracked
?? public/media/            <- untracked
?? public/Nana_Appiagyei_Poku_resume.pdf
```

Every piece of real work — the whole 3D scene, all content, all components —
exists only as untracked files on disk. **Commit before doing anything else.**

```bash
cd personal-website
git add -A
git commit -m "Portfolio site: 2D sections + 3D space-scene hero"
```

Also note `public/Nana_Appiagyei_Poku_resume.pdf` is a real résumé containing
personal contact details — decide deliberately whether that belongs in a public
repo.

---

## 3. What the site is

| | |
|---|---|
| **Owner** | Nana Appiagyei Poku — CS student, McMaster University |
| **Goal** | Land a software internship |
| **Target roles** | Full-stack, backend, applied AI/ML |
| **Design** | Dark technical theme, cyan accent |
| **Hero concept** | 3D galaxy; click a planet, ship flies there, overlay opens with the case study |
| **Destinations** | Home Station (start) → Stock Predictor → Blackprint → The Void (black hole = projects without a demo video) |

---

## 4. Stack and pinned versions

```
next 16.2.12 (Turbopack default)   react 19.2.4      typescript 5
tailwindcss 4                      zustand 5.0.14    gsap 3.15.0
three 0.185.1                      @types/three 0.185.0
@react-three/fiber 9.6.1           @react-three/drei 10.7.7
@react-three/postprocessing 3.0.4
```

**Versions are pinned on purpose.** npm's `latest` tags lie in this dependency
tree:

- `@react-three/fiber@latest` resolves to a **canary 10.x** that breaks drei's
  peer dependency.
- `framer-motion@latest` resolves to an **alpha 13**. It was dropped entirely —
  plain CSS transitions handle the overlay panel.

Always check `npm view <pkg> dist-tags` before upgrading anything here.

Tailwind v4 is **CSS-first**: there is no `tailwind.config.js`. Design tokens
live in an `@theme inline` block in `src/app/globals.css`.

`AGENTS.md` / `CLAUDE.md` in the repo require reading the bundled docs at
`node_modules/next/dist/docs/` before writing Next.js code.

---

## 5. File map

### Contracts — change these deliberately, everything depends on them

| File | Role |
|---|---|
| `src/lib/store.ts` | Zustand store. The bridge between 3D scene, flight engine, and DOM overlay. |
| `src/lib/destinations.ts` | **Single source of truth** for every world's position, radius, `visualRadius`, `cameraOffset`, colour. |
| `src/lib/types.ts` | `DestinationId`, `Quality`, `ViewMode`, `Project`, `Experience`. |
| `src/lib/nav.ts` | Section registry — nav links, scroll spy, and page composition all read from it. |

### 3D scene (`src/components/scene/`)

| File | Role |
|---|---|
| `SceneCanvas.tsx` | The R3F `<Canvas>`. Transparent, `dpr={[1, 1.5]}`. |
| `SpaceScene.tsx` | Assembles the scene graph. |
| `HeroExperience.tsx` | Mode switch, reveal gating, HUD, destination nav, `← Station` button, overlay mount. |
| `useFlyTo.ts` | Flight engine. GSAP-driven, writes a shared mutable `flightState`. |
| `CameraRig.tsx` | Owns the camera; damps toward flight anchors, shifts framing when the overlay opens. |
| `Earth.tsx` / `EarthShaders.ts` | Earth + atmosphere. |
| `Planet.tsx` | **Both** project planets — `GAS_FRAGMENT` (Stock Predictor, banded + rings), `TERRA_FRAGMENT` (Blackprint, ocean world), `ATMO_FRAGMENT`, `RING_FRAGMENT`. |
| `BlackHole.tsx` / `BlackHoleShaders.ts` | Camera-facing billboard: disk, lensing arcs, photon ring, Doppler beaming. |
| `Ship.tsx` / `ShipDetail.ts` | Spaceship, panel lines via `onBeforeCompile`, instanced greebles. |
| `Station.tsx` | Orbital station. |
| `SceneLighting.tsx` | Key light. |
| `PostFX.tsx` | Bloom. **Only mounts at `quality === "high"`.** |
| `SceneReadyProbe.tsx` | `gl.compileAsync()` → sets `shadersCompiled`. |
| `SceneLoader.tsx` | Shimmer skeletons shown until shaders compile. |
| `shaders/lib.ts` | Shared GLSL: `vnoise`, `fbm`, `ridged`, `warpedFbm`, `fresnel`, `worley`, `craters`, `perturbNormal`. |

### Fallback / adaptive (`src/components/fallback/`)

| File | Role |
|---|---|
| `CapabilityGate.tsx` | Decides **both** mode and quality *before first frame*. |
| `capability.ts` (in `lib/`) | Static hardware hints → `recommendedQuality`. |
| `FpsSampler.tsx` | Narrow safety net only. Never changes quality; only escapes to classic 2D if FPS < 14. |
| `ViewModeToggle.tsx` | User-facing "Exit 3D view" toggle. Locks the mode. |

### 2D site

`src/components/sections/` (About, Experience, Skills, Contact),
`src/components/projects/`, `src/components/layout/`, `src/components/ui/`,
`src/components/overlay/DestinationOverlay.tsx`.

Content is data-driven from `src/content/`: `profile.ts`, `experience.ts`,
`projects.ts`, `skills.ts`.

---

## 6. The store contract

```ts
destination: DestinationId   // where the ship is / is heading
isFlying: boolean
overlayOpen: boolean
mode: "immersive" | "classic"
quality: "high" | "low"
modeLocked: boolean          // user chose explicitly — never auto-override
shadersCompiled: boolean     // gates the hero reveal AND the FPS sampler

flyTo(id) · arrive() · closeOverlay() · returnToStation()
setMode(mode, {lock}) · setQuality(q) · setShadersCompiled(b)
```

Flow: click a planet → `flyTo(id)` sets `isFlying` → `useFlyTo` animates via
GSAP → on completion calls `arrive()` → `arrive()` opens the overlay (unless
the destination is the station).

`mode` defaults to `"classic"` so SSR output is the accessible 2D site;
`CapabilityGate` upgrades to `"immersive"` on the client. This is deliberate —
it also avoids a hydration mismatch.

---

## 7. Design decisions worth preserving

**One starfield for the whole page.** The stars are a fixed CSS layer on
`body::before` (nebula on `body::after`). The 3D canvas is transparent and has
**no starfield of its own** — the 3D `Starfield.tsx` was deleted. Two fields
inevitably drift apart and produce a visible seam at the hero boundary; one
field cannot.
→ Consequence: `layout.tsx` body must **not** have `bg-void`, or it paints over
the stars.

**Quality is decided once, before the first frame.** Any runtime quality change
is visible and reads as the page breaking. `CapabilityGate` picks the tier from
static hints (`cores <= 6 || memory <= 4 || (smallViewport && coarsePointer)` →
low). `FpsSampler` no longer downgrades — it only bails to clean 2D when 3D is
hopeless.
→ This fixed the "bright detailed image, then quality dips" flash the user
reported. Root cause: the sampler was measuring **during shader compilation**
and misreading capable hardware as slow.

**The hero stays hidden until every shader is linked.** Otherwise objects pop in
one at a time as their materials finish. `SceneReadyProbe` calls
`gl.compileAsync()`, waits 2 settle frames, then flips `shadersCompiled`.

**The black hole is a camera-facing billboard,** not a 3D disk. A real disk
rotated 90° sits edge-on and collapses into a vertical streak.

**Blackprint has no craters.** It is an ocean world with an atmosphere, so
craters are physically wrong — and removing them also cut 3 Worley evaluations
and a 27-cell loop per pixel.

**`projectScene.ts` deliberately uses plain math,** not `three`, so the loading
skeletons don't pull the 3D bundle into the main chunk.

**The header hides while the overlay is open.** The overlay is a focus-trapped
modal, so the nav is unreachable anyway; this resolved a z-index fight
(header `z-50` vs overlay `z-40`) that had the nav covering the panel text.

---

## 8. Landmines — these cost real time

- **`modelMatrix`, `viewMatrix`, `cameraPosition`, `normal`, `position` are
  vertex-stage only.** A fragment shader referencing them typechecks fine and
  fails at runtime with "undeclared identifier". Pass them through as a
  `varying`.
- **A backtick inside a GLSL comment terminates the TypeScript template
  literal.** This broke the build once.
- **`fresnel()` in `shaders/lib.ts` clamps to `[0,1]`.** On a `BackSide` shell
  `dot(V,N)` is negative across the visible ring, so the clamp saturates flat
  and produces a hard blue band. Earth's atmosphere must use `abs(dot(V,N))`.
- **React Compiler lint rules** reject: mutating a `useMemo` result, lazily
  initialising refs during render, and `Math.random()` during render. Working
  pattern: build uniforms in `useMemo`, hand to the material, then mutate via
  `matRef.current.uniforms.X.value` inside `useFrame`.
- **Three light directions must be kept in sync by hand** or terminators
  disagree across bodies: `SceneLighting.tsx` `[7,8,16]`, `Planet.tsx`
  `LIGHT_DIR`, `EarthShaders.ts` `SUN_DIRECTION`.
- **R3F v9 already defaults to `ACESFilmicToneMapping`** (only `flat` disables
  it) — no Canvas change needed.
- **drei `<Html occlude>` raycasts every frame.** Removed for performance.
- **Bloom's `mipmapBlur` defaults to `levels={8}`,** which smears a halo across
  most of the viewport — this was the "smoke" the user reported. Now
  `levels={4} radius={0.55}`.
- **Headless Chromium uses SwiftShader** (software, no GPU). Its FPS numbers are
  meaningless for real hardware. Now that quality comes from static hints
  (12 cores → high), captures do exercise the high-quality/bloom path.
- **Artifacts often only reproduce at the user's aspect ratio (1990×975).**
  Captures at 1440×900 missed both the nebula and vignette bugs.

---

## 9. Verification

All green as of this handoff:

```bash
cd personal-website
npx tsc --noEmit     # clean
npm run lint         # clean
npm run build        # clean — 4 static pages
npm run dev          # http://localhost:3000
```

### End-to-end suite

Playwright scripts live outside the repo, in the session workspace:

```
C:\Users\t-nanapoku\.copilot\session-state\d0276b00-cae5-4ebf-937a-e0e60b6bab68\files\e2e\
  test.mjs      19 checks — nav, overlay, focus trap, a11y, headings, 4 destination buttons
  loading.mjs   11 checks — reveal gating + station button
  shimmer.mjs    4 checks — loading skeletons (this one caught the duplicate-skeleton bug)
  shots.mjs      screenshot capture
  smoke.mjs      bloom-haze check
```

Run with the dev server up: `node test.mjs`. Screenshots land in `files/shots/`.

⚠️ **`smoke.mjs`'s pixel sampling is broken** — it `drawImage`s the WebGL canvas
into a 2D canvas, which returns all zeros because the drawing buffer is cleared
after compositing (`preserveDrawingBuffer` is false). **Trust the Playwright
screenshots, not that measurement.**

⚠️ `test.mjs` was updated to expect 4 destination buttons but has not been
re-run since the last few edits. Re-run it.

---

## 10. Answer to the open question: does anything reload on scroll?

**Nothing reloads. State is fully preserved — but the scene never stops
rendering, and that is a real cost.**

Verified:

- No component unmounts on scroll. `HeroExperience` stays mounted, Zustand
  state persists, and compiled shaders stay compiled. Scrolling back to the
  hero shows exactly the state you left. Nothing re-initialises.
- The only scroll listener on the page is in `SiteHeader.tsx` — it toggles one
  class at `window.scrollY > 80`. Cheap and passive.
- **However:** no `frameloop` prop is set anywhere, so R3F uses its default
  `"always"` (`events-*.js`: `frameloop: 'always'`). The scene keeps rendering
  at full rate *even when the hero is scrolled completely off-screen* — every
  planet shader, the black hole, and the bloom pass all keep running while the
  user reads the 2D content below. Pure waste, and a likely contributor to the
  "site feels slow" report.

### Ready-to-apply fix (verified safe, not yet implemented)

Pause the render loop when the hero leaves the viewport.

Both preconditions were checked:

1. **R3F applies `frameloop` reactively.** In the render path:
   `if (state.frameloop !== frameloop) state.setFrameloop(frameloop)` — so the
   prop can be flipped at runtime.
2. **Flights are driven by GSAP's own ticker**, not `useFrame`
   (`useFlyTo.ts` → `gsap.to(progress, …)`). Pausing renders therefore cannot
   corrupt flight state. And because `CameraRig` *damps* toward the anchors
   rather than copying them, resuming produces a smooth catch-up, not a snap.

In `SceneCanvas.tsx`:

```tsx
const [active, setActive] = useState(true);
const hostRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const host = hostRef.current;
  if (!host) return;
  const io = new IntersectionObserver(
    ([entry]) => setActive(entry.isIntersecting),
    { rootMargin: "100px" },   // resume just before it scrolls back in
  );
  io.observe(host);
  return () => io.disconnect();
}, []);

// <div ref={hostRef} className="absolute inset-0">
//   <Canvas frameloop={active ? "always" : "never"} …>
```

Tab-switching is already handled — R3F's loop is `requestAnimationFrame`-based,
which browsers throttle on hidden tabs.

One edge case to accept: if the user clicks a destination and scrolls away
within the ~2s flight, `arrive()` still fires on GSAP's ticker and opens the
overlay off-screen. That is existing behaviour, unchanged by this fix.

---

## 11. Open items

### Just fixed and confirmed
- ✅ Bloom "smoke" halo removed (`levels={4}`, `radius={0.55}`) — verified in
  `files/shots/smoke-check.png`.
- ✅ Stock Predictor moved to `[-16, -3, -12]` so it sits below the hero copy.
- ✅ Work experience organization corrected to **"McMaster Software Labs"**
  (was "McMaster Software Labs — ECE Department"). If the department was wanted,
  revert in `src/content/experience.ts`.

### Known cosmetic issue
- Stock Predictor's **ring system is cropped by the left viewport edge** at
  1990×975 (visible in `smoke-check.png`). Nudge `position[0]` in
  `destinations.ts` right, or reduce the ring extent in `Planet.tsx`.

### Recommended next
1. **Commit the work** (§2).
2. Apply the `frameloop` optimisation (§10).
3. Re-run `test.mjs`, `loading.mjs`, `shimmer.mjs` against a production build.

### Waiting on the site owner
- Real **GitHub URL** and **Blackprint live URL** — currently placeholders in
  `src/content/profile.ts`.
- **Demo videos** → drop in `public/media/`, then set `media.video` in
  `src/content/projects.ts`. Poster SVGs already exist as stand-ins.
- **Deployment (Vercel)** — explicitly deferred: *"we are not deploying right
  now."*

---

## 12. Environment notes

- Windows, PowerShell. Node v24.15.0. **No Python on this machine** — the résumé
  was parsed with a Node + `pdfjs-dist` script.
- Project root: `C:\Users\t-nanapoku\personal-website`
- Session artifacts (e2e scripts, screenshots):
  `C:\Users\t-nanapoku\.copilot\session-state\d0276b00-cae5-4ebf-937a-e0e60b6bab68\files\`
