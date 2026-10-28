# Spotlight document contents (v1.8)

The retained v1.7 Spotlight palette now has an additive **Contents** category and **Index document contents** action. Original/Monochrome, existing fonts, Home, sidebar, graphics, motion controls, cards and native academic workflows are retained. This branch builds on `codex/spotlight` / PR #14, which builds on the Monochrome PR #12; it does not include rejected spatial PR #13.

## Use

Reload Aether in `chrome://extensions`, refresh the LMS tab, open Spotlight, then choose **Index document contents**. Choose a course/folder scope or available documents across courses, select files and press **Start indexing**. Nothing is selected automatically. The selector uses the Download Manager's already-discovered tree; **Search more available resources** performs only the existing bounded metadata discovery. Refresh the discovered list afterward. Discovery coverage and selection counts are explicitly partial. The list displays at most 300 files per chosen scope and 200 discovered folder filters; course filters narrow larger lists. At most 3,000 discovered resource descriptors are offered by Spotlight.

Progress distinguishes processed files from successfully indexed documents and includes per-file outcomes and **Cancel indexing**. Already indexed documents survive cancellation; refresh/OFF/logout/session change clears everything. Explicitly retry a batch to replace old text. Copyright-required files are skipped: **Handle notice in preview** opens the existing consent flow. Only **Yes, accept and preview**, followed by a successful authorized read, can index that selected file. No batch automatically acknowledges a notice.

The session checkbox or the footer of a deliberately opened supported preview offers **Include opened documents in Spotlight**. Once opted in, subsequent deliberate supported previews/original opens are eligible. Hover never indexes or opts in. A successful pinned preview reuses its existing downloaded bytes, including a previously hovered preview that is then deliberately pinned. Original clicks are never delayed/intercepted for indexing; navigation away may cancel indexing, so Preview is the reliable route. Switching off that checkbox stops automatic opened-document jobs without clearing explicit batch results. **Clear indexed contents** clears text and the opt-in.

Search a phrase or multiple words, optionally in **Contents**. Each document has one result with its strongest safe text-node/mark excerpt, location and number of matching passages (not an exact occurrence count; overlapping chunks can match). Exact normalized phrases outrank nearby/scattered terms; exact/title-containing metadata remains prominent. The content inverted index is separate from Spotlight's metadata/fuzzy ranker. All/Files combine and deduplicate metadata/content results. Queries do not fetch. A no-match result means no match among the indexed subset, not no such document in the LMS. Empty Contents queries do not browse all stored passages.

**Preview** or Alt+Enter uses the existing authenticated reader. **Open original** or Enter preserves native destinations/handlers. The identified page/slide/cell/line is shown in the result; readers open normally, without new deep-link behavior.

## Extraction and boundaries

- **PDF:** bundled PDF.js text-content streams, page references, no canvas or OCR. Blank/image-only PDFs report no extractable text. Password-protected, corrupt and unsupported files fail gracefully.
- **DOCX:** main-document paragraphs and table text, paragraph references. Direct hidden runs/deleted runs are excluded; no altChunks, headers/footnotes/comments or active embeds.
- **PPTX:** slide order from presentation relationships; visible slide paragraphs, shapes and tables with original slide numbering. Hidden slides/shapes, notes, masters, chart/SmartArt internals and embeds are excluded.
- **XLSX:** visible sheets, rows and columns, matching the reader's first 500 rows / 50 columns. Rich/shared/inline text and cached numeric/boolean/string/formula results have sheet/cell references. Missing formula results are omitted and coverage labeled partial; formulas are never evaluated. Numeric/date values may be raw stored values rather than formatted display strings.
- **Plain text:** UTF-8 or BOM-marked UTF-16, line references. TXT, MD/Markdown, CSV, JSON, LOG, PY, JS/TS/JSX/TSX, JAVA, C/CPP/H/HPP, CSS, HTML, XML, YAML/YML, SQL, SH, R, RB, GO, RS, IPYNB. Markup/code stays inert; source/notebook files are raw text. Unsupported binary encodings fail safely.

Course resource descriptors must pass the existing canonical same-origin `/access/content/group/...` validator. Unsupported/private user-area/external references retain their original preview/navigation behavior but are not indexed. Extraction covers supported structures, not a promise of complete visual document semantics. Phrases must occur inside an indexed passage/location, not across pages/slides/cells or separate paragraphs/lines. Legacy DOC/PPT/XLS, encrypted Office, audio/video/images/transcription and OCR are unsupported.

## Actual bounds

| Item | Limit |
|---|---|
| Concurrency | 1 read/extraction across opened-document and explicit batch jobs |
| Batch / session documents | 100 selected files per batch; 100 indexed documents per session |
| Batch body bytes | 64 MiB, including failed/copyright reads; streaming abort at boundary (one network chunk can cross it) |
| Per file | PDF 12 MiB; OOXML 8 MiB; text 128 KiB, all at/below preview ceilings |
| Timeout | 30 seconds per file read plus extraction; helper also has its own 30-second fail-safe |
| Queued reused bytes | 24 MiB; excess previews report busy and need an explicit retry |
| Extracted text | 200,000 characters / 2,000 location units per document |
| Search chunks | Up to 400/document; 800 characters, 200-character overlap within a location |
| Total text index | 2,000,000 characters including overlap; 4,000 chunks; bounded postings/descriptors |
| PDF / PPTX | First 150 pages / slide positions, then **Partially indexed** |
| Office ZIP | Existing archive guard plus 1,500 entries, 8 MiB expanded/entry, 64 MiB expanded total, 2 MiB per relevant XML part |
| UI results | 30 combined document/metadata results |

The lower Office byte/archive ceilings reserve memory for parsing and protect UI responsiveness. PDF text is streamed and pages processed individually. Office decompression verifies actual output sizes, even for unused media, before reading retained XML; declared central-directory sizes alone are insufficient. XML rejects DTD/entities, does not follow external relationships, and yields between archive entries/slides/worksheet rows. No worksheet dimension expansion. Truncation, missing cached formula results or bounds produce **Partially indexed**, never complete-coverage claims. If the index is full before any chunks fit, the file reports the limit and is not counted successful.

## Privacy and architecture

`src/spotlight-content.js` separates descriptors, validated ResourceAccess reads, helper lifecycle, chunking/postings/ranking and session jobs. `src/spotlight-content-ui.js` owns selection/progress. `preview/content.html` / `content-extract.js` are one-use extension helpers using only packaged PDF.js/JSZip and inert XML/plain text; no preview rendering pipeline is copied. The parent and helper validate exact source window, LMS/extension origins, random token, message type and bounded ArrayBuffer/result shapes. The helper accepts bytes only, not arbitrary resource URLs, and web accessibility remains restricted to the LMS origin. Removing it on cancellation/timeout releases the parser/PDF worker.

Text, postings, descriptors, reports, queries and opt-in are memory-only. No new storage writes, IndexedDB, telemetry, external services, remote dependencies or Chrome permissions. Existing preview file-history hashes/timestamps and appearance preferences retain their existing behavior; normal browser network caching still applies. The existing same-origin ResourceAccess logic retains manual redirects, authorized session cookies and exact-resource copyright validation. A 401/login page clears contents; a 403 is a per-file permission outcome. OFF, logout/login DOM, observed identity change, unavailable identity or document/pagehide clears and aborts pending work with epoch guards against late results. The existing changed-account lock requires a page refresh. The authoritative session helper is rechecked at file boundaries, focus/restoration and every 30 seconds while content state exists; changes cannot be detected before Sakai exposes them.

## Focused verification

`npm run test:contents` / `node tests/spotlight-content.cjs`: a real unpacked extension, isolated fresh Chromium profile, fictional intercepted GETs only. Covers PDF page references, DOCX paragraphs/table, PPTX visible/hidden slides, XLSX stored values/cell and hidden sheet/row/column exclusion, TXT/CSV/source text, fictional phrase snippets, safe highlights/deduplication, unsupported/scanned/encrypted/corrupt/oversized/expanded ZIP and malicious XML, copyright/403 skips and explicit preview acceptance, cancellation, no hover indexing, reused preview bytes, OFF/identity clearing, no durable private text/IndexedDB or external traffic, keyboard and both themes/narrow viewport. The small checked-in encrypted PDF contains only a blank page and the fixture password `fixture-only-password` (generated locally with pypdf); other documents reuse fictional Office fixtures/JSZip and a tiny local PDF fixture generator. No new test dependency.

The existing `node tests/spotlight.cjs` focused smoke also passed for retained filename/course/tool/academic navigation, frame entry/focus, native form/assessment shortcut guards, shared discovery, session isolation and theme behavior. No full local suite, stress run, packaging or live academic material/action was used. Authenticated deployment-specific variations remain unverified. Existing repository CI may run its normal checks after push.
