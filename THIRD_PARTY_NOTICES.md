# Third-party notices

All runtime assets are locally packaged. License texts remain beside their assets.

| Asset | Source | License notice |
|---|---|---|
| Doto variable font, including ROND roundness | [Doto](https://github.com/oliverlalan/Doto), via [Google Fonts](https://github.com/google/fonts/tree/main/ofl/doto) | SIL OFL 1.1, `fonts/doto-OFL.txt` |
| Oswald variable font | [Oswald](https://github.com/googlefonts/OswaldFont), via [Google Fonts](https://github.com/google/fonts/tree/main/ofl/oswald) | SIL OFL 1.1, `fonts/oswald-OFL.txt` |
| Space Grotesk variable font | [Space Grotesk](https://github.com/floriankarsten/space-grotesk), via [Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) | SIL OFL 1.1, `fonts/spacegrotesk-OFL.txt` |
| Lato Regular/Bold | Unchanged v0.8.1 assets | SIL OFL 1.1, `fonts/OFL.txt` |
| PDF.js 5.6.205 and worker | Unchanged v0.8.1 assets; [Mozilla PDF.js](https://github.com/mozilla/pdf.js) | Apache 2.0, `vendor/pdfjs/LICENSE` |
| PDF.js character maps, fonts and decoders | Unchanged v0.8.1 assets | Notices in `vendor/pdfjs/cmaps/`, `standard_fonts/` and `wasm/` |
| Playwright 1.64.1 | [Microsoft Playwright](https://github.com/microsoft/playwright) | Apache 2.0; development only, excluded from release |
| PPTX renderer 1.4.0 | [aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer) | Apache 2.0; `vendor/office/pptx-renderer/LICENSE` and preserved notices |
| ECharts 6.0.0 and zrender 6.0.0, bundled in the PPTX renderer | [Apache ECharts](https://github.com/apache/echarts), [zrender](https://github.com/ecomfe/zrender) | Apache 2.0 / BSD 3-Clause; `vendor/office/pptx-renderer/licenses/echarts-LICENSE`, `echarts-NOTICE`, `zrender-LICENSE` |
| mtx-decompressor 1.4.2, bundled unchanged in the PPTX renderer | [Source v1.4.2](https://github.com/ChristopherVR/mtx-decompressor/tree/v1.4.2) | MPL 2.0; license and source availability in `vendor/office/pptx-renderer/THIRD_PARTY_NOTICES.md` |
| Generated ECMA DrawingML geometry subset | [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/) | Preserved ECMA notice and source manifest under `vendor/office/pptx-renderer/` |
| docx-preview 0.4.1 | [docxjs](https://github.com/VolodymyrBaydalka/docxjs) | Apache 2.0; `vendor/office/docx-preview/LICENSE` |
| ExcelJS 4.4.0 | [ExcelJS](https://github.com/exceljs/exceljs) | MIT; `vendor/office/exceljs/LICENSE` |
| JSZip 3.10.1 | [JSZip](https://github.com/Stuk/jszip) | MIT option of the dual MIT/GPL license; full notice in `vendor/office/jszip/LICENSE.markdown` |
| PptxGenJS 4.0.1 | [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | MIT; development fixture generation only, excluded from the release |

Segoe UI is an installed-system font fallback; no Microsoft fonts are redistributed. Graphics use native browser APIs without Three.js, Lenis or D3 runtime dependencies. No racing-reference branding, photographs or models are included.

Office runtime bundles are preserved without source modifications. `vendor/office/provenance.json` records pinned npm package integrity, per-file hashes and supplemental license sources. All viewers are packaged locally; academic files are not sent to a third-party conversion service.
