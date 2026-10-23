# Changelog

## Unreleased

- Add a reversible scroll fade and particle dissolve to the existing pinned course cards, inspired by the supplied Forma recording. Keep native navigation, keyboard focus, reordering, and reduced-motion behavior; render particles locally without a new library or network service.
- Restore v1.3 full-card assignment color fills, including its green submitted and red overdue materials, with matching fills for the additional urgency states. Remove the side accent stripe and retain real text badges for submission, draft, grading, feedback, and confirmed lateness.
- Keep submitted work mint after deadlines and update urgency/countdowns automatically without inferring lateness from the current clock.
- Add local Unopened/Opened/Updated file states and temporary failure labels, recording deliberate opens and successful explicit previews only. Version changes invalidate the preview cache.
- Bound opened history to 1,000 hashed resource/version entries with timestamps, and add Clear file history without storing filenames, raw URLs, documents, or grades.
- Open larger file readers with an expand/restore control and pointer/keyboard resizing; PDF pages redraw on resize and offer zoom and fit-width controls.
- Preview existing assignment and draft attachments, including supported slides and Office files, without replacing their native links, forms, or submission controls.
- Build the Home course deck and count from native pinned sites, excluding Recent entries, updating after pin changes, and showing an empty state when no courses are pinned.
- Start Aether automatically on the bare LMS domain (`/`) and Sakai entry URLs with repeated leading slashes, including `//portal`, while retaining the LMS host and route restrictions.
- Apply the theme, Aether toggle, and ambient field to the public gateway without adding a course workspace or replacing the native sign-in form.
- Add real-extension regressions for entry routes, late Home markup, gateway form submission and toggles, double-slash file previews, and unrelated-path exclusion.

## 1.3.0 — 23 October 2026

- Generalized Resources cards for TA/instructor management forms, native action selectors, extra columns, pagination/context rows and same-origin tool frames.
- Retained original add/remove/upload/bulk controls, selection values, CSRF fields, native handlers and permissions; actual record editing remains native.
- Added a shared resource descriptor for visible names, native file/folder links and copyright click-handler URLs.
- Added explicit copyright acknowledgement inside the preview using Sakai's native notice and acceptance endpoint, followed by the file in the same panel.
- Added local PPTX slide rendering/navigation, DOCX reading, XLSX worksheet/value views, ZIP entry lists and native audio/video controls.
- Added lazy packaged readers, bounded archive checks, inert notice extraction, blocked external document media/navigation and preserved licensing/provenance.
- Retained immediate hover dismissal and all existing PDF, resource, assignment, Gradebook/Roster and graphics behavior.
- Added 26 role/copyright/format/responsive browser regressions, fictional Office fixtures and three unit/security checks.

## 1.2.1 — 22 October 2026

- Removed the 260 ms hover-preview close timer; dismissal now occurs in the pointer-leave event.
- Fixed resource-to-resource movement cancelling the old preview close.
- Covered portal and embedded-tool pointer exits, viewport exits and scrolling, with immediate cancellation of pending reads.
- Retained the hover opening delay, explicit Preview and keyboard interaction, PDF navigation and Escape focus restoration.
- Added eight real-pointer browser regressions, also run against the installable package.

## 1.2.0 — 22 October 2026

- Matched Gradebook and Roster to Resources and Assignments, including same-origin tool frames, typography, panels, controls and keyboard focus.
- Added read-only student grade item cards while preserving exact scores, release states, category headings and native statistics controls.
- Styled editable and comparison grade tables without converting them into cards or replacing grading widgets.
- Recognized native Sakai Roster card, photo and table views, retaining original photos, profile links, permitted email fields, group selectors, search, sorting and pagination.
- Restored table attributes when a native tool switches between read-only and edit modes; OFF preserves original elements and entered values.
- Added 18 browser regressions across desktop, mobile and framed tools, plus a read-only versus editable grade classifier check.
- Retained fast visual startup, page-wide sparkles, previews, assignment semantics, storage keys and existing permissions.

## 1.1.1 — 22 October 2026

- Removed parser-readiness and idle-slot waits from visual startup.
- Stars render during page parsing; the folded field gets an immediate lightweight procedural first frame.
- GPU rendering begins after that frame has painted and replaces it when ready.
- Pending startup is cancelled on OFF, navigation and teardown; early ON restarts cleanly.
- Added delayed-parser startup timings, reduced-motion startup and early-toggle regressions.

## 1.1.0 — 22 October 2026

- Restored the full-page luminous starfield and mint/cyan sparkles beyond the hero.
- Fixed the opaque legacy main-wrapper gradient that concealed the background in v1.0, without moving or transforming native content.
- Added cached glow sprites, gentle twinkling, smooth pointer proximity illumination and a viewport-adaptive star budget.
- Retained static reduced-motion/Motion OFF rendering, instant Aether OFF restoration, native opaque panels, and the shared scheduler.
- Added browser checks for stars in all four viewport quadrants, pointer glow, static mode and main-wrapper transparency.
- Version-aware packaging keeps previous release files and reports intact.

## 1.0.0 — 22 October 2026

- Editorial Home, original folded mathematical particle sculpture, local Doto/Oswald/Space Grotesk typography, mint/cyan/graphite tokens and an ice-white on-page academic activity panel.
- Adaptive marching-square contours and sparse pointer glints behind content.
- Shared visibility-aware scheduler, bounded springs, accessible authored-heading entrances and delegated card elevation/tilt.
- Compact course headers, stable original dropdowns with readable contrast and preserved keyboard operation.
- Conservative classification keeps gradebooks, assessments, editing forms, comparative tables and unsupported DOM native.
- Cloned tool icons exclude active SVG/HTML content and external references.
- Dynamic Home activity refresh, reduced-motion overrides without preference loss and WebGL context-loss fallback.
- Preserved assignment parsing, native handlers, URLs, reordering keys, read-only preview limits and all packaged PDF.js assets. Permission remains `storage` only.
- Added automated unpacked-MV3 Chromium fixtures, responsive screenshots, performance samples, security/unit checks, deterministic packaging and tagged rollback history.

## 0.8.1 — supplied baseline

Preserved under Git tag `v0.8.1` and as an unchanged rollback ZIP. Original Git history and tests were not supplied.
