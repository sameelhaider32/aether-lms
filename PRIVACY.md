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

Opened-file history is stored in `chrome.storage.local` on this device, with a limit of 1,000 file entries across accounts. Each entry contains a SHA-256 key incorporating a hash of the authoritative account ID and the LMS resource origin/path, an opened timestamp, and a hash of reliable version/modification metadata when available. Raw account identifiers, URLs, filenames, document contents, grades, and assignment statuses are not stored in this history. Hashes are pseudonymous local identifiers, not encryption. File-open history is not sent to Sakai or any external service.

Version 1.3.1 discards old unscoped opened-file entries because they cannot safely be associated with an account. It preserves appearance, motion and ordering preferences. Tabs and tool frames serialize history mutations with Web Locks; Clear waits for earlier writes and reports a storage failure instead of claiming success. If coordination is unavailable, history is disabled. Identity is checked for badge batches and deliberate opens, and on focus/restoration. Account changes close previews and clear their memory caches. A preview begun in one account cannot mark another account's history.

History begins when you use this feature; Aether cannot reconstruct earlier file opens. A successful explicit preview or deliberate original-file click records **Opened**. Hovering alone, automatic script clicks, and failed previews do not. **Opened** describes an action in this browser, not proof that a file was read. **Updated** requires a known change in native version/modification metadata; unavailable or ambiguous metadata is not treated as a new version. Select **Clear file history** in any preview footer to remove all opened-file entries. This does not clear your other preferences or delete LMS files. Access/preview failure indicators are temporary and are not persisted.

Preview content has a memory-only cache of up to six entries and 24 MB total. The browser can also apply its normal network caching. Aether does not create a separate persistent document library or account. Closing a preview or switching Aether off cancels pending reads. Native downloads remain controlled by Chrome and Sakai.

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
