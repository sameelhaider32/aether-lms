# Browser-session document cache (1.8.2)

Completed document indexes now survive LMS page reloads, ordinary navigation and closing/reopening LMS tabs while Chrome remains running. The cache holds extracted searchable chunks and locations, not original document bytes or search queries. Initial indexing is still explicit. Pending work is cancelled on departure; already checkpointed documents are retained.

Chrome's `storage.session` is memory-only and is cleared by browser restart or extension reload/update/disable. Aether also clears it on explicit **Clear indexed contents**, Aether OFF, observed logout/anonymous/unavailable identity or account changes. Clearing propagates to registered open LMS tabs. Existing changed-account refresh locks remain in place. The original theme, layout, motion and resource/academic workflows are retained.

## Use

Reload Aether once after this update, refresh LMS and index your chosen documents. After that, normal LMS refreshes and reopened tabs can reuse them within the same Chrome session. **Start indexing** reuses unchanged indexed documents and processes new/changed selections; **Refresh selected contents** explicitly forces a fresh read/extraction. The opt-in for deliberately opened documents also lasts for the Chrome session and clears with the cache. Hover never indexes.

On restore, Aether first verifies the authoritative account. It checks the relevant parent-folder metadata using the shared Download Manager Discovery/ResourceAccess path, requires the resource to be present in the latest verified child listing, respects hidden/unavailable ancestors/files, and compares reliable modification/version stamps. Removed/inaccessible or changed documents are excluded from restored search text. Changed documents can be selected for indexing again; there is no automatic bulk body download. When reliable version metadata is absent, reuse is limited to four hours from extraction; an explicit refresh is always available.

Metadata checks use at most 32 parent folders per restore pass with a 15-second budget, retaining safely verified partial results. Pending checks can retry when Spotlight is reopened. Existing folder request limits and account guards still apply. The status distinguishes restoring, restored and changed/unchecked documents. These are metadata reads; successful reuse does not fetch or parse document bodies. Current-tab search still works if the session cache is unavailable.

## Storage boundary

- `src/spotlight-cache-worker.js` owns `chrome.storage.session` under one Aether namespace. It keeps storage explicitly restricted to trusted extension contexts, without exposing session storage directly to content scripts or pages.
- Messages must come from this extension's top-level LMS portal content script. The broker validates sender ID, exact origin, portal path, top frame, authoritative-account hash, generation token and bounded canonical resource/chunk records. There is no externally-connectable endpoint, arbitrary URL parser or new host permission.
- The broker serializes mutations and rotates tokens on invalidation; queued writes with old tokens cannot resurrect cleared or previous-account text. Checkpoints survive worker suspension/restart within the same browser session. Clear/change notifications use known tab IDs and contain no document text.
- Cache records include resource descriptors/version, at most 400 already-bounded text chunks/document, locations, partial coverage and extraction time. Tokens/postings are rebuilt locally after authorized restore. Queries, original file bytes and batch jobs are not cached.
- Existing 100-document, 2,000,000-character and 4,000-chunk limits remain. The cache additionally targets at most 6 MiB of conservative serialized-memory estimates, or 70% of Chrome's session quota if lower; least-recently stored documents are evicted as needed. A quota failure falls back safely, with an explicit status when some current-tab results cannot be cached. Older Chrome versions with smaller quotas can retain fewer documents. No `unlimitedStorage` permission.
- No document text/index is written to storage.local, storage.sync, localStorage, sessionStorage, IndexedDB, a file or external service. Existing appearance settings and hashed opened-file history are unchanged. Browser network caching retains its normal behavior.

`academic-store.js` announces document departure before discarding page-local state so normal navigation cannot be mistaken for logout. Back/forward cache restoration rechecks identity. Only completed checkpoints survive departure; cancelled/incomplete work is not resumed silently.

## Focused validation

`tests/session-cache-worker.cjs` checks strict sender/frame/origin validation, suspension/restart restoration, broadcast clearing, stale writes/account separation, invalid documents, quota fallback and a fresh browser session.

`tests/session-cache.cjs` loads the real unpacked extension with entirely fictional intercepted LMS GETs. It checks reload and closed/reopened-tab reuse with zero repeated document downloads, preserved locations/session opt-in, changed and newly hidden resources being excluded, incremental indexing, cross-tab clear, OFF/logout/account cleanup, trusted-only session storage, no durable private text/IndexedDB, and an actual Chrome restart using the same profile producing an empty cache. Retained content extraction, Spotlight/resource/Gradebook/ZIP checks are also run as focused regression smoke. No real academic materials or consequential LMS actions are used.

Chrome lifecycle reference: [Storage API — session](https://developer.chrome.com/docs/extensions/reference/api/storage#session).
