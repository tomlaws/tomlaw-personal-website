# Tom Law — Hong Kong developer portfolio

A personal site for Tom Law, a full-stack developer based in Hong Kong. The Hong Kong miniature forms the page background, with lighting and page colours following actual Hong Kong daylight. Public GitHub repositories provide the work content.

## Run

```sh
npm install
npm run dev -- --port 5181
npm test
npm run build
```

The page has an unframed, non-interactive background scene. There are no camera, lighting, pause or fullscreen controls. Scrolling and pointer events belong to the website. The former Nocturne project is excluded from the site and production assets.

The page observes the introduction's visibility and sends pause/resume commands to the background renderer, including after renderer fallback. A stalled render worker falls back after 45 seconds; scene decoding and fallback downloads have 20-second deadlines. If the city still has not presented a frame after 90 seconds of visible-tab time, the page removes its iframe and offers **Retry city**. Retrying recreates only the city, preserving repository searches and the rest of the page. Switching tabs pauses the page and render-worker deadlines. Mobile body text is 14–15px, secondary labels are at least 12px, search uses 16px text, and links/buttons have at least 44px-high targets. `scripts/verify-harbour-lifecycle.mjs` tests visibility commands, retry isolation, deadlines, worker fallback and cleanup in Node without opening a browser.

## Lighting and background

`src/hong-kong-time.mjs` uses SunCalc at 22.2845 N, 114.1589 E and always formats the clock in `Asia/Hong_Kong`. The existing map lighting follows seasonal solar elevation, updating every 30 seconds and when returning to the tab. `src/harbour-theme.mjs` derives the page background, foreground, rules and accent from the same daylight amount.

The full-viewport scene is the visual background itself, with no surrounding frame. The solid sea and land cutaway edges are retained, against a cloud-free backdrop matching the page colour. The larger opening view gently orbits and moves closer as the visitor scrolls, then fades away as the introduction leaves the viewport. Its renderer stops when the introduction is offscreen or the tab is hidden. Reduced-motion users see a still miniature with live lighting.

Both renderers share `harbourRenderProfile` and `createAdaptiveRenderQuality`. At widths up to 650px they retain a fixed pixel ratio of up to 2, use 512px water reflections, 1024px sun shadows and a bloom chain at half its desktop resolution. Sustained overload reduces auxiliary reflection/glow refresh rates instead of reducing scene resolution. The city never drops below its initial pixel ratio under load. Resizing is coalesced with the next draw. Desktop resolution retains its existing DPR and pixel limits. Geometry, live day/night lighting and city animation are retained, including during touch scrolling and momentum. No touch/scroll suspension helper is connected. A 30 FPS target and one GPU frame in flight preserve headroom. WebGL remains the default; WebGPU remains selectable with `?renderer=webgpu` and retains automatic fallback.

The WebGL output uses a single multisampled scene target. Glow stays in its own small targets and is sampled by the same final pass that composites silhouette coverage, page background, tone mapping and sRGB output. There is no full-size coverage copy, additive writeback into MSAA, unused depth texture or second multisampled scene buffer. On phones, glow refreshes independently at 8–15 Hz; the sharp scene and vehicle/tram/wheel animation still draw on each presented frame. Glass remains transmissive, with a smaller refraction capture on mobile. Local point lights retain their original attenuation and PBR equations but share a uniform-bound loop, skipping the BRDF for zero-contribution lights; point-shadow scenes retain the upstream unrolled path. Main/reflection views share one clipping-plane slot to reuse shader variants at startup. The fixed background has layout/paint containment to isolate its updates from the scrolling page. `scripts/verify-webgl-post.mjs` checks the actual pass sequence, renderer-state restoration, coverage/glow composition, original blur kernels, shader hooks and prepared sky data without opening a browser.

`npm run build` exports the complete assembled scene to `public/world/` (about 4.1 MB gzip). The binary format retains the original Float32 attributes, indices, transforms and full-precision linear material colours, using reversible byte shuffling/XOR plus gzip for transport. Only hidden ferry construction helpers are omitted. Exact binary vertex deduplication reduces repeated data without reducing geometry detail. Runtime restores the scene and reconnects the original continuous tram, wheel, traffic, boat, ripple and tree animation equations. It does not play an image or sampled animation.

The prepared scene is fingerprinted against the current source and GLB assets through a Vite virtual module. A stale, unavailable or invalid scene falls back to the original construction path; `?qaWorld=procedural` forces that path in development. `node scripts/prepare-world.mjs` refreshes the scene. Tests compare all 348 mesh attribute streams, five animation phases, day/dusk/night material values and the original WebGL window/vehicle/ferry shader hooks.

The original runtime path also retains the small lossless welding maps in `public/geometry/`. They avoid rebuilding vertex dictionaries when procedural fallback is needed. Tests compare all 35 static batches against the original indexer.

WebGPU uses a module worker with OffscreenCanvas where supported, with a main-thread native fallback. It prepares the world alongside adapter initialization, warms HDR scene/effect pipelines with at most two driver compilations in progress, and shares the clipping layout of the main and reflection views. Its contact-shadow/denoise chain refreshes at 10 Hz and bloom at 15 Hz, invalidating immediately on camera, viewport or lighting changes. Mobile AO uses eight samples at half resolution and a smaller denoising radius; desktop settings are retained. Both backends refresh live water reflections at up to 8 Hz on phones and 12 Hz on desktop, with immediate refresh for camera, viewport and lighting changes. Desktop retains 2048px sun shadows and 1024px reflections. WebGL uses GPU fences for the same bounded submission/headroom policy. `scripts/verify-mobile-rendering.mjs` exercises real reflection and bloom targets, bounded adaptation, profile changes and continuous animation in Node; it does not benchmark a physical iPhone.

Lighting remains live. Static lightmaps were not adopted because approximating the changing spill, glass highlights and moving objects would weaken the quality requirement. A development-only `?qaLighting=compact` compares a shared point-light loop with the original PBR lights; its cold-start driver cost was higher on the tested system, so it is not the production default.

The main camera and water reflection keep the same one-plane clipping layout, sharing their PBR pipeline variants. For the main view the plane sits far below the map; for the mirror it moves to the waterline. This retains the original visible clipping while avoiding a second full set of expensive scene shaders. The live renderer remains the only map presentation, with no poster substitute. Cold-start latency still depends on GPU adapter/driver initialization; three-second live readiness is not guaranteed.

The day/night reflection environments are prepared once from the original procedural sky. `public/lighting/` stores the full 768×1024 half-float textures, losslessly gzip-compressed; there is no resampling, quantisation, or resolution reduction. Their fingerprint and format are checked by the tests. Both backends load the prepared asset in parallel with scene loading. WebGL reorients the packed cube faces for its sampling convention using an exact reversible texel permutation. This avoids generating both sky PMREMs on a cold phone visit; no texels are resampled or quantised. The prepared lighting has immutable production caching. If the asset cannot load, runtime generation remains available. To regenerate after changing the reflection sky, open `/tools/bake-environment.html` on the local dev server, download its lighting asset, then run `node tools/register-environment.mjs <downloaded-file-path>`. The preparation page is excluded from production entry points.

Custom window diffusion, vehicle and ferry glazing, procedural reflection sky, planar harbour mirror, contact shadows, denoising, bloom and tone mapping use Three.js node materials/TSL. Landmark geometry and animations are shared with the existing map. A sampleable depth attachment and light final FXAA preserve depth-based effects without an additional geometry pass. Native rendering targets up to 30 FPS and leaves additional GPU headroom when frames are expensive. Only one GPU frame can be in flight, preventing a growing submission queue. Both backends pause when hidden or offscreen.

The original WebGL renderer is the fast default and also remains the fallback when an explicitly selected WebGPU renderer is unavailable, initialization/validation fails, or the GPU device is lost. A fresh canvas is created before changing context types. Force either renderer with `?renderer=webgpu` or `?renderer=webgl`; inspect `data-renderer` on the internal frame's `<html>` or its `[harbour-renderer]` console message to confirm the actual backend. A WebGPU request still falls back safely when native support is unavailable. This follows the [official Three.js migration guidance](https://threejs.org/manual/pages/webgpurenderer).

`webgpu-compat.mjs` backports the [upstream framebuffer-source isolation fix](https://github.com/mrdoob/three.js/pull/34636) to the installed Three.js r180. The main camera and differently sized harbour reflection keep independent refraction snapshots. This prevents periodic lit-glass/bloom flicker and unnecessary texture reallocations, while retaining transmission in both views. The fix detects already corrected Three.js versions and becomes a no-op.

Development diagnostics include `?profile=idle` for draw calls, triangles, CPU submission and CPU-plus-GPU completion latency, and `?qaNight=0` / `?qaNight=1` for daylight/night visual checks. `?qaThread=main` exercises native rendering without a worker. These QA overrides are stripped from production; live Hong Kong time remains the only production lighting source. `?capture` freezes movement for comparison screenshots. `[startup-webgl]` records the completed first GPU frame; `[page-map-ready]` and the page’s `data-map-ready-ms` include the surrounding page startup. These are local diagnostics, not telemetry. There is no telemetry. Browser occlusion can throttle profiling samples, so they are not a cross-device FPS benchmark, and WebGPU is not guaranteed to be faster on every device.

`?qaTemporal` runs 16 stationary WebGPU frames with all lighting/glass effects enabled, alternating reflection updates and sampling scene/bloom/final colour buffers. It logs `[temporal-qa]` deltas; the stable scene should have zero deltas after warmup. This GPU readback diagnostic is removed from production. Automated checks also alternate differently sized transmission captures and resize both buffers to guard against the source-sharing regression.

The source map is copied from `C:/Users/Tom/Documents/exp` into `src/harbour/`; original landmark geometry and model files are retained without changes. `/harbour/` is the internal background renderer route.

## Public repositories

`src/data/github-repositories.json` is a public GitHub snapshot from `tomlaws`. The page lists public repositories selected for the profile and labels forks. Featured projects are selected from the original repositories, not the forks. Search and All / Originals / Forks filters are browser-local.

Refresh the snapshot with:

```sh
npm run sync:github
```

The sync script handles GitHub pagination and applies the profile exclusion list before saving metadata. No token or private repository access is used, and the site does not rely on a runtime GitHub API request.

Contact: `contact@tomlaw.dev`. The developer identity and technology background are consistent with the existing public `tomlaw.dev` site. No freelance sales or hiring call to action is included.

## Main files

- `src/Portfolio.jsx`: identity, selected work and repository list.
- `src/portfolio.css`: layout and background integration.
- `src/hong-kong-time.mjs`: seasonal daylight and Hong Kong clock.
- `src/harbour-theme.mjs`: page colour palette.
- `src/harbour/entry.js`: native WebGPU selection and automatic WebGL fallback.
- `src/harbour/runtime-webgpu.js`: native renderer, lifecycle and bounded GPU submissions.
- `src/harbour/worker-controller.mjs`, `webgpu-worker.js`, `render-host.mjs`: worker rendering and browser lifecycle bridge.
- `src/harbour/frame-pacing.mjs`, `cached-view-pass.mjs`: GPU headroom and effect refresh budgets.
- `src/harbour/webgpu-*.mjs`: TSL materials, sky environment, planar reflection and effects.
- `src/harbour/runtime.js`: full-resolution default WebGL background renderer.
- `src/harbour/prepared-world.mjs`, `scene-codec.mjs`: lossless prepared scene and live animation restoration.
- `scripts/prepare-world.mjs`, `verify-prepared-world.mjs`: build-time export and full-scene fidelity checks.
- `src/harbour/portfolio-atmosphere.mjs`: solid map silhouette and shared backdrop colour.
- `src/harbour/portfolio-camera.mjs`: restrained scroll-driven orbit and zoom.
- `src/harbour/render-budget.mjs`: adaptive background pixel budget.
- `src/harbour/render-quality.mjs`: fixed sharp scene resolution and adaptive auxiliary effect cadence for both backends.
- `scripts/verify-portfolio.mjs`: daylight, timezone, background theme, public metadata and control-free renderer checks.
- `scripts/verify-webgpu.mjs`: portable material/effect graph and unchanged-geometry checks.

The previous page iteration is backed up in `assets/legacy/pre-background-correction/`. Earlier original source and modelling assets remain in `assets/legacy/` and `assets/blender/`; none are loaded by the portfolio.
