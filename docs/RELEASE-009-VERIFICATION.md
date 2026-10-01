# Release 009 — Product UI Density & Visual Hierarchy

All final verification gates pass. The complete frozen-input unit run passed all 118 files and 1551 tests. The fresh independent GPT-6.1 Sol reviewer approves the final candidate with zero Critical and zero Important findings. The final Sheet and CommandDialog corrections are independently re-reviewed.

## Working state and accepted baseline

- Branch: `codex/release009-density`.
- Worktree: `/Users/amjedfadul/.codex/worktrees/release009-density/shadcn design system`.
- Git baseline: `74f06c7199f723ccc9b1dd7c3ae82d797558221f` plus the exact accepted, uncommitted Release 008 candidate from `/Users/amjedfadul/.codex/worktrees/release008-primitives/shadcn design system`.
- The original R8 checkout was preserved separately. All 660 retained source-file hashes still match the independently saved manifest (SHA256 `8870d97c98cc644c47e1a91909dc22c00636ac0bd8fe582bfe10b921199e0ef0`).
- R9 has no commit. No push, merge, publication or deployment occurred.

This is a separate refinement release. The retained R8 release record and candidate remain historical authorities; their meaning was not regenerated from R9 styling.

## Foundations

| Area | Final rule |
| --- | --- |
| Typography | Geist Variable; 12px metadata, 14px product UI, 16px grouped-object headings, 18–20px page/panel headings; controls/navigation/labels 500, content 400. Mobile text inputs preserve 16px type. |
| Spacing | Existing 4px unit, no added scale; icon/label gap 8px, compact internal gap 4px, field gap 8px, sections 16–24px. |
| Radius | Base 8px; sm 4px, md 6px, lg 8px, xl 12px; full radius unchanged. Existing eight radius identities retained. |
| Surfaces | Canvas/background → Subtle/muted/sidebar → Raised/card → Overlay/popover. Existing light/dark semantic color values retained. |
| Elevation | Inline controls, Table, Sidebar, Tabs, Card, Alert and Empty have no ordinary shadow; floating menus shadow-sm, modal surfaces shadow-md. |
| Sizes | 24px tiny, 28px compact navigation/menu, 32px normal control/table minimum row, 36px large/disclosure. Taller table content remains composable. |
| Focus | Touched families use a solid 2px semantic ring with 2px background offset; invalid focus retains a solid destructive ring. ScrollArea uses an inset ring to avoid viewport clipping. Accepted R8 Link keeps its existing 3px ring as part of exact primitive-source preservation. |
| State | Quiet neutral navigation/row selection and hover; primary communicates actions/links/focus and preserves R8 Toggle Group selection contrast. |
| Motion | 100ms color feedback, 150ms state, 200ms overlays, 300ms structure; reduced motion resolves to 0.01ms for component transitions/animations. |
| Overlays | 30% black backdrop, 16px normal padding, shared z50 content/backdrop with portal DOM ordering for nested modals. Dialog retains 512px desktop width; Sheet uses 480px desktop width and preserves 75% mobile side width. |

## Component scope and API stability

33 component source families changed directly:

Accordion, AlertDialog, Alert, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Collapsible, Command, Dialog, Drawer, DropdownMenu, Empty, Field, InputGroup, Input, Pagination, Popover, Progress, RadioGroup, ScrollArea, Select, Sheet, Sidebar, Slider, Switch, Table, Tabs, Textarea, Toggle, Tooltip.

Label, Separator, Skeleton and Spinner retain their component source. Their typography/radius/motion consumption was reviewed with the shared foundation. Icon, Image, Link and ToggleGroup retain exact implementation bytes. ToggleGroup consumes the refined Toggle focus/motion recipe while its accepted selected foreground/background classes remain unchanged.

No public props or exports were added or removed. The 41 family contracts retain all API, rendering, state, event and composition facts. Only canonical-source hashes, token dependency facts and token evidence metadata were reconciled with the implementation. The preservation fixture is derived independently from the original R8 sources; it excludes styling evidence from its semantic hash.

Inventory remains 41 families, 210 exports (204 JSX exports, six helpers/hooks), 82 tokens and 15 capabilities. No product-specific theme or density API was introduced.

## Before/after summary

| Family | R8 → R9 |
| --- | --- |
| Controls | Softer oversized radii/heavier focus → 6px controls, solid 2px focus; 32px default rhythm retained and standardized. |
| Navigation | 32px default Sidebar rows and stronger selected styling → 28px rows, neutral selected fill, 16px icons and 8px gaps; collapsed names stay accessible. |
| Data | 40px Table header and 14px Card radius → 32px header/minimum row rhythm, 8px cells, 8px Card radius/16px padding/4px metadata gaps. |
| Menus | Mixed row/container recipes → 28px minimum rows, 8px padding, 14px labels/16px icons, 8px containers and subtle elevation. |
| Modals | Heavy black backdrop/24px padding → 30% backdrop/16px padding, restrained elevation, logical close-button spacing and capped mobile geometry. |
| Disclosure | Unstyled/oversized triggers → 32–36px rows, neutral feedback and 200ms height animation; Collapsible restores visible overflow once open. |
| Feedback | Louder surfaces/larger spacing → quiet neutral treatment, semantic destructive boundaries and stable loading layout. |

## Storybook and browser evidence

Six requested integration stories use real design-system primitives: Data workspace, Settings form, Record detail, Side-panel form, Empty workspace and Command/search. Four additional bounded family compositions cover Forms, Navigation/data, Menus/overlays and Feedback/disclosure.

The Storybook toolbar supports LTR/RTL and Light/Dark. Accessibility rules remain enabled, including regions. The matrix asserts actual theme paint and font readiness after Storybook's URL/global settling; screenshot labels alone are not accepted as evidence.

Evidence lives outside the checkout:

- `/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification`: wave logs, full gates and preservation report.
- `/Users/amjedfadul/.artifacts/shadcn-design-system/release009-browser`: focused wave screenshots/computed-style reports.
- `/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix`: final matrix report and screenshots, including R8/R9 comparisons.

The fresh independent reviewer separately opened all 40 integration renders with encoded globals and readiness waits: correct theme/direction and Geist font, no page errors, no horizontal document overflow at 1360px. The final rich matrix passes 52 recorded states (40 integration combinations, two mobile overlays, ten R8/R9 family captures), with 89 screenshots and zero browser/page/network errors. It confirms desktop Sheet 480px, mobile Sheet 75%, 16px mobile Dialog inset, collapsed Sidebar accessible names and reduced motion. An explicit mobile Sidebar remains 288px at desktop browser widths; Sheet in a fixed 400px containing block remains 300px at browser widths 500px and 1360px.

## Wave review and corrections

- Wave 1: 199 focused unit checks, 52 Storybook checks, build, four browser states; independent review caught faded invalid focus and it was corrected.
- Wave 2: 25 focused unit checks, 29 Storybook checks across run and corrected expectation, build, four browser states; collapsed names, badge contrast/focus and idle Tabs contrast corrected.
- Wave 3: 58 focused unit checks and 31 primitive Storybook checks across runs/corrections, build, four browser states; retained shared modal z50 ordering after nested-layer review, verified mobile Dialog, corrected source identities and overlay timing assertions.
- Wave 4: 10 focused unit checks, 44 Storybook checks across run/corrected ScrollArea expectation, build, four browser states; preservation checks and independent review; Collapsible overflow correction re-reviewed.
- The full unit run exposed one genuine Sheet viewport-dependency regression: removed the responsive width breakpoint and used a containing-block-only cap, preserving the existing invariant unchanged. Source/token audit recognizes exact ring-inset placement and ring-offset-0 width without allowing unknown color/width names. Stale canonical hashes, elevation/motion/radius facts and historical counts were corrected. Full Storybook exposed stale canvas-vs-overlay token expectations and immediate animated-paint assertions. They were corrected against real contracts/settled state without disabling accessibility checks.
- Fresh final review found the compact CommandDialog close button extended into the first result. Its close button now sits at the logical 4px end/top inset within the 36px search row; 40px logical input padding reserves an 8px gap. Four-mode browser hit testing, long query/filter/keyboard selection and 18 focused unit checks pass. No public API or rendering semantics changed.
- Extra overlays cover four CommandDialog modes and four Drawer modes, with 12 screenshots. Drawer surface, backdrop, focus restoration and reduced motion pass. Drawer emits an inherited React 18 ref warning in development: the same warning is reproduced in the unchanged accepted R8 development build (`r8-drawer-baseline-warning.json`). Its overlay/portal topology is unchanged; ref forwarding is deferred for an API/render-focused change. The extra-overlay harness records failure at its strict zero-console-error assertion because of those four inherited warnings; its geometry, surface, interaction and motion assertions passed, and the reviewer reproduced the same warning and working dismissal/focus behavior in R8. The zero-error rich matrix claim is limited to its recorded 52 states; it does not include these additional Drawer renders.
- Rich matrix exposed Storybook's second URL-normalization navigation. Final matrix uses encoded globals and per-state theme/paint/font checks.

## Final verification and candidate

Node 22.18.0 and npm 10.9.3 are pinned; no dependency changes.

- Final typecheck: passed.
- Complete frozen-input unit suite: 118 files / 1551 tests passed, exit 0; `final-full-unit.log`, 1655.36 seconds. No failing tests or files.
- Storybook build: passed.
- Full Storybook runtime/accessibility: 43 files, 224 stories passed after the final CommandDialog correction.
- Final browser matrix: 52 states, 89 screenshots passed, zero errors.
- Original full unit run: 118 files / 1551 tests executed; 1535 passed and 16 failed. Traces retained in `full-unit.log`. Stale expectations and real findings corrected. A subsequent rerun was stopped before the late CommandDialog correction to prevent input drift; its trace remains in `full-unit-before-command-fix.log`. Final full frozen-input rerun passed all 118 files / 1551 tests in `final-full-unit.log`.
- Final candidate generated from clean inputs after the CommandDialog correction: 56 packed files; independent fresh-build verification passed with byte-identical tarball, integrity and file inventory. No expectations refreshed. Prior candidate and anchors remain separately retained as superseded evidence.

Candidate version: `0.0.0-release.9`.

| Identity | SHA256 |
| --- | --- |
| Release payload | `c25a3b51a47736440a4462152db28d28c3883ac2cdbe3ed5ba286fd73e406d19` |
| Distribution manifest bytes | `a1269501d5851ff227e587403e4c590e86f70eedadacf709bef768697ecbf6d1` |
| Candidate tarball bytes | `0fbba8d83fb43e3707705cea5b2a1d62bcd594e3d637ecf055d7b6b70d4b600b` |

External candidate directory: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-009-density-final`. Anchors retained independently in `release009-verification/final-candidate-anchor.json`. The producer binds 364 implementation inputs; clean candidate verification compares exact tarball bytes, integrity, file inventory and content hashes without refreshing expectations.

Integrity (SHA512): `sha512-gQLImjdShjpovRx/JhOT9ORBfxXDuG8MxlmLF6+rBkt7gJQRpKysGdfuy7wlwpJb2fYkw4wJzAuThY74vjVxfQ==`.

The post-suite release anchor, frozen R7/R8 artifacts, original R8 source manifest and final candidate bytes were rechecked successfully.

## Preservation

R7 executable JSON SHA256: `366a2dd45490a28689effc10a8c58b68d090d8d0d86895c7e6269c9bbd2ae45c`.

R7 accepted dependency-rebind tarball SHA256: `269c862f86183cfecb59f3d1e2708aa2cfc085352d116d842ed15f6f3a3d6c02`.

R7 distribution manifest SHA256: `3631a7f0cf0edf62951e71a5c7b52a2971c629fd5fa72ec5178179b99f8d1168`.

R8 retained executable JSON SHA256: `890a1a25be20039270c0222524813786044137ff0b90b1843fb9ac0a527015db`.

R8 candidate tarball SHA256: `79f486520dbaebedd69d9bd9daecdb030aab85d72d94e235db25429a430b3122`.

Original R8's 660 source files and every retained R7/R8 release/distribution file compare equal. Historical guard covers 13 retained artifacts, including R8. Generation and candidate tools also independently guard the accepted R3 packaged release.

## Independent review and deferred work

Fresh GPT-6.1 Sol reviewer did not implement R9. Independent source, semantic/API preservation, 40-render browser checks and follow-up four-mode CommandDialog interaction checks have no unresolved Critical/Important finding. The reviewer independently bound the latest candidate to all 364 source inputs and verified all 56 packed files and 42 public declarations against R8. Final verdict: approve the final Release 009 candidate. Zero Critical and zero Important findings remain. The complete unit gate passes, and the post-suite release anchor and source inputs remain unchanged. Inherited Drawer development ref diagnostic is Minor and explicitly deferred.

Terra was unavailable in this environment; the lead implemented the component changes, Luna owned inventory/matrix evidence, and independent Sol reviewers handled wave and final reviews. No Astra was used.

Intentionally deferred: inherited React 18 DrawerOverlay ref diagnostic (also present in accepted R8), product-specific themes, special density props, Canvas-specific Sidebar authoring and external release actions. No requested family was omitted.

## Linked evidence

- [Complete unit trace](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification/final-full-unit.log)
- [Storybook runtime/accessibility trace](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification/final-storybook-tests.log)
- [Browser matrix and screenshot inventory](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/release009-matrix-report.json)
- [Additional Command/Drawer geometry and inherited diagnostic](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/extra-overlays/report.json)
- [Exact clean candidate verification](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification/final-candidate-verify-latest.log)
- [Post-suite release anchor verification](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification/final-release-anchor-after-unit.log)
- [Preservation identities](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-verification/final-preservation.json)
- [Independent final review](</Users/amjedfadul/.codex/worktrees/release009-density/shadcn design system/docs/RELEASE-009-REVIEW.md>)

Representative before/after captures:

| Family | Accepted R8 | Final R9 |
| --- | --- | --- |
| Button | [Before](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r8-components-button-light-ltr.png) | [After](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r9-components-button-light-ltr.png) |
| Card | [Before](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r8-components-card-light-ltr.png) | [After](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r9-components-card-light-ltr.png) |
| Table | [Before](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r8-components-table-light-ltr.png) | [After](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r9-components-table-light-ltr.png) |
| Dialog | [Before](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r8-components-dialog-light-ltr.png) | [After](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r9-components-dialog-light-ltr.png) |
| Sidebar | [Before](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r8-components-sidebar-light-ltr.png) | [After](/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix/r9-components-sidebar-light-ltr.png) |
