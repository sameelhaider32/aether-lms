# Aether Spotlight (1.8)

Spotlight adds a search/command dialog to the retained v1.6 interface. It does not redesign Home, remove the sidebar, alter graphics/fonts or reuse the rejected spatial-home branch. The existing unpacked extension folder remains the installation.

## Entry and actions

Use the header search button, Ctrl/Cmd+K where the browser permits it, or Alt+Shift+K. The frame bridge forwards supported same-origin documents to one top-level dialog. Shortcuts ignore typing fields, rich editors, assessment contexts, native modals, prevented/repeated events and Aether OFF. The native dialog handles focus containment; Escape and click-away close and restore the originating element, including a supported frame. No page scroll lock or native history override is installed.

Category filters, local highlights, arrow selection and Enter work without rebuilding the index from the page or fetching on each query. `>` overrides category filtering for command-only mode. Commands call the installed theme/motion/download/deadline actions or verified native navigation. Mission Control/deadlines commands appear when those controls exist; appearance preferences focus the existing theme selector. No submit, grade, delete, upload or Sakai-setting command exists.

## Shared data

- Native courses and per-course tool anchors use actual destinations. Discovered tools are captured from the same course pages already read by the academic adapter; no additional tool crawler or guessed tool IDs.
- `academic-store.js` wraps the existing `academic-sources.js` loader with one account-scoped job/cache, a five-minute freshness window and cancellable consumers. Mission Control and Spotlight share its progressive snapshot. The original student-list parsing, hidden/future release exclusions, course/request/byte/concurrency limits and rejected generic-assignment endpoint policy remain intact. Verified submission/draft/unknown semantics use the existing academic model. Known events and announcements remain partial observations.
- Resources reuse the actual Download Manager controller/tree/discovery cache. Already-known entries come first. The explicit broader search is serial, reads metadata only, and is capped at eight roots, 12 folders, two expansion levels and one available-site page if shared course discovery is unavailable. Existing per-request byte and 10,000-node limits still apply. Download/export selection is not changed. Discovery cancellation aborts only Spotlight's operation; it does not cancel an existing export. Busy Download Manager operations are respected.
- Native visible resources retain their original anchor and preview button. Metadata-only files use the same preview controller through a validated same-origin content-ID descriptor, with current-account validation, the same limits/readers and separate copyright acknowledgment. No synthetic native resource rows or bypass of access controls. Folder results open an actual native folder/Resources destination where available, otherwise the known course. Metadata discovery never fetches file content. Explicit v1.8 content indexing is documented in [FULL_TEXT_SEARCH.md](FULL_TEXT_SEARCH.md).

## Index and lifecycle

The dependency-free ranker normalizes Unicode text, uses exact/title-prefix/word-boundary/substring matching followed by limited single-edit matching, and adds a small context boost without overruling stronger cross-course matches. Course codes and title initials support queries such as `DS resources`. At most 5,000 entries and 30 displayed results; no query/index persistence. Metadata updates are batched from existing context/record/controller events, not scanned per query. The frame set is bounded and detached frames are removed.

The index/cache clear on OFF, logout, document lifecycle or an observed session change. An account change locks Spotlight private indexing until page refresh so stale native DOM cannot be silently attributed to another identity. Mission Control retains its existing ability to explicitly refresh the authenticated new account; its fresh snapshot remains excluded from the locked Spotlight index. Ongoing reads are cancelled and late results are guarded. Missing APIs produce partial/unavailable states; known navigation remains usable when advanced metadata endpoints fail. Missing authoritative identity disables private indexing while safe UI commands remain available.

## Focused validation

`node tests/spotlight.cjs` uses the actual unpacked extension in a fresh Chromium profile and only fictional intercepted GET responses. Covers ranking/acronyms/typos, real course/tool hrefs and Enter navigation, observed student assignments and hidden/unreleased exclusion, highlights/categories/arrow keys, no query requests, Escape/click-away/focus return, both themes, 390px overflow, reuse of a completed Mission Control check, bounded explicit metadata discovery/cancellation, safe metadata-only preview and absence of private durable search data; supported frame entry/focus return, form/assessment shortcut protection, OFF removal, delayed native header replacement, and account-switch cancellation/clearing. Screenshots contain fictional data. No broad local regression, stress, packaging or security-audit run.

## Limitations

Authenticated live LUMS API and shell variations are unverified. Coverage is explicitly partial: native navigation and observed snapshots only, student assignments only when the established student-view schema is available, calendar/announcement records only as returned, and resources only as discovered within bounds. Scanned folder results may fall back to their course if a native Resources target is unknown. Unsupported file types retain the normal original-link/metadata fallback. Browser-owned Ctrl/Cmd+K may be intercepted before page code; use the header or alternate shortcut. Full repository CI is automatic under its existing PR workflow, not a claim of completed local checks.
