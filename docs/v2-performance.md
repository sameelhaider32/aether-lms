# Aether 2.0 performance evidence

## Result and boundaries

The 300-file Resources workload improves substantially: initial Aether controls are created in 137.5ms instead of 537ms; first contentful paint is 392ms instead of 996ms; Spotlight open is 73.9ms instead of 236.5ms. Total observed long-task time falls from 2160ms to 324ms for the same scripted workload. These are fixture measurements, not live-LMS timing guarantees.

Not every measure improves. Home full-motion FCP is 172ms versus 164ms and its frame-interval p95 is 33.3ms versus 16.9ms in these runs. Home Spotlight is 54.9ms versus 30.8ms, still below the 100ms target. Motion-OFF Resources has more frames over 25ms (8.7% versus 5.5%), although its long-task time falls from 1270ms to 241ms. Median frame intervals are approximately 16.7ms throughout. Occasional missed frames remain; this release does not establish universal 60 FPS or field INP.

## Comparable method

- Real unpacked MV3 files at retained v1.8.2 (`2753d6d`) and final v2.0.0, same Windows machine and Chromium 156.0.8078.4 executable. Headless desktop, 1440×1000, DPR 1, no CPU throttling; graphics backend not controlled.
- Three warm navigations per condition after one warm-up. Native condition loads no extension. All HTTPS responses are intercepted fictional Sakai data, including a 300-file Resources page. No real account data or live academic operation is used.
- Fixed sequence: navigate, wait 650ms after controls, six scroll gestures, Spotlight open/type/Escape, text-preview open/Escape on Resources, then two 500ms idle windows. Same actions and waits in baseline/final; slow tasks naturally lengthen elapsed workload time.
- `usableMs` means DOM creation of workspace + Spotlight trigger, **not a measured TTI or painted usability guarantee**. Native value is DOMContentLoaded. FCP and DCL are separately recorded. FCP minus native FCP is a rough paint-overhead indicator, not a causal decomposition of server, parsing and extension time.
- Open latency includes automation round trips and competing page work. Event Timing maxima describe these tested events, not field INP. Frame intervals include startup, scroll and dialog work. CPU profiles are sampled evidence, not exact per-function accounting.
- JS/layout durations and JS heap come from CDP Performance metrics. Heap after explicit GC is renderer JavaScript only. GPU/process peak memory, a complete detached-node census, and baseline observer/timer lifetime counts were not collected.

## Medians: v1.8.2 → v2.0.0

All times below are milliseconds.

| Condition | Controls/DCL | FCP | Script work | Layout work | Frame p95 |
|---|---:|---:|---:|---:|---:|
| native / home | 15.6 → 18.1 | 40.0 → 56.0 | 6.9 → 5.8 | 0.3 → 0.6 | 16.8 → 16.9 |
| native / resources | 32.2 → 30.8 | 88.0 → 88.0 | 7.1 → 5.4 | 23.0 → 21.6 | 16.9 → 16.9 |
| full / home | 88.6 → 83.3 | 164 → 172 | 250 → 223 | 81.6 → 52.1 | 16.9 → 33.3 |
| full / resources | 537 → 138 | 996 → 392 | 739 → 304 | 235 → 107 | 100 → 33.5 |
| motion-off / home | 80.8 → 59.4 | 184 → 160 | 84.8 → 57.9 | 72.2 → 41.7 | 16.9 → 16.9 |
| motion-off / resources | 399 → 114 | 832 → 316 | 350 → 191 | 183 → 105 | 33.2 → 33.4 |

| 300-file Resources, full motion | Before | After |
|---|---:|---:|
| Long tasks | 11 | 3 |
| Sum of long-task durations | 2160ms | 324ms |
| Longest task | 681ms | 155ms |
| Tested Event Timing maximum | 312ms | 72ms |
| Spotlight open round trip | 236.5ms | 73.9ms |
| Text preview open round trip | 80.1ms | 60.9ms |
| Layout-shift score | 0.0421 | 0.0261 |
| Frames over 25ms | 13.0% | 10.7% |
| Renderer JS after GC | 4.60 MB | 4.57 MB |

Resources paint overhead relative to native FCP changes from about 908ms to 304ms with full motion, and from 744ms to 228ms with Motion OFF. The full-motion large-page result is just above the preferred 300ms engineering target even by this limited proxy. We do not claim the TTI target has been proved. The complete samples, including variability and outliers, are in [baseline.json](evidence/v2/baseline.json) and [final.json](evidence/v2/final.json).

An early cold-start check had a 3.8s environment outlier and was not discarded from the investigation. After correcting the startup test's old GPU expectations, its repeat observed workspace/stars at 468ms, the static first field at 489ms and GPU artwork at 1130ms, all before a deliberately delayed 3098ms DOMContentLoaded. Those cold values are separate from the warm medians.

## Profile-led changes

The original sampled Resources profile attributes roughly 419ms to breadcrumb `getClientRects`, 308ms to per-frame scene resize geometry, 247ms to initial scene geometry and 216ms to closing/removing Spotlight. The final architecture removes the layout-dependent breadcrumb query and sizes graphics from ResizeObserver entries. Compare the [before](evidence/v2/baseline-resources.cpuprofile) and [after](evidence/v2/final-resources.cpuprofile) CPU profiles in DevTools.

- Native record and preview adapters batch parser/mutation changes at a frame boundary, filter owned mutations, and remain idempotent. OFF restoration bypasses batching and restores native roles/classes immediately.
- Large read-only resource tables use `content-visibility:auto` for offscreen internals. All native records, sort handlers, controls and findable text remain in the DOM; focused/open-menu cards escape containment. This is browser rendering deferral, not data virtualization.
- Resource descriptions are reused within a preview-enhancement batch; resource-tool lookup maps avoid repeated per-file array construction; unchanged course scopes avoid rebuilding the select control.
- Spotlight discovery and session-cache restoration initialize on use. Heavy PDF/Office/ZIP parsers were already on demand and remain so. File reads still recheck identity/access; no account cache shortcut was introduced.
- Shaders yield to paint/input via idle scheduling. Motion OFF uses a finished local static field without eagerly creating a WebGL context. Graphics buffers are bounded and reused, detail adapts to sustained slow frames, and lower-detail drawing strides across the entire shape. Replaced contexts are explicitly released.
- Pointer card work is batched per frame with shallower tilt, ambient drawing is capped near 15Hz on desktop, and hidden extraction/discovery is cancelled. Existing reduced-motion and hidden-frame guards remain.
- Font binaries shrink from 908,576 bytes across five legacy files to 141,356 bytes for two pinned OFL variable WOFF2 files. No runtime CDN dependency.

## Lifetime and idle evidence

After six warm-up cycles, ten further cycles each open/close Spotlight, a text preview and Download Manager. Retained JS rises by 139,024 bytes (about 136KiB); this is a small measured increase, **not zero growth or proof of absence of all leaks**. DOM nodes remain 795 → 795; event listeners 175 → 175. Observer instances after GC remain 9 MutationObservers, 2 IntersectionObservers and 2 ResizeObservers. Counts include any retained disconnected objects and do not prove how many observations are active.

There are zero requests during the final 35-second closed-surface idle window. The interaction-created timer probe ends with one expected 30-minute basket-expiry timeout and zero intervals. It starts after initialization; the source audit separately identifies the bounded 30-second content identity interval (inactive when empty/hidden) and Home's minute clock. Necessary access checks for an opted-in index or open manager remain.

The browser's focus/visibility emulation prevented obtaining a native hidden signal even after switching tabs/minimizing the isolated window. The harness explicitly reports `nativeVisibilityObserved:false` and emulates the visibility signal in the extension world. Under that signal, the shared ticker has no pending animation frame and executes about 10.4ms of script across the 2.5s observation plus probes. Native hidden-tab behavior still needs a normal Chrome/live-device check. See [lifetime.json](evidence/v2/lifetime.json).

## Reproduce and remaining validation

Install development dependencies and Playwright Chromium, then use `npm run test:v2-performance`, `npm run test:v2-visual` and `npm run test:v2-lifetime`. Optional `AETHER_CHROMIUM`, `AETHER_EXTENSION`, `AETHER_REPORT_DIR` and `AETHER_PERF_SAMPLES` select the browser, source, output and sample count. Lifetime testing opens an isolated offscreen headful window. Reports use fictional data and never require LMS credentials.

Authenticated live-LUMS server latency, unsupported third-party tool frames, real PDF/Office edge cases and sustained hardware/GPU performance remain live-validation work. The Instagram reference was only partially observable. No native Apple renderer, new backend, telemetry, remote executable code, new permissions or Red theme is included.
