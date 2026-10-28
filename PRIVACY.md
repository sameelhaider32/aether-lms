# Privacy and file handling

Aether LMS is an independent extension for `https://lms.lums.edu.pk/*`. It has no analytics service or external document conversion backend.

## What it accesses

- The current Sakai page, to present existing courses, tools, records, and on-page activity.
- The same-origin, read-only `/direct/session/current.json` endpoint, to establish the authenticated Sakai user for local history. Missing, anonymous, failed or unsupported identity responses disable history; previews and native controls remain available. No identity is inferred from course names or resource URLs.
- Files or folder responses from the same LMS when you request a preview. Requests use your existing signed-in session and retain Sakai's access checks.
- A native copyright notice when required. Only selecting **Yes, accept and preview** sends the acknowledgement to Sakai for that resource. Hovering does not accept it.

The extension does not collect credentials or upload academic files to another service. Opening original links and performing native Sakai actions retain the LMS's own behavior and privacy policies.

## What it stores

The sole declared extension permission is `storage`. Aether remembers interface preferences, motion settings, and shortcut order using extension-local/browser storage. It does not use Chrome storage sync.

The selected theme (`aether` or `monochrome`) is saved in `chrome.storage.local` as `aether:v16:theme`, with the same value cached in same-origin localStorage for first paint. This stores only the appearance choice; it adds no academic data or remote requests.

Opened-file history is stored in `chrome.storage.local` on this device, with a limit of 1,000 file entries across accounts. Each entry contains a SHA-256 key incorporating a hash of the authoritative account ID and the LMS resource origin/path, an opened timestamp, and a hash of reliable version/modification metadata when available. Raw account identifiers, URLs, filenames, document contents, grades, and assignment statuses are not stored in this history. Hashes are pseudonymous local identifiers, not encryption. File-open history is not sent to Sakai or any external service.

Version 1.3.1 discards old unscoped opened-file entries because they cannot safely be associated with an account. It preserves appearance, motion and ordering preferences. Tabs and tool frames serialize history mutations with Web Locks; Clear waits for earlier writes and reports a storage failure instead of claiming success. If coordination is unavailable, history is disabled. Identity is checked for badge batches and deliberate opens, and on focus/restoration. Account changes close previews and clear their memory caches. A preview begun in one account cannot mark another account's history.

History begins when you use this feature; Aether cannot reconstruct earlier file opens. A successful explicit preview or deliberate original-file click records **Opened**. Hovering alone, automatic script clicks, and failed previews do not. **Opened** describes an action in this browser, not proof that a file was read. **Updated** requires a known change in native version/modification metadata; unavailable or ambiguous metadata is not treated as a new version. Select **Clear file history** in any preview footer to remove all opened-file entries. This does not clear your other preferences or delete LMS files. Access/preview failure indicators are temporary and are not persisted.

Preview content has a memory-only cache of up to six entries and 24 MB total. The browser can also apply its normal network caching. Aether does not create a separate persistent document library or account. Closing a preview or switching Aether off cancels pending reads. Native downloads remain controlled by Chrome and Sakai.

## Resource collections and ZIP export (1.4)

The download manager reads same-origin Resources metadata only when opened or when you request expansion, discovery or selection review. Available-course discovery uses authenticated GET `/direct/site.json?select=access` with bounded pagination; folder discovery uses depth-1 `/direct/content/resources/...json`. It does not guess site IDs, scan courses at startup, query archived hosts or contact Zambeel. A server's accessible listing is not evidence of every enrollment or restricted resource.

The basket contains names, same-origin resource references and selection intentions **only in the current page's memory**. It is not written to Chrome storage, localStorage, IndexedDB or a remote service. There is no migration or attribution of old baskets. It expires after 30 minutes of inactivity, clears on navigation/logout/account change/OFF, and cannot survive a browser restart. File contents are never stored in tree nodes or extension storage.

Export uses the signed-in session, GET requests, manual redirect handling and the preview's exact-resource copyright validation. Each acknowledgement needs your separate explicit acceptance. A retry repeats read-only discovery/download, never an earlier acknowledgement. External links and unsupported references are excluded. Export and metadata scans do not update opened-file history.

One file streams at a time through locally bundled zip.js into a user-chosen File System Access destination (maximum 2 GiB output). The manager does not use persistent temporary document storage. If direct saving is unavailable, the explicitly selected small-export mode retains up to 64 MiB of archive bytes in page memory before giving Chrome a Blob download. Unknown lengths are subject to the same byte ceiling. A temporary download Blob URL is revoked after 30 seconds. Browser/OS download handling follows Chrome's normal policies.

Identity is revalidated before discovery, export, finalization and explicit copyright acceptance, at file boundaries after 15 seconds, and every 30 seconds only while an operation is active. Account changes stop requests and clear stale metadata. Missing authoritative identity blocks managed export; native Sakai remains available. This cannot detect an account change before Sakai exposes it to the extension.

Cancellation aborts requests and unfinished writes. Chrome may retain an empty newly chosen destination, and Aether never deletes a pre-existing destination to clean up a failed save. Partial exports require confirmation and contain only successful entries in the ZIP directory; interrupted entry bytes may remain as unindexed ZIP data. The UI reports failures without creating empty successful placeholders. File paths are sanitized and collision-resolved locally. No telemetry or remote diagnostics were added.

## Mission Control (1.5)

On enabled, authenticated Home pages, Mission Control reads accessible-site metadata, a bounded cross-course calendar feed, course announcement lists and discovered native course/student-assignment pages with the existing same-origin Sakai session and GET requests. Requests do not drive forms, pagination, submissions, quizzes, grading or copyright acceptance. Generic assignment listing APIs are not queried because their release/group visibility contract is insufficient. No other students' submission data is imported.

Normalized academic titles, course IDs, original links, dates and verified native student statuses live only in the current page's memory. API response bodies and native documents are temporary parsing inputs, never stored in extension storage. Announcement bodies, attachments and grade cells are not copied into dashboard records. Mission Control adds no localStorage, sessionStorage, IndexedDB or Chrome storage entries, account or analytics service. Requests use no-store caching.

The newly-observed announcement baseline holds at most the bounded returned announcement identifiers in this tab; it is account-scoped in memory through the existing authoritative identity helper. It does not claim a publication date or reconstruct prior activity. **Clear session data**, OFF, navigation, pagehide/logout and observed account changes discard records and baseline and cancel pending reads. Identity is rechecked on refresh, focus/restoration and every 30 seconds only while a check is active; an account change cannot be detected before Sakai exposes it. Other Aether preferences and file history are unaffected. The source/request limits and deployment uncertainty are documented in the README.

## Local readers

Fonts, PDF.js, and Office readers are bundled with the extension. Office documents render in a separate extension-owned frame whose policy blocks network connections, forms, and child frames. External document media is blocked, links are inert, and Office macros are not executed. XLSX previews show stored formula results without evaluating formulas.

Previews are bounded to reduce accidental excessive processing:

| Content | Limit |
|---|---|
| PDF or image | 12 MB |
| Office file, archive, audio, or video | 32 MB |
| Text | 128 KB response; displayed excerpt up to 16,000 characters |
| Folder listing | 1 MB response; up to 12 displayed entries |
| Archive contents | 4,000 entries, 32 MB per expanded entry, 128 MB expanded total |
| PowerPoint | 600 slides |
| Excel | Up to 500 rows and 50 columns; hidden sheets, rows, and columns excluded |

Unsupported, encrypted, invalid, inaccessible, or oversized content retains **Open original**. These limits do not replace Sakai permissions or guarantee exact rendering of every document.

## Reports and development

Automated tests use fictional local fixtures and isolated browser profiles. They intercept LMS requests before reaching the university. Screenshots in the README also use fictional content.

When filing a public issue, remove real names, grades, student identifiers, private course materials, session cookies, and authentication tokens. See [SECURITY.md](SECURITY.md) for private security reporting.


## Spotlight (1.7)

Spotlight combines current native navigation, the existing authorized academic adapter snapshots and the Download Manager's discovered metadata in a bounded, memory-only index (up to 5,000 search entries; rendered results limited to 30). It stores no course names, materials, assignments, dates, grades, query text or result history in durable storage and adds no analytics, external service, permission or persistent search preference. Existing theme/motion commands use their existing settings. Explicit resource previews retain the existing hashed file-open-history behavior; document contents become search text only through the explicit v1.8 session opt-in or selected batch described below.

Typing does not perform discovery. Opening revalidates the existing session and collects already-visible metadata. Explicit academic checking shares the existing adapter job/cache; explicit broader resource search reuses the current tree/reader, capped at one available-site page when needed, eight root courses, 12 folder reads and two levels of expansion. File bodies are read only for the user's normal preview/open action or explicit content-indexing selection. Native access and separate copyright acknowledgment continue to apply.

The private index and cache clear on OFF, navigation/logout and observed identity changes, and in-flight discovery is cancelled. If the account changes, Spotlight requires refreshing the LMS tab so old DOM cannot be indexed under the new account. A changed or failed identity can be detected only when Sakai exposes it to the existing session helper; active discovery and an open palette revalidate during use. No new academic endpoint is enabled, including generic assignment lists whose release/group visibility is not established.

## Spotlight document contents (1.8)

Content indexing starts only after a selected batch is explicitly started or after session opt-in for deliberately opened supported documents. Hover previews never trigger indexing. The source is the existing discovered resource tree, not a new crawler. File reads retain the same-origin session and ResourceAccess copyright checks. Copyright-required files are skipped; an action opens the existing user-confirmed preview flow, and only successful authorized bytes are indexed afterward. No automatic acknowledgments.

Extraction uses bundled PDF.js/JSZip in a one-use extension helper with exact parent/source/origin/token validation. Text, locations, postings, reports and queries stay only in memory in this LMS document. No document text/search index/private history enters chrome.storage, localStorage, IndexedDB, logs, analytics, LLMs or external services. No new permission or remote dependency. Original preview history/settings retain their existing behavior and browser HTTP caching still applies.

One file is read/extracted at a time; 100 files/batch, 64 MiB total batch reads, PDF 12 MiB / Office 8 MiB / text 128 KiB, 30 seconds/file, 200,000 extracted characters/document, 400 chunks/document, 2,000,000 total indexed characters, 4,000 chunks and 100 documents. ZIP actual expanded sizes and XML parts are bounded; truncated coverage is labeled partial. OFF/logout/observed identity change/unavailable identity/pagehide clears text and opt-in and cancels jobs with late-result guards. Identity is checked at file boundaries and every 30 seconds while content state exists; changes cannot be detected before Sakai exposes them. After an account change, refresh the LMS tab. See [full format, limit and lifecycle details](docs/FULL_TEXT_SEARCH.md).
