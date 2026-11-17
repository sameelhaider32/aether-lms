# Live DOM audit: Aether Minimal on the LUMS Sakai portal

Read-only audit, 2026-11-17, Aether 2.1.0, Minimal selected, Aether ON.
Structure only: tags, ids, classes, nesting, frame layout, computed layout.
No names, grades, titles, file names or screenshots are recorded here.
Ids that embed site/tool UUIDs are written as `<id>`.

Viewport during audit: 1536 x 730 CSS px. Root font size is 14px, so Sakai's
rem-based variables resolve as: `--portal-header-height: 4.5rem` = 63px,
`--portal-nav-sidebar-width: 22rem` = 308px. (At a larger root size the same
22rem is the ~385px gutter seen at ~1910px.)

## 1. Portal shell (all pages)

```
html.Mrphs-html.sakaiUserTheme-dark.aether-enabled.aether-paint-ready[data-aether-theme=minimal]
body.Mrphs-portalBody.overflow-hidden                      (body does not scroll)
  div#pageBody.Mrphs-portalWrapper.vh-100.portal-container (display:grid)
    div.portal-pasystem                                    grid-area paBanner
    nav#skipNav.Mrphs-skipNav                              grid-area jumpLinks
    header.portal-header.d-flex.align-items-center.justify-content-between   grid-area header
      [nav#aether-minimal-nav.am-nav]                      (Aether, prepended)
      div.d-flex.align-items-center.h-100.ms-3.ms-md-0.w-100
        div#logoWrapper.portal-header-logo
          button#sidebar-collapse-button.btn.icon-button.btn-sidebar-collapse.portal-header-hamburger-button
          a.btn.btn-logo
        div.portal-header-breadcrumb.portal-header-breadcrumb-mobile.w-100
          div#header-site-title.portal-header-breadcrumb-item.portal-header-site-title > a
          div.bi.bi-chevron-right.portal-header-breadcrumb-separator
          div.portal-header-breadcrumb-item.header-tool-title > a
          a.Mrphs-hierarchy-item.manage-overview-link.d-none.d-lg-block   (overview pages only)
      a.sak-sysInd-systemAlerts.nav-link.d-none
      ul#sakai-system-indicators.nav.flex-nowrap.align-items-center.me-3
        li.d-none.d-md-inline > a.sak-sysInd-help.desktop-help-icon > button.btn.icon-button > span.bi.bi-question-circle
        li.d-none.d-md-inline > button.btn.icon-button > span.bi.bi-grid-3x3-gap-fill      (sites grid)
        li.d-none.d-md-inline > button.btn.icon-button > span.si.si-calendar               (calendar)
        li.d-none.d-md-inline > button.portal-notifications-button.btn.icon-button
             > span.portal-notifications-icon.bi.bi-bell + span.portal-notifications-indicator
        li > button.btn.icon-button.sak-sysInd-account > img.sakai-accountProfileImage     (account)
      [button#aether-native-toggle] [label#aether-theme-control > select#aether-theme-select] [button#aether-spotlight-trigger]
    sakai-picture-changer > div#profile-image-upload.modal
    div#select-site-sidebar.offcanvas.offcanvas-end        (sites grid panel)
    aside#portal-nav-sidebar.portal-nav-sidebar.overflow-auto.portal-nav-sidebar-desktop   grid-area sidebar
      div.offcanvas-header.d-md-none
      nav#toolMenu.Mrphs-toolsNav__menu.sakai-sitesAndToolsNav.h-100.d-flex.flex-column
      div.sticky-footer
    div.portal-main-container.container-fluid.pt-4         grid-area mainContainer, overflow:auto (the scroller)
      main#content.portal-main-content[.Mrphs-multipleTools].px-3
      footer.portal-footer
      div#Mrphs-footerApp
      button.jump-to-top
    aside#sakai-notifications-panel.offcanvas.offcanvas-end
    aside#sakai-calendar-panel.offcanvas.offcanvas-end
    aside#sakai-account-panel.offcanvas.offcanvas-end      (account menu, holds logout)
    nav.portal-mobilebar.d-flex.d-md-none                  grid-area mobilebar (<768px)
```

Native grid rules (Sakai stylesheet):

```
.portal-container { display:grid; grid-template-columns:1fr;
  grid-template-rows:auto auto var(--portal-header-height) 1fr var(--portal-header-height);
  grid-template-areas:"paBanner" "jumpLinks" "header" "mainContainer" "mobilebar" }
@media (min-width:768px) {
  .portal-container { grid-template-columns:var(--portal-nav-sidebar-width) 1fr;
    grid-template-rows:auto auto var(--portal-header-height) 1fr;
    grid-template-areas:"paBanner paBanner" "jumpLinks jumpLinks" "header header" "sidebar mainContainer" }
  .portal-container.sidebar-collapsed { grid-template-areas: ... "mainContainer mainContainer" }
  #portal-nav-sidebar.sidebar-collapsed { display:none }
}
.portal-header { height:var(--portal-header-height); grid-area:header; border-bottom:3px solid ... }
```

### Sidebar navigation (`#toolMenu`)

```
nav#toolMenu
  h2#totoolmenu.visually-hidden
  div#sites-section-first.sites-section > ul.mb-0
    li#site-list-home-item<id>.site-list-item[.is-current-site]
      div.site-list-item-head > div.site-link-block > button.btn.icon-button + a.sidebar-site-title
      div#home-sit<id>page-list.site-list-item-collapse.collapse[.show]
        ul.site-page-list.nav.flex-column > li.nav-item > a.btn.btn-nav[.selected-page]
  div.sites-section.pinned-site-section
    h3.sites-section-heading
    ul#pinned-site-list > li#site-list-pinned-item<id>.site-list-item   (same inner shape,
        plus button.site-opt-pin in the head: a write control, never clicked)
```

Current tool is marked by `a.selected-page`; current site by `li.is-current-site`.

## 2. Pages

| Page | URL shape | `main#content` children | Tool markup | Frames |
|---|---|---|---|---|
| Home | `/portal` | `#aether-workspace`, `h1#tocontent`, a second hidden `.portal-header-breadcrumb`, `div.row` of portlets | `div.Mrphs-container.Mrphs-sakai-*` > `nav.Mrphs-toolTitleNav` + `div.Mrphs-toolBody.Mrphs-toolBody--sakai-*` | 4 x `iframe.portletMainIframe` (`/portal/tool/<id>`) + 1 static info iframe, all same-origin |
| Course Overview | `/portal/site/<id>` | same, `div.row > div#col1of2.col-lg-6 + div#col2of2.col-lg-6` | col1: `.Mrphs-container.Mrphs-sakai-iframe-site` > `.Mrphs-toolTitleNav` + `.Mrphs-toolBody > div.portletBody.siteDescription` (inline, no frame). col2: synoptic announcement, summary calendar, synoptic messagecenter | 3 x `iframe.portletMainIframe`, same-origin |
| Resources | `/portal/site/<id>/tool/<id>` | `div#col1.Mrphs-pageColumns.Mrphs-pageColumns--single` | `div.Mrphs-container.Mrphs-sakai-resources` > `nav.Mrphs-toolTitleNav` + `div.portletBody.specialLink` > `ul#contentMenu.navIntraTool.actionToolBar`, `div.page-header`, `form#showForm` > `ol.breadcrumb`, `table.table.table-striped.table-hover.resourcesList` | none (inline) |
| Gradebook | `/portal/site/<id>/tool/<id>/gradebook` | `div#col1.Mrphs-pageColumns--single` | `div.Mrphs-container.Mrphs-sakai-gradebookng` > `.Mrphs-toolTitleNav` + `div.portletBody > div#studentGradeSummary > div.gb-summary-grade-panel > table#gradeSummaryTable.table.table-bordered.table-striped.table-hover > tbody.gb-summary-assignments-tbody > tr.gb-summary-grade-row.gb-no-categories` | none (inline) |
| Assignments list | `/portal/site/<id>/tool/<id>` | `div#col1.Mrphs-pageColumns--single` | `div.Mrphs-container.Mrphs-sakai-assignment-grades` > `.Mrphs-toolTitleNav` + `div.portletBody.container-fluid > div.page-header, div.sakai-table-toolBar, form > div.table > table.table.table-hover.table-striped.table-bordered` | none (inline) |

Frame documents: `html.Mrphs-html.sakaiUserTheme-dark[data-aether-theme=minimal]`,
`body.Mrphs-container[.Mrphs-sakai-*]`. They carry the theme dataset but none of
`aether-enabled`, `ae-resource-surface`, `ae-academic-surface`. Computed body
background is Sakai's dark theme colour.

Top-document state classes observed: Resources adds `ae-page-resources`;
Gradebook adds `ae-academic-surface`; Assignments adds neither.

## 3. Minimal selectors: hit or miss

| Selector | Result on live |
|---|---|
| `.portal-header`, `.portal-main-container`, `main#content` | Hit |
| `#toolMenu`, `#portal-nav-sidebar` hidden via `[data-am-navigation=ready]` | Hit (display:none), but the grid column they occupied is not released |
| `#toolMenu .is-current-site .site-page-list a[href]` | Hit (15 links on the audited course) |
| `.portal-header .header-tool-title` | Hit, but it is a `div` wrapping an `a` inside `.portal-header-breadcrumb`, not a bare `span` |
| `.am-context` tool strip | Renders, `overflow:auto`, scrollWidth 1663 > clientWidth 1488 |
| Any rule for `#pageBody` / `.portal-container` grid | Missing |
| Any rule for `#logoWrapper`, `#sidebar-collapse-button`, `.portal-header-breadcrumb`, `#sakai-system-indicators`, `.manage-overview-link` | Missing |
| Any rule for `.Mrphs-container`, `.Mrphs-toolTitleNav`, `.Mrphs-toolBody`, `.portletBody` | Missing |
| Any rule reaching generic frame documents (`html[data-aether-theme=minimal]` without a surface class) | Missing |
| Any override of `html.sakaiUserTheme-dark` variables | Missing |

## 4. Computed causes of the visible defects

1. Left gutter. `#pageBody` keeps `grid-template-columns: 308px 1228px` and
   areas `"sidebar mainContainer"`. Minimal sets `display:none` on the sidebar
   but does not change the grid, so `.portal-main-container` still starts at
   x=308 (22rem). Minimal's `margin-left:0` on the container has no effect.
2. Native header showing under the Aether bar, and floating controls. The
   grid row for the header is fixed at 63px and `.portal-header` has
   `height:63px`. Minimal adds `flex-wrap:wrap` and prepends `.am-nav`
   (`flex:1 1 560px`, 1488px wide). The native children then wrap to a second
   flex line (logo, hamburger, breadcrumb at y=54) and a third (system
   indicators, Aether toggle, theme select, Spotlight at y=106..112), all
   overflowing the 63px box and painting over `main#content`.
   - `#aether-native-toggle` has `position:relative; z-index:15`, so it shows on top.
   - `#aether-theme-control` is `position:static; z-index:auto`; the hero card
     paints over it (elementFromPoint returns `.ae-hero`), so it is invisible.
   - `#aether-spotlight-trigger` has an opaque background and lands over the calendar header.
3. Course tool strip. `.am-context` is `flex-basis:100%; overflow:auto` with 15
   links, hence the horizontal scrollbar (unstyled, dark because of
   `sakaiUserTheme-dark`). The "connector lines" are not drawn by the pills:
   they are the header's own `border-bottom` at y=63, which crosses the strip
   because the strip overflows the 63px header. The title `strong` has
   `white-space:normal; max-width:280px` and wraps to two lines (39px).
4. Native panels. `.Mrphs-container` computes to a flat `--ae-tone-024` gray
   with no border or radius under Minimal. Frames stay on Sakai dark.
5. Calendar. `.am-calendar .am-has-events{border-color:#222}` draws a full box.
6. Greeting card. `.ae-hero` is 190px for about 130px of content: older hero
   min-height/padding rules still apply to `.ae-hero-copy` on the home hero.

## 5. Fixture vs live mismatches (tests/fixtures.cjs)

| Area | Fixture | Live |
|---|---|---|
| `#pageBody` | plain block, no grid | CSS grid with named areas and fixed header row |
| Header | `header.portal-header` with two bare `span`s, `height:auto` | fixed-height flex header with logo wrapper, hamburger, breadcrumb, system-indicator list |
| System controls | none | help, sites grid, calendar, notifications, account buttons + 4 offcanvas panels |
| Sidebar | `nav#toolMenu` directly inside `.portal-main-container`, flex sibling of `main` | `aside#portal-nav-sidebar > nav#toolMenu`, a grid item of `#pageBody`, sibling of `.portal-main-container` |
| Site list | `li.site-list-item > a.sidebar-site-title + ul.site-page-list` | extra `.site-list-item-head`, `.site-link-block`, collapse wrapper, pin button; sections `#sites-section-first` and `.pinned-site-section` |
| Current tool marker | none | `a.btn.btn-nav.selected-page` |
| Tool count | 6 | 15 on the audited course |
| Scrolling | document scrolls | `body.overflow-hidden`; `.portal-main-container` scrolls |
| Tool container | `div.Mrphs-container > div.Mrphs-toolBody > div.Mrphs-sakai-*` | `div.Mrphs-container.Mrphs-sakai-*` > `nav.Mrphs-toolTitleNav` + `.Mrphs-toolBody` / `.portletBody`, inside `#col1.Mrphs-pageColumns` or `div.row > #col1of2/#col2of2` |
| Overview page | one inline block | two-column `div.row` with inline site description and three framed portlets |
| Frames | only in dedicated "frame" routes, light | `iframe.portletMainIframe` portlets on Home and Overview, `sakaiUserTheme-dark` |
| User theme class | none | `html.sakaiUserTheme-dark` in the top document and every frame |
| Second breadcrumb | none | hidden duplicate `.portal-header-breadcrumb` inside `main#content` |
| Mobile | CSS-only reflow of `#toolMenu` | `nav.portal-mobilebar` and offcanvas sidebar below 768px |

Other observation: `manifest.json` lists `src/minimal.css` and `src/minimal.js`
twice in each array. Harmless (the script guards on `globalThis.AetherMinimal`)
but it should be de-duplicated.
