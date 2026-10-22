# Contributing to Aether LMS

Bug reports, accessibility improvements, Sakai layout fixes, and small focused pull requests are welcome. Describe what happened, what you expected, your Aether/Chrome versions, and whether the issue occurs with Aether switched off. Share fictional or redacted examples instead of private academic data. Report security issues using [SECURITY.md](SECURITY.md).

## Run from source

Load the repository folder containing `manifest.json` through Chrome's **Load unpacked** control. No build step is required. After editing, reload the extension and refresh the LMS tab.

## Test

Install a current supported Node.js release with npm, plus Python 3. From the repository root:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Dependencies are pinned through `package-lock.json`. Use `npm ci --ignore-scripts` to install the reviewed dependency tree. Intentional dependency updates must include the updated lockfile.

The development-only PowerPoint generator's `image-size` dependency is overridden to patched version 2.0.4 to address its parser denial-of-service advisories. CI regenerates the fictional Office fixtures before running their preview regressions, checking compatibility with this override. No extension runtime bundle is changed by this override.

- `npm run test:unit`: unit, parsing, archive-boundary, and bundled-reader integrity checks.
- `npm run test:startup`: deliberately delayed-page startup checks.
- `npm run test:browser`: main Chrome extension regressions, including tool frames and file previews.
- `node tests/fallbacks.cjs`: WebGL-disabled and cancellation checks.
- `node tests/browser.cjs --smoke`: package-oriented checks, including hover dismissal and role/document variants.
- `node tests/package.cjs`: verifies the built ZIP's hashes, unpacked bytes, licenses, permissions, and exclusion of development/private artifacts. Run the package builder first.

Tests use intercepted fictional Sakai pages and fresh browser profiles. They do not require a university account. Output goes into `reports/`; generated reports are excluded from source ZIP exports. Keep private LMS captures out of commits.

`AETHER_CHROMIUM` can select an existing compatible Chromium executable. `AETHER_EXTENSION` can select a different unpacked extension folder for the main and startup suites. `AETHER_REPORT_DIR` changes the main browser suite's report directory. Use the ordinary Playwright Chromium installation when these variables are unset.

The optional native-tab visibility probe is `AETHER_HEADFUL=1 node tests/fallbacks.cjs` in a shell that supports that syntax. Some automation hosts do not update `document.hidden` on tab changes; this probe is separate from the default passing suite.

Hosted CI sets `AETHER_SHARED_RUNNER=1` for startup checks: visuals must appear within 150 ms of workspace creation and before the deliberately delayed DOMContentLoaded event. Whole-navigation timings are recorded in `first-load-timing.json`, but the 1.5-second absolute budget is not enforced on shared VMs with variable cold-browser startup. Local startup tests retain that absolute budget by default. This is a functional CI check, not a controlled hardware performance benchmark.

Checked-in PPTX, DOCX, XLSX, ZIP, and audio fixtures contain fictional content. Regenerate them with `node tests/generate-office.cjs` after installing development dependencies.

## Source layout

| Location | Responsibility |
|---|---|
| `src/prepaint.js`, `content.js`, `dashboard.js` | Early preferences, native page extraction, workspace, shortcuts, on-page activity. |
| `src/scene.js`, `ambient.js`, `motion.js` | Folded field, stars, contours, animation scheduling, fallbacks. |
| `src/classifier.js`, `lists.js`, `assignment-state.js` | Reversible native record styling and conservative assignment states. |
| `src/resource-info.js`, `resource-access.js`, `resource-preview.js` | File descriptors, same-origin reads, copyright consent, preview lifecycle. |
| `preview/` | Local PDF/Office readers and archive bounds. |
| `vendor/`, `fonts/` | Bundled assets, licenses, and Office provenance. |
| `tests/` | Fictional Sakai fixtures and regression suites. |
| `docs/`, `CHANGELOG.md` | Design decisions and historical release notes. |

Preserve native nodes, handlers, values, authentication, and permissions. Keep document conversion local. Exercise Aether OFF, keyboard navigation, supported role differences, same-origin frames, cancellation, and narrow layouts when changing UI behavior. Editable or unsupported structures should retain usable native layouts.

## Package a release

```sh
python scripts/package.py
```

This uses Python's standard library and creates an unpacked extension, installable ZIP, and SHA-256 hashes in `dist/`. Use `--out PATH` for another output directory. Ordering, timestamps, and text line endings are normalized. Development dependencies, tests, reports, and Git metadata are excluded from the installable ZIP.

To test that package, set `AETHER_EXTENSION` to its unpacked folder and run `node tests/browser.cjs --smoke`.

To create a clean source ZIP from a committed revision:

```sh
git archive --format=zip --prefix=aether-lms/ --output=aether-lms-source.zip HEAD
```

The export omits generated reports through `.gitattributes`. A source ZIP is a snapshot; it does not include Git history. Historical reports in the original development repository record fixture results and do not establish compatibility with every live LUMS customization.

Keep dependency licenses and provenance intact. First-party contributions are under the project's [MIT License](LICENSE).

## How changes reach main

Open a pull request from a feature branch. GitHub runs the full suite on Windows and Linux, builds the extension, checks the ZIP, and tests the unpacked release in Chromium. It also reviews dependency changes and runs CodeQL security analysis. Failed checks block merging. Screenshots and test results are retained as short-lived Actions artifacts; they contain fictional fixtures only.

The maintainer decides which contributions to merge. CODEOWNERS requests review from `@sameelhaider32`. Because this is a sole-maintainer repository, no second reviewer is mandatory for the owner's own pull requests. Passing tests do not automatically merge a contribution. Main disallows force-pushes and deletion, and its required checks also apply to the owner.

For each behavior change, reproduce the bug or new use case in a fictional fixture, add a focused assertion, and run the relevant checks locally before opening the pull request. UI changes should cover both student and management views where relevant, keyboard use, tool frames, Aether OFF, and narrow screens. Include permission failures, malformed inputs, and cancellation for preview changes. Existing tests catch regressions in covered behavior; they do not create tests for new features automatically or prove live LUMS compatibility.

Dependabot opens weekly update pull requests for npm development dependencies and pinned workflow actions. Dependency review blocks newly introduced high/critical advisories. Bundled runtime libraries in `vendor/` are not automatically upgraded by these npm updates: maintainers must review their upstream security advisories, update local bundles and notices/provenance together, and exercise the format regressions. CodeQL scans first-party `src/` and `preview/`, rather than minified vendor code.

Outside contributors' workflow runs require maintainer approval. Review workflow changes before approving a run; CI never receives university credentials or document samples. Workflows use pinned action commits, minimal permissions, and no automatic publishing. Read [SECURITY.md](SECURITY.md) for private reporting.
