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

The page observes the introduction's visibility and sends pause/resume commands to the background renderer, including after renderer fallback. A stalled render worker falls back after 45 seconds; scene decoding and fallback downloads have 20-second deadlines. If the city still has not presented a frame after 90 seconds of visible-tab time, the page removes its city surface and offers **Retry city**. Retrying recreates only the city, preserving repository searches and the rest of the page. Switching tabs pauses the page and render-worker deadlines. Mobile body text is 14–15px, secondary labels are at least 12px, search uses 16px text, and links/buttons have at least 44px-high targets. `scripts/verify-harbour-lifecycle.mjs` tests visibility commands, retry isolation, deadlines, worker fallback, direct-canvas startup/abort, React StrictMode cancellation and cleanup in Node without opening a browser.

`?diagnostics=scroll` loads an optional, client-only phone capture panel. It records 10 seconds of actual renderer/backend identity, renderer telemetry, page RAF callback intervals, scroll-event dispatch delay and viewport/visibility changes, separating map-active and map-inactive scrolling. Reports stay in memory and are copied only at the user's request; there is no upload endpoint or telemetry service. Callback timings are not native display/compositor FPS. The panel links to controlled worker/main-thread WebGL and WebGPU modes; `thread=main` is honored only with this diagnostic flag. The normal page does not load the capture module or enable profiling.

WebGL keeps multisampled scene coverage in alpha while bloom adds only RGB. The page background is composed inside Three's final output pass before its original tone mapping and sRGB conversion. The chain retains a fixed 2× mobile drawing buffer, two-sample scene antialiasing, all bloom levels and live ferry reflections, while avoiding a full-resolution silhouette copy, an intermediate atmosphere pass, an unused depth resolve and the intermediate MSAA/depth target. Day/night headless Safari comparisons against the previous pipeline differ by at most one 8-bit colour level per channel; physical-device scrolling and system animation must still be checked on the phone.

Mobile WebGL caches the original PBR shading of immutable, visible opaque meshes and draws their combined **real geometry** with that shading between captures. Native depth tests and two-sample silhouette coverage stay active, so vehicles, the ferry, foliage, wheel, tram, glazing and water retain correct live occlusion. The original full-resolution shading refreshes around 10 Hz (a deferred capture is forced on the first frame at 200 ms), immediately on camera/lighting changes; this only bounds how quickly moving headlights update the static surroundings. The mirrored camera has its own 512 px cache with a 250 ms refresh interval, while the ferry reflection itself keeps the existing live capture schedule. Desktop WebGL retains the ordinary full-scene path.

Zero-output night lights are removed from daylight shader variants; moving traffic does not change light counts. Point/spot lights with exactly zero contribution skip their BRDF work while retaining Three's original light, shadow and PBR equations and existing material hooks. These changes preserve the 2× mobile drawing buffer, bloom, continuous animation and live reflections. The caches add bounded offscreen image storage to reduce repeated fragment shading and draw submissions. Tests cover animated/transparent/hidden-helper exclusions, original geometry, clipping, cache invalidation, maximum lighting age, day/night light output and failure cleanup. Headless Safari evidence is recorded locally; it does not establish physical-phone scroll or iOS presentation FPS.

## Lighting and background

`src/hong-kong-time.mjs` uses SunCalc at 22.2845 N, 114.1589 E and always formats the clock in `Asia/Hong_Kong`. The existing map lighting follows seasonal solar elevation, updating every 30 seconds and when returning to the tab. `src/harbour-theme.mjs` derives the page background, foreground, rules and accent from the same daylight amount.

The city renders into one canvas in the portfolio document. Worker startup or runtime failure replaces that canvas with a fresh canvas in the same container and loads the main-thread renderer only when required. Explicit WebGPU requests use the same integration, with WebGL recovery if native WebGPU is unavailable. No renderer path embeds another page or uses window-to-window control messages. The standalone `/harbour/` route remains a diagnostic page and is never embedded. Canvas dimensions follow the CSS stage rather than Safari browser-chrome height changes. The default worker keeps parsing, shader setup and animation off the page thread. The scene has no surrounding frame; its solid sea/land cutaway edges and cloud-free backdrop are retained. The canvas stays fixed in the viewport while the document scrolls over it; scrolling does not translate the live GPU surface. Rendering stops only when the introduction is offscreen or the tab is hidden. Reduced-motion users see a still miniature with live lighting.

`AGENTS.md` records this architecture as a project requirement. `scripts/verify-page-integration.mjs` rejects embedded-document elements and the former cross-window city protocol anywhere in application source or HTML. The guard runs in both `npm test` and the deployment build. Lifecycle tests exercise startup cancellation, fresh-canvas recovery, stale callbacks, unavailable workers, backend recovery and listener/timer cleanup.

Both renderers share `harbourRenderProfile` and `createAdaptiveRenderQuality`. At widths up to 650px they retain a fixed sharp pixel ratio of up to 2, use 512px water reflections, 1024px sun shadows and a bloom chain at half its desktop resolution. GPU load never reduces the scene pixel ratio or requests a drawing-buffer resize. Resizing is coalesced with the next draw. Desktop resolution retains its existing DPR and pixel limits. Geometry, live day/night lighting and city animation are retained, including during touch scrolling and momentum. No touch/scroll suspension helper is connected. Both renderers retain the same 30 FPS target during mobile touch/momentum scrolling. Mobile scheduling uses an 85% work duty ceiling; it no longer deliberately lowers the gesture cadence. Deadline checks tolerate Safari’s rounded timestamps to avoid losing a refresh to a fractional millisecond. This changes scheduling only; animation uses elapsed time and never suspends for a gesture. WebGL remains the default; WebGPU remains selectable with `?renderer=webgpu` and retains automatic fallback.

`npm run build` exports the complete assembled scene to `public/world/` (about 1.1 MB gzip, or 0.77 MB with Brotli). The binary format retains the original Float32 attributes, indices, transforms and full-precision linear material colours, using reversible byte shuffling/XOR plus gzip for transport. Only hidden ferry construction helpers are omitted. Exact binary vertex deduplication reduces repeated data without reducing geometry detail. Runtime restores the scene and reconnects the original continuous tram, wheel, traffic, boat, ripple and tree animation equations. It does not play an image or sampled animation.

The prepared scene is fingerprinted against the current source and GLB assets through a Vite virtual module. A stale, unavailable or invalid scene falls back to the original construction path; `?qaWorld=procedural` forces that path in development. `node scripts/prepare-world.mjs` refreshes the scene. Tests compare all 357 mesh attribute streams, five animation phases, day/dusk/night material values and the original WebGL window/vehicle/ferry shader hooks.

The original runtime path also retains the small lossless welding maps in `public/geometry/`. They avoid rebuilding vertex dictionaries when procedural fallback is needed. Tests compare all 35 static batches against the original indexer.

WebGPU uses a module worker with OffscreenCanvas where supported, with a main-thread native fallback. It prepares the world alongside adapter initialization, warms HDR scene/effect pipelines with at most two driver compilations in progress, and shares the clipping layout of the main and reflection views. Its contact-shadow/denoise chain refreshes at 10 Hz and bloom at 15 Hz, invalidating immediately on camera, viewport or lighting changes. Mobile AO uses eight samples at half resolution and a smaller denoising radius; desktop settings are retained. Both backends refresh live water reflections at up to 8 Hz on phones and 12 Hz on desktop, with immediate refresh for camera, viewport and lighting changes. Desktop retains 2048px sun shadows and 1024px reflections. WebGL uses GPU fences for the same bounded submission/headroom policy. `scripts/verify-mobile-rendering.mjs` exercises real reflection and bloom targets, fixed sharp resolution, profile changes and continuous animation in Node; it does not benchmark a physical iPhone.

The clock updates its own React subtree once per second; page theme updates follow the city's 30-second daylight cadence, and the repository snapshot is sorted once. The background has layout/paint containment. The canvas remains fixed in the viewport on phones and desktop; page scrolling does not reposition the canvas or move the 3D camera. Both worker and main-thread hosts ignore unchanged viewport notifications, preventing unnecessary canvas/compositor resets. Mobile WebGL workers allow at most two GPU frames in flight, overlapping WebKit’s worker/GPU-process completion round trip. Each slot owns its fence and optional GPU timer; a full queue applies backpressure, and the 30 FPS submission cap prevents runaway rendering. Pacing uses measured GPU execution time when available, otherwise CPU submission time; delayed fence replies do not add another cooldown. Desktop and main-thread fallback retain one frame in flight and their existing completion-based pacing. The fixed scene resolution, MSAA and reflection resolution are unchanged. `scripts/verify-gpu-frame-queue.mjs` checks bounded overlap, completed-frame throughput, ordering and fence cleanup. On phones the original UnrealBloomPass refreshes its complete glow at up to 15 Hz (10 Hz during scrolling) and blends it onto every live sharp scene frame; camera, projection, lighting and size changes invalidate immediately. Routine blur refreshes defer off reflection-capture frames, with a maximum glow age of two refresh intervals. Water reflections retain the 8 Hz phone target during scrolling. A frame-aware scheduler leaves at least one ordinary scene frame between routine captures, preventing slow frames from triggering a second full city render on every frame. Camera and lighting changes still refresh immediately; the ferry and boats remain in every live mirror capture. Desktop bloom keeps its original update rate. `scripts/verify-scroll-rendering.mjs` records the real bloom pass draws, exercises invalidation and resize cleanup, and checks delayed-callback scheduling without opening a browser. These checks do not measure physical iPhone scrolling.

On phones, architectural glass retains its tint, roughness, clearcoat, sky reflections and existing interior/window shader hooks, with transmission disabled to avoid the extra opaque-scene refraction capture. Desktop restores the original transmission values when crossing the responsive breakpoint. Geometry, normal-map detail, sharp DPR, MSAA, lights and ferry glazing are retained. `scripts/verify-live-reflections.mjs` checks exact finish/hook preservation, responsive restoration, slow-frame capture limits and the actual moving ferry through both mirrored cameras.

Lighting remains live. Static lightmaps were not adopted because approximating the changing spill, glass highlights and moving objects would weaken the quality requirement. A development-only `?qaLighting=compact` compares a shared point-light loop with the original PBR lights; its cold-start driver cost was higher on the tested system, so it is not the production default.

In WebGPU, the main camera and water reflection keep the same one-plane clipping layout, sharing their PBR pipeline variants. For the main view the plane sits far below the map; for the mirror it moves to the waterline. This retains the original visible clipping while avoiding a second full set of expensive scene shaders. The live renderer remains the only map presentation, with no poster substitute. Cold-start latency still depends on GPU adapter/driver initialization; three-second live readiness is not guaranteed.

The root HTML preloads the prepared world, WebGL lighting and harbour entry modules before the background frame starts. Rendering workers decode the world directly, avoiding a nested decoding worker; main-thread fallback still offloads decoding when workers are available. Content-addressed JavaScript, geometry, lighting and world assets have a one-year immutable cache policy; HTML remains revalidatable.

WebGL warms its materials against the actual linear HDR compositor target, then prepares the clipped water-reflection variant. It retains the original shader hooks and EffectComposer passes. The tiny empty render used to initialise clipping state does not clear targets or draw geometry. `scripts/verify-startup.mjs` checks target and clipping state restoration, lighting fidelity, worker/fallback loading and cache policy without opening a browser.

The day/night reflection environments are prepared once from the original procedural sky. `public/lighting/` stores the full 768×1024 half-float textures, losslessly gzip-compressed; there is no resampling, quantisation, or resolution reduction. The build also derives a WebGL-oriented version through exact cube-face/row permutations and reversible integer delta compression (about 840 KB gzip). This replaces on-device day/night PMREM preparation on the normal WebGL path. Their fingerprints, orientation and exact half-float values are checked by the tests. If the prepared asset cannot load, runtime generation remains available. To regenerate after changing the reflection sky, open `/tools/bake-environment.html` on the local dev server, download its lighting asset, then run `node tools/register-environment.mjs <downloaded-file-path>`. The preparation page is excluded from production entry points.

Custom window diffusion, vehicle and ferry glazing, procedural reflection sky, planar harbour mirror, contact shadows, denoising, bloom and tone mapping use Three.js node materials/TSL. Landmark geometry and animations are shared with the existing map. A sampleable depth attachment and light final FXAA preserve depth-based effects without an additional geometry pass. Native rendering targets up to 30 FPS and leaves additional GPU headroom when frames are expensive. WebGPU allows one GPU frame in flight; mobile WebGL workers allow at most two to overlap cross-process completion latency. Both queues remain bounded. Both backends pause when hidden or offscreen.

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
- `src/harbour/render-quality.mjs`: shared mobile effects and fixed sharp resolution for both backends.
- `scripts/verify-portfolio.mjs`: daylight, timezone, background theme, public metadata and control-free renderer checks.
- `scripts/verify-webgpu.mjs`: portable material/effect graph and unchanged-geometry checks.

The previous page iteration is backed up in `assets/legacy/pre-background-correction/`. Earlier original source and modelling assets remain in `assets/legacy/` and `assets/blender/`; none are loaded by the portfolio.

The WebGL renderer uses the established Three.js EffectComposer/UnrealBloomPass pipeline and original material lighting hooks. Shader compile/link failures are captured and routed through the existing renderer fallback; a failed shader cannot mark an empty first frame as ready. `scripts/verify-shader-errors.mjs` checks this failure handling without opening a browser.
