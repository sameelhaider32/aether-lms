# Aether 2.0 direction — recorded before implementation

The retained starting point is local v1.8.2 (`2753d6d`), with a recoverable `checkpoint/aether-1.8.2-before-2.0` branch. The existing home composition, original navigation, procedural folded-field artwork, Monochrome, Spotlight/full-text/session cache, downloader and Mission Control remain the foundation. No spatial-home branch is included.

## Reference evidence and decisions

- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials) distinguishes a navigation/control layer from content and recommends sparing glass, readable regular materials and accessibility alternatives. [WWDC 2025: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) describes dynamics and adaptivity. Use a modest translucent header, palette and preview chrome, with a solid fallback. Dense academic content stays opaque; no stacked/full-screen blur. This is a web interpretation, not Apple's renderer.
- [Geist typography](https://vercel.com/geist/typography), visually inspected in Chrome, pairs consistent heading/body scales with compact 14px controls, 13px secondary text and tabular numerical labels. Adopt locally bundled OFL Geist Sans and Mono, a 12/13/14/16px interface scale and restrained responsive headings. Drop novelty display typography and widespread uppercase. Keep authored course documents and editable content outside the type reset.
- [Linear](https://linear.app/), visually inspected, combines compact navigation and quiet borders with strong type hierarchy. Its public product preview has dense lists and a calm sidebar. Apply that organization to search, planning and academic records; no claim of inspecting its authenticated app.
- [Stripe](https://stripe.com/), visually inspected, uses precise grid alignment, a clear CTA hierarchy and expressive artwork contained to the hero. Retain Aether's artwork in its current home composition and reduce competing visual accents.
- [Apple](https://www.apple.com/), visually inspected, uses a restrained navigation layer and generous, legible grouping. Use clear section rhythm and comfortable controls instead of enlarging every surface.
- [Instagram reel](https://www.instagram.com/reel/De1njZtRl4t/): Chrome access showed an excerpt of a laptop/trackpad demonstration with a red/ivory architectural website. The full sequence was not reliably inspected; no detailed interaction or motion technique is inferred from that excerpt.

## Shared foundations

Both Original and Monochrome share fonts, spacing, rounded geometry, focus rings and short 120–180ms control transitions / 220ms surfaces. Keep theme/session keys and ON/OFF controls. Use color tokens, not a new parallel theme architecture. Glass has thin highlights and modest shadows; content uses quiet separators and opaque surfaces. Hover depth is subtle and excludes editing surfaces. Motion OFF and OS reduced motion retain a finished static composition.

## Baseline and priorities

Three warm samples per mode at 1440×1000, DPR 1, headless Chromium, intercepted fictional data. On the 300-file Resources fixture, median Aether control readiness was 537ms (native DCL 32ms), FCP 996ms, Spotlight open round-trip 236.5ms, 11 long tasks. With Motion OFF readiness was 398.7ms and Spotlight 177.5ms: graphics alone do not explain the slowdown. Raw measurements are in `baseline.json`; open measurements include browser automation overhead and event timing is not field INP.

The CPU sample attributes ~419ms to `content.js` visible-title geometry reads, ~308ms to per-frame WebGL resize geometry, ~247ms to initial scene geometry and ~216ms to palette removal/style invalidation. Fix redundant/early layout reads, parser-time scan churn and render lifecycle before adding materials. Lazy parser loading already exists and should be preserved. Measure again in the same harness, then validate lifecycle, privacy, frame support, controls and representative views at all five requested widths.
