# Aether LMS

A cleaner, calmer interface for **LUMS Sakai**. Aether is a free, open-source Chrome extension that adds course cards, document previews, and a glowing starfield to your existing LMS.

**Current version: 1.3.0 · Public beta · MIT licensed**

[![Checks](https://github.com/sameelhaider32/aether-lms/actions/workflows/ci.yml/badge.svg)](https://github.com/sameelhaider32/aether-lms/actions/workflows/ci.yml)
[![Security](https://github.com/sameelhaider32/aether-lms/actions/workflows/security.yml/badge.svg)](https://github.com/sameelhaider32/aether-lms/actions/workflows/security.yml)

Works on [lms.lums.edu.pk](https://lms.lums.edu.pk). This is an independent project, unaffiliated with LUMS or the Sakai project.

![Aether Home with course cards, stars, and the folded particle field](docs/images/home.png)

*Screenshot uses fictional courses and test content.*

## Install in five steps

1. On this GitHub repository, select **Code → Download ZIP**.
2. Extract the ZIP into a folder you intend to keep.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Select **Load unpacked**, then choose the extracted folder containing `manifest.json`.
5. Open or refresh your LUMS LMS tab. Sign in normally.

No build, terminal commands, or separate account needed. Keep the extracted folder: Chrome loads the extension from that location.

To update, back up your current folder, replace its contents with the new version, select **Reload** on Aether's extension card, and refresh your LMS tabs. Keep the same folder location and only one Aether installation enabled to retain your saved preferences.

## Features

| Area | What Aether adds |
|---|---|
| Home | A redesigned workspace with course cards, course shortcuts, and links to activity found on the current page. |
| Navigation | Reorder course and tool shortcuts with drag-and-drop or keyboard buttons; your order is saved locally. |
| Appearance | Dark panels, mint and cyan accents, bundled fonts, page-wide stars, glowing sparkles, pointer glow, and contour lines. |
| Folded field | A procedural 3D particle sculpture with progressive startup and a Canvas fallback when WebGL is unavailable. |
| Resources | Cards for student, TA, and instructor browsing views, including supported management lists and embedded Sakai tools. |
| Native resource controls | Original file and folder links, action menus, selection checkboxes, sorting, pagination, and permitted add/upload/delete controls remain available. Editing fields retain their native layout. |
| Assignments | Clearer cards and status labels for confirmed submissions and deadlines. Ambiguous dates or unknown submission states are treated conservatively. |
| Gradebook | Cards for read-only grade summaries, including scores, feedback, and release states. Editable grade grids and comparison tables keep their layout with matching styling. |
| Roster | Matching cards, photo views, and tables, retaining permitted profile details, groups, search, sorting, and pagination. |
| Other lists | Recognized announcement and activity lists receive matching styling where supported. |
| File previews | Read supported files inside the LMS without sending them to an external conversion service. See the formats below. |
| Copyright notices | Read the native notice in the preview and choose **Yes, accept and preview** to continue in the same panel. Acceptance requires your click. |
| Hover behavior | Hover briefly to preview; moving away from both the resource and panel closes it immediately. Select **Preview** to keep a reader open. |
| Accessibility | Keyboard controls, visible focus, Escape to close previews, responsive layouts, and support for your system's reduced-motion preference. |
| Your choice | **AETHER ON/OFF** restores the original Sakai layout. **MOTION ON/OFF** controls animation separately and saves your preference. |

Native authentication, access permissions, forms, and actions remain in Sakai. Aether does not grant access to hidden grades or restricted files. The Home activity panel uses only the current page; its decorative graphic does not measure grades, progress, or deadlines.

## Preview formats

Hover over a resource or select **Preview**. Use **Open original** whenever you need the native file or application.

| Format | Preview |
|---|---|
| PDF | Pages with Previous/Next buttons and arrow-key navigation. |
| PowerPoint `.pptx` | Static slides with text, shapes, embedded images, tables, supported charts, and slide navigation. |
| Word `.docx` | Scrollable document with text, tables, and supported layout. |
| Excel `.xlsx` | Visible worksheet selector, cell values, and stored formula results. Formulas are not recalculated. |
| Images | Common browser-supported images, including PNG, JPEG, GIF, WebP, BMP, and AVIF. |
| Text and code | Plain-text excerpts, including source code, CSV, and JSON. Content is displayed without executing it. |
| Audio and video | Browser-supported playback controls; codec support depends on Chrome. |
| ZIP archives | File names and sizes inside the archive. |
| Folders | A short read-only listing, with the native folder link available. |

Office previews are readers, with no document editing, macros, or slide animations. Advanced effects and formatting may differ from Microsoft Office. Legacy binary formats such as `.ppt`, `.doc`, and `.xls`, encrypted documents, unsupported codecs, and files blocked by site policy use **Open original**.

Preview limits are 12 MB for PDFs/images, 32 MB for Office files/archives/media, 128 KB for text, and 1 MB for folder responses. Large text is excerpted. Spreadsheet previews show up to 500 rows and 50 columns, excluding hidden content; slides are limited to 600. Archive expansion is bounded. Details are in [Privacy and file handling](PRIVACY.md).

## Privacy and permissions

The extension requests `storage` to remember preferences and runs only on `https://lms.lums.edu.pk/*`. It reads the LMS page and fetches previews from that same LMS using your existing signed-in session. Preview files are cached temporarily in memory; Chrome may also apply its normal HTTP cache.

Fonts and readers are bundled locally. There are no analytics, external document uploads, or cloud conversion services. See [PRIVACY.md](PRIVACY.md) for details.

## Compatibility and testing

The v1.3.0 release passed **142 browser checks and 11 unit/security checks** in Chromium 149 on Windows using fictional, intercepted Sakai fixtures. Coverage includes student and TA resources, previews, copyright consent, forms, Gradebook, Roster, toggles, graphics fallbacks, and widths from 360 to 1920 pixels.

**Live authenticated LUMS compatibility has not been independently verified.** Custom Sakai tools, permissions, and security policies can vary. Treat this as a public beta and report problems using fictional or redacted examples. If a page looks wrong, switch Aether off to use the native layout.

## Contributing

The extension runs directly from source. Development tests use Node.js, Python 3, and Playwright. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, packaging, and the source layout. See [CHANGELOG.md](CHANGELOG.md) for release history and [SECURITY.md](SECURITY.md) for reporting security issues.

Contributions go through pull requests, automated Windows/Linux browser regressions, package checks, dependency review, and security analysis before merging. Updates are reviewed by the maintainer; passing tests do not automatically publish or merge changes.

## License

Aether's first-party code is available under the [MIT License](LICENSE). Bundled libraries and fonts retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
