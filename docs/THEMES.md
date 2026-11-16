# Selectable themes (1.6)

Choose **Aether Original** or **Monochrome** from **THEME**, beside the existing AETHER switch. New installations keep Aether Original. Reload the existing unpacked extension at `chrome://extensions`, then refresh LMS tabs after updating files; no build or new folder is needed.

## Reference and design

The actual [Vexon preview](https://www.getlayers.ai/templates?layer=vexon) was inspected in Chrome. It uses a black field, a bright silver particle halo, gray/white headline contrast, fine outlined controls and some faint blue lighting. The surrounding GetLayers library and performance panels are not the template. Aether borrows the neutral light and border treatment, retaining its existing fonts, typography, hero, folded field, sidebar, course cards and academic layouts. No template source or assets are copied. Red is reserved for later.

## Implementation

- `src/theme-settings.js` validates the two supported themes. `chrome.storage.local` key `aether:v16:theme` is authoritative; same-origin localStorage caches it for `prepaint.js`. Storage changes update other tabs. A guarded observer mirrors the top document's theme into tool frames, including later frame navigations. Unsupported/cross-origin frames fail open.
- `src/palette.css` owns the neutral channel scale and monochrome refinements under `data-aether-theme="monochrome"`, gated by active Aether surface classes. Historical CSS colors in theme, cards, academic, resources, workspace, design, Mission Control, preview and download styles now use this scale with their exact original RGB/alpha as fallbacks. Removing theme scope restores default colors without re-rendering native nodes.
- `content.js` adds only the labelled select, using the existing header and settings behavior. `gradebook-chart.js` observes theme changes, restores its tracked original values before changing modes, and updates only existing statistics chart presentation. Native data and callbacks remain intact.
- Only decorative canvases and extension-owned glyphs use grayscale filters. No filter is applied to page ancestors or authored document canvases; fixed overlays and native chart coordinates keep their geometry. The PDF/Office HTML pages load the same theme coordinator and palette for their reader chrome. The manifest keeps the existing storage-only permission and LUMS host scope.
- Existing enable/OFF and motion settings continue unchanged. State badges keep labels, including overdue, submitted, opened and access failures, so grayscale does not remove their meaning.

## Focused validation

`npm run test:theme` loads the real unpacked extension in a fresh isolated Chromium profile and intercepts LMS requests with fictional fixtures. It covers instant switching, unchanged hero typography/geometry and restored original CTA color, storage restore after removing the page cache, cross-tab updates, reduced motion, neutral Mission Control/record colors, native resource actions/checkbox/links, assignments, announcements, Gradebook statistics, download manager, live PDF reader theme, same-origin frames, OFF/reload/ON and untouched form/CSRF fields. Fixture traffic is GET-only.

`node tests/gradebook-chart.cjs` additionally uses the pinned Sakai-era Chart.js 2.7 fixture to verify rendered colors, highlight distinction, mode switching/restoration, native OFF colors, callbacks, late initialization, native data replacement and both modern/legacy statistics modal variants.

Live authenticated LUMS workflows and every role-specific markup variant have not been exercised. Native PDF/Office document content and external viewers are intentionally not recolored. Theme smoke screenshots use fictional data. Existing repository CI remains required before merging; the local check is deliberately focused.
