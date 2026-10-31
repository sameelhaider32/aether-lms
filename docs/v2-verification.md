# Aether 2.0 verification and changed files

All browser cases intercept fictional LMS requests. No real academic submission, grade change, resource mutation or upload was performed.

| Gate | Evidence |
|---|---|
| Core workflows / previews / file consent / resource native controls | 80/80 [browser cases](evidence/v2/core-regression.json) |
| Gradebook / statistics / Roster / editing / tool frames / OFF | 17/17 [academic cases](evidence/v2/academic-regression.json), including the five required widths |
| Mission Control | 15/15 focused cases, including source coverage, account failure and native navigation |
| Downloader | 24/24 browser cases; model, network, controller and streaming archive checks pass |
| Search / full text / Gradebook / ZIP suffixes / session privacy | Existing focused browser/broker checks pass; cancelled jobs, permission revocation and account changes remain guarded |
| Startup / fallback | 5/5 progressive-startup and 5/5 portable-renderer/cancellation checks pass |
| Visual review | 120/120 static compositions, 10 live WebGL compositions; [review](v2-visual-review.md) |
| Lifetime / performance | Bounded warm-cycle counts, zero 35s idle requests, emulated hidden suspension, before/after medians; [limits and raw evidence](v2-performance.md) |

The academic pass found a real OFF timing regression: generic batching delayed role restoration by a frame. The fix restores OFF synchronously in the state observer while retaining frame-batched ordinary updates; the affected Gradebook, Roster and frame checks now pass. The font-dependent tests now assert Geist roles, and the startup test checks a rendered field rather than canvas size alone. The test browser can use `AETHER_CHROMIUM` consistently.

The requested source folder is the actual Chrome destination: Default's historical `Downloads/Aether LMS/aether-lms-extension-v1.3.0/aether-lms-extension-v1.3.0` path is a junction targeting `Downloads/Aether LMS Latest`. The junction, extension ID and stored preferences were preserved. Local rollback checkpoint: `checkpoint/aether-1.8.2-before-2.0`, at `2753d6d`.

## Changed files

| Area | Main files and reason |
|---|---|
| Shared design foundations | `src/system.css`, `src/fonts.css`, `src/design.css`, `src/palette.css`, `fonts/Geist*`: shared typography, tokens, materials, geometry and licensed local assets; retire unused legacy fonts |
| Native and feature surfaces | `src/theme.css`, `src/workspace.css`, `src/cards.css`, `src/academic.css`, `src/resource-polish.css`, `src/preview.css`, `src/download.css`, `src/mission-control.css`, `src/spotlight.css`, `preview/pdf.css`, `preview/office.css`: shared type scale and controls; content fonts retained |
| Startup and graphics | `src/content.js`, `src/scene.js`, `src/motion.js`, `src/ambient.js`: remove forced geometry reads, idle shader startup, observer sizing, adaptive whole-shape detail, pointer batching and cleanup |
| Native adapters | `src/lists.js`, `src/resource-preview.js`, `src/download-ui.js`: batched enhancement, batch-local descriptor reuse, large-resource rendering and immediate native OFF restoration |
| Search and lifetime | `src/spotlight.js`, `src/spotlight-content.js`: on-use metadata/cache readiness, stable selectors, tool-map reuse, hidden discovery/extraction cancellation and inactive empty-index polling |
| Release and validation | Manifest/package/lock v2.0.0, notices, README/changelog, focused existing-test adjustments, `tests/v2-*.cjs`, design/performance/visual/verification documentation and fictional evidence |

The branch is based on the retained working full-text/session-cache branch, preserving PR #15's dependencies on the earlier Spotlight and Monochrome work. The rejected spatial-home branch is not merged. Red is not implemented.

Authenticated live-LUMS compatibility and native hardware/visibility behavior remain validation limits, not passing assertions. See the performance report for measured regressions as well as improvements.
