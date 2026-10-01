# Release 009 — Product UI Density & Visual Hierarchy

User brief is the binding specification. Execute continuously, with no commits or remote actions.

## Baseline and isolation

Stack exact uncommitted Release 008 candidate sources over `74f06c7199f723ccc9b1dd7c3ae82d797558221f`. Original R8 worktree stays untouched. Retain its source manifest externally. Historical releases through R8 are immutable artifacts; migrate only active producer identity to R9.

## Foundation decisions

Geist Variable; 12px metadata, 14px controls/content, 16px grouped-object titles, 18–20px panel/page headings. Controls/labels/navigation weight 500, content 400. Existing 4px spacing scale; icon gap 8px, compact gap 4px, field gap 8px, section 16–24px.

Radius base 8px; sm 4px, md 6px, lg 8px, xl 12px; full stays full. Canvas is background, subtle is muted/sidebar, raised is card, overlay is popover. Light/dark semantic colors remain accepted R8 values. Neutral navigation/row selection; primary actions, link and focus retain brand. Cards/inline controls have no elevation. Floating menus use shadow-sm, modal surfaces shadow-md. Focus: solid semantic 2px ring with 2px background offset. Invalid: destructive border and restrained tint; focus remains clearly visible. Motion: 100ms hover, 150ms state, 200ms overlays, 300ms structural transitions; explicit properties and reduced-motion support.

Sheet side width: 75% of its containing block, capped to 30rem and containing-block width minus 2rem; no viewport breakpoint, preserving mobile Sidebar overrides. Overlay backdrop: 30% black, verified with focus and readability. Default controls 32px, compact 28px, tiny 24px, large 36px. Tables use 32px minimum row rhythm with composable taller content.

## Execution and gates

- [x] Wave 1: foundation and actions/forms. Focused runtime/API/token checks, Storybook/browser light/dark LTR/RTL forms; independent review; fixes.
- [x] Wave 2: navigation and data. Preserve sidebar width and collapse behavior; table/card/badge density. Focused checks/build/browser/review.
- [x] Wave 3: menus and overlays. Shared row/container rhythm, focus/layering/motion, side width and mobile. Focused checks/build/browser/review.
- [x] Wave 4: feedback, disclosure and structure. Quiet semantic states, loading stability, restrained rows/motion. Focused checks/build/browser/review.
- [x] Wave 5: six primitive-only integration stories and bounded state matrix. Browser screenshots and computed paint/geometry, keyboard interactions, accessibility checks. Review and fixes.
- [x] Final: active R9 identity + reconciled source contracts/provenance, full typecheck/unit/Storybook/browser, clean candidate rebuild/identities, byte preservation R7/R8 and primitive semantics, fresh independent GPT-6.1 Sol final review.

## Review focus

1. R8 Icon/Image/Link source/API bytes stay intact; Toggle Group selected paint remains intact.
2. Two-pixel focus ring must survive composed InputGroup and selected/invalid states.
3. Neutral text/selected/hover paint must remain legible in both modes.
4. Logical padding/navigation and overlay content work in RTL and narrow viewports.
5. Contract regeneration updates styling evidence only; APIs and rendering semantics remain unchanged.

## Rulings

User explicitly supplies spec/execution method and continuous authorization, superseding skill approval and commit steps. No new public props. Terra is unavailable: lead implements, Luna audits/evidence, Sol independently reviews. Shared recipe values live in theme scale and component classes; no product theme/density flags.

Wave 1: 199 focused tests + 52 Storybook checks + build + four browser states. Independent review invalid-focus finding fixed and checked.
Wave 2: 25 focused tests + 29 Storybook checks across run and Tabs correction + build + four browser states. Accessible collapsed names, badge contrast and focus, Tabs contrast corrected; independent reviewer clean. Source/API changes are styling-only.

Wave 3 layering ruling: retain z50 for modal backdrop and content; DOM order of later portals places nested modal backdrops above parent content. Splitting backdrop40/content50 fails nesting.

Wave 3: 58 focused unit checks green across run + source-identity corrections; 31 primitive Storybook checks green across run + Select timing correction; build and four browser states. Independent source/mobile review found layering issue; retain shared z50 portal ordering. Updated current producer to R9 to keep R8 artifact frozen; final generation remains required after all source inputs settle. Integration stories revealed legitimate naming/landmark/timing issues and were corrected without disabling axe.

Wave 4: 10 focused unit checks, 44 Storybook checks across run and corrected ScrollArea expectation, build/four browser states, preservation checks, and independent review. Collapsible clips only during animation and restores open overflow. Token evidence metadata added for its new styling; preservation compares all API/render/composition facts independently of styling evidence.

Wave 5: all six requested integrations plus four representative compositions; final browser matrix52states/89screenshots (40integration,2mobile,10comparison), fiveR8/R9familycomparisons, zero browser/page/network errors; Geist HTTP200, mobile overlays/collapsed Sidebar/reducedmotion verified. Independent Sol separately checked all40 integrationrenders and keyboardfocus in allfourmodes.
