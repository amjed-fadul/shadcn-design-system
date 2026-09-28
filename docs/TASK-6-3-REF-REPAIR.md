# Task 6.3 React 18 ref repair — uncommitted review evidence

This continues Task 6.3 on `fix/release-hardening-snapshot-gate`, HEAD `a07117fe380ec1fc8527641817e8547a2bb9d540`. Worktree: `/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate`. No commit, push, merge, PR, release-002, Task 6.4, real Canvas changes or M7 work is authorized/performed.

## Preserved Task 6.3 RED

The original 19 untracked harness/evidence files were recorded before edits and copied byte-for-byte under `/tmp/task63-ref-repair-JbV3m9/preserved/`. `head.txt`, `branch.txt`, `status.txt`, `preserved-files.txt` and `preserved-sha256.json` in that directory record the starting state. `preservation-check.json` checks all 19 preserved copies and records current harness hashes. The original verification report, plan, RED expectations and dependency lock remain unchanged. Temporary paths are local evidence, not durable artifact storage.

Before production edits, the exact original command was rerun:

```sh
volta run --node 22.18.0 --npm 10.9.3 node tests/isolated-consumer/run.mjs \
  --candidate /tmp/task63-candidate-EaA3gl \
  --manifest-sha256 205c2fa459210fec044b9d9912025211f2930046821ea7ced45a5338145fb318
```

It exited nonzero after completing its remaining tamper and byte proofs, with `success: false`. Native DialogTrigger returned focus; composed DialogTrigger asChild → packaged Button closed on Escape and left focus on BODY. The single physical React and React DOM runtime was 18.3.1. Fresh RED run: `/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-xBwTBh`, top-level log `/tmp/task63-ref-red.log`.

Old tarball, retained unchanged: `/tmp/task63-candidate-EaA3gl/adc-shadcn-design-system-0.0.0-release.1.tgz`; SHA-256 `29c9743ba6c263bf01afafa6702ee88ace2fe21c46d6348a1da7953ddb21dd5f`; integrity `sha512-pBjZ6VLD7kYw/3frZKVS1Idb+f+Vc7jFjbfltTu9/2kFSDcxnNj8Iqy9AeizXT8+gX3onpZTvyw0LPBQlJ5WUg==`; 35 packed files. Its manifest SHA-256 is the retained digest above.

## Root cause

Button's source and emitted declaration were ordinary function components. In the packed JavaScript, the same Button function omitted a forwarded ref. Radix DialogTrigger composes its internal trigger ref through Slot to its asChild child; Dialog's close-autofocus handler uses that trigger ref to focus the trigger.

The small diagnostic `ref-diagnostic.mjs` and its `ref-diagnostic.json` output in the repair evidence directory use React/React DOM and package JavaScript from the RED consumer. A forwardRef proxy records the actual Radix-supplied ref in a layout effect: type `function`. The packaged Button's direct ref stays null; a native control's ref is BUTTON. React reports “Function components cannot be given refs.” Repository jsdom supplies only this diagnostic's DOM; the separate isolated browser RED does not depend on it.

## 19-family ref audit

[Complete 107-export audit](TASK-6-3-REF-AUDIT.md) classifies every export and links local/pinned upstream composition evidence. The initial four-export set was expanded after Terra identified three supported adjacent overlay triggers. The final seven-export set is:

| Export | Supported path requiring an incoming DOM ref |
| --- | --- |
| Button | Dialog/Dropdown/Tooltip trigger asChild → Button; original RED |
| DialogTrigger | Radix documented Tooltip.Trigger → Dialog.Trigger → custom button |
| SidebarMenuButton | Pinned shadcn sidebar-07 nav-user/team-switcher dropdown trigger child |
| SidebarMenuAction | Pinned sidebar-07 nav-projects dropdown trigger child |
| TooltipTrigger | Reverse shared overlay-trigger chain; Radix primary discussion #560 |
| DropdownMenuTrigger | Shared tooltip/dropdown trigger; Radix primary discussion #560 |
| SheetTrigger | Same Dialog primitive in the tooltip/sheet trigger chain |

The other 100 exports remain unchanged. Three already forward public refs. Outer trigger parents in audited paths obtain their own internal refs; outbound asChild alone does not establish an incoming ref requirement. Ordinary form, layout, card, table and content usage does not establish one either. This is a bounded supported-path repair, not a claim that every wrapper accepts arbitrary parent refs.

## Production fixes

Seven wrappers in six source files now use React 18 `forwardRef`, pass its second argument to the selected native/Slot/Radix host and expose displayName. Existing props, defaults, classes, accessibility behavior, variants, sizes, events and asChild host selection remain intact. The four Radix trigger wrappers use their primitive's ElementRef and props; the three button wrappers use ComponentPropsWithoutRef and HTMLButtonElement. No React version/dependency changes or new component APIs.

## Focused RED/GREEN

The original isolated RED remained unchanged while each wrapper was repaired sequentially. Logs under `/tmp/task63-ref-repair-JbV3m9`:

| Wrapper | RED log / result | GREEN log / result | Relevant Storybook/a11y |
| --- | --- | --- | --- |
| Button | button-red.log: 2 failed | button-green.log: 2 passed | button-storybook.log: 6 passed |
| DialogTrigger | dialog-trigger-red.log: 1 failed, 2 passed | dialog-trigger-green.log: 3 passed | dialog-storybook.log: 1 passed |
| SidebarMenuButton | sidebar-menu-button-red.log: 1 failed, 3 passed | sidebar-menu-button-green.log: 4 passed | sidebar-menu-button-storybook.log: 3 passed |
| SidebarMenuAction | sidebar-menu-action-red.log: 1 failed, 4 passed | sidebar-menu-action-green.log: 5 passed | sidebar-menu-action-storybook.log: 3 passed |
| TooltipTrigger | tooltip-trigger-red.log: 1 failed, 7 passed | tooltip-trigger-green.log: 8 passed | tooltip-trigger-storybook.log: 1 passed |
| DropdownMenuTrigger | dropdown-trigger-red.log: 1 failed, 8 passed | dropdown-trigger-green.log: 9 passed | dropdown-trigger-storybook.log: 1 passed |
| SheetTrigger | sheet-trigger-red.log: 1 failed, 9 passed | sheet-trigger-green.log: 10 passed | sheet-trigger-storybook.log: 2 passed |

Final focused tests also preserve own-asChild refs/events for both sidebar buttons and reject React console errors. The Dialog composed-trigger story exercises Tooltip → DialogTrigger → Button, Escape and exact focus return. It dismisses the tooltip reopened by restored focus before the normal a11y audit. No a11y rules are disabled.

Source reconciliation initially rejected forwardRef-hosted Button/sidebar source facts because the existing delegated-host analyzer only recognized ordinary functions. A focused RED test led to narrow support for imported React namespace/default forwardRef calls with inline render functions; arbitrary factories remain untrusted. The Button-specific rendering extractor shares that recognition. `analyzer-red.log` records the failure; `seven/focused.log` records the complete GREEN suite.

## Type/declaration proof

`seven/declaration-diff.patch` and `seven/declaration-files.json` in the repair evidence directory compare emitted declarations against the actual RED installation. Only button.d.ts, dialog.d.ts, sidebar.d.ts, tooltip.d.ts, dropdown-menu.d.ts and sheet.d.ts change. All seven corrected exports become ForwardRefExoticComponent with RefAttributes<HTMLButtonElement>. Variant/size unions, tooltip, isActive, showOnHover, event and asChild props remain. The private sidebar variant helper is inlined by declaration emit; no public export is removed.

The isolated harness retains all original 17 compiler-inspected anti-any assertions and six unsuppressed negative TS2322 cases. It adds 14 ref/ElementRef anti-any assertions, seven positive typed-ref/asChild cases and seven unsuppressed wrong-element-ref TS2322 cases. It uses strict mode, skipLibCheck=false and no repository aliases. The established asChild API remains button-ref typed; no new polymorphic API is introduced.

## Governance reconciliation

Existing `slots[0].refForwarding` fields change from `unresolved` to `supported` only for six affected exports. TooltipTrigger has no existing slot entry; its forwarding is retained as tested implementation behavior and source identity, without inventing a slot or schema. Source blob identities for the six families are reconciled in their contracts and seed provenance; the seed derivation records the React 18 ref correction, and component-contract-source points at the revised seed blob. The contract schema, package identity, 107-export vocabulary and 82-token authority are unchanged.

The normal release generator intentionally rejects any projection delta. `tests/isolated-consumer/reconcile-ref-release.mjs` is a bounded repair utility using the existing canonical loaders, executable release factory and implementation manifest. It builds the expected projection from the pinned RED release and permits exactly those six existing ref facts, deeply comparing everything else before writing. It also requires an independently retained prior release digest. This does not relax the normal generator or verifier.

## Release-001

- Old SHA-256: `5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f`.
- New SHA-256: `97eb857c7de37fbb88793f7f28cc3a684e2f644b30c51867b471e842d0d86697`.
- Release ID remains `shadcn-radix-release-001`.
- Executable projection changes exactly six `component.slots[0].refForwarding` values from unresolved to supported. No other projection delta.
- Implementation manifest retains 205 paths; 15 input identities change: six contracts, two provenance files, six production wrapper files and delegated-host-source-analysis.ts. `seven/implementation-delta.json` records old/new git blobs and SHA-256 for each. The Button-specific extractor is test evidence rather than a packaged input.
- `release-reconcile-seven.log` records the final identity and permitted delta. The intermediate four-wrapper candidate and report remain retained under the stage-one paths; they are superseded for final acceptance.

## New candidate

Final seven-wrapper candidate generated from corrected uncommitted source:

- Directory: `/tmp/task63-seven-candidate-4udqhnlx`.
- Tarball: `adc-shadcn-design-system-0.0.0-release.1.tgz`.
- Tarball SHA-256: `92761dd7b7b7e41e84b50d04c35651342614ca0f6471152e14f8f7ae7c2a2d80`.
- npm integrity: `sha512-rtdsBrRqrfWRzpg8mAGFTjSiFs/qulMXJzKKxQMXBE4+SQ9Q/p6UrrM0rKmo43ENHZDSEePSpP9yq6q0tMrKCA==`.
- Manifest SHA-256: `e72d1a649f63b649bdafad6805ee481031e976072a3d8c2ce2f6858d47f97fea`.
- Packed files: 35.

The separate `expectations-ref-repair.json` retains canonical release/document/component hashes and this reviewed integrity. The old RED expectations and dependency lock remain intact. `--expectations` copies the reviewed profile to the external consumer and only updates the copied DS lock integrity; all other dependency pins remain unchanged. Verification never refreshes expectations.

Superseded four-wrapper candidate `/tmp/task63-ref-candidate-qmgcy8b7` and its successful consumer `task63-run-Jvu5yb` remain retained; their identities and results are in `/tmp/task63-ref-repair-JbV3m9/stage-one/docs/TASK-6-3-REF-REPAIR.md`. They are not the final seven-wrapper acceptance evidence.

## Isolated consumer final result

PASS: `success: true`, zero blockers and zero browser errors. Evidence: `/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-BdAk8E/consumer/evidence.json`; parent directory contains release/candidate verification, 12 byte-verifier tests, install and sandbox logs. Top-level log: `seven/isolated.log`.

- Original Dialog+Button regression stays unchanged: Escape closes the dialog and active element is exactly `{ tag: "BUTTON", id: "composed-dialog-trigger" }`.
- The single additional canary proves the incoming DOM ref traverses TooltipTrigger → DropdownMenuTrigger → SidebarMenuButton, then Dropdown Escape returns to the exact trigger.
- All prior checks pass: three entrypoints, 107 exports/19 families, 82 tokens, external installation, all six worktree reads denied, one React/React DOM 18.3.1 runtime, no Tailwind, strict types, full source/module closure, light/dark/light CSS, embedded fonts, Button, Tabs, hooks, native Dialog body portal/initial focus/Escape return in all themes, and ScrollArea keyboard/wheel scrolling.
- Original 17 anti-any + 14 ref anti-any checks pass; original six negative + seven wrong-ref TS2322 cases reject. Nine tamper cases reject. Complete installed bytes pass before imports and at completion.
- `seven/ref-diagnostic-green.json` repeats the development-runtime probe on the final installation: Radix supplies a function ref, Button receives BUTTON, and no React warnings occur.

The first four-wrapper candidate run (`task63-run-YQvWXU`, `isolated-green.log`) exposed an existing tab-color transition race during the first portal snapshot (`oklab(... / 0.698356)` rather than the final opaque color). All three portal theme snapshots now use the harness's existing bounded retry helper with the same exact assertions, as theme toggles already did. No assertion or transition is disabled.

## Full verification

Fresh verification uses Node 22.18.0 / npm 10.9.3. Final logs are under `/tmp/task63-ref-repair-JbV3m9/seven`.

| Check | Result / log |
| --- | --- |
| Focused refs, analyzer, Button contract | 15 passed, focused.log |
| All six affected Storybook files | 15 passed, affected-storybook.log |
| Full isolated consumer | PASS, isolated.log |
| typecheck | PASS, typecheck-final.log |
| npm test | 731 passed across 48 files, test-final.log |
| build / build:library | PASS, build.log / build-library.log |
| test:library | 6 passed, test-library.log |
| build-storybook | PASS, build-storybook.log |
| test-storybook | 48 passed across 20 files, test-storybook.log |
| tokens:verify | 87 passed, tokens-verify.log |
| components:verify | 459 passed, components-verify-final.log |
| snapshot:verify | 5 passed, snapshot-verify.log |
| release:verify with final retained release SHA | PASS, final isolated run's release-verify.log |
| candidate:verify with retained manifest digest and fresh build | PASS, final isolated run's candidate-verify.log |
| Both dependency audits | 0 vulnerabilities, audit-production.log / audit-full.log |
| git diff --check including untracked files | PASS, diff-check.log |

Earlier four-wrapper results remain preserved in the parent directory and stage-one report. The first seven-wrapper full test run had 730 passing tests and one local test-only export classifier failure: it classified every variable declaration as a helper. The test now uses the narrowly tested React.forwardRef render recognition. Production contracts and candidate bytes did not change for this correction. The final full rerun passes all 731 tests and is recorded separately.

The initial full unit run exposed a stale pre-repair projection expectation. Its replacement constructs only the six reviewed existing ref facts from the pinned historical projection and deeply compares everything else. No unrelated Git-timeout test was edited.

## Terra review

One read-only gpt-5.6-terra High reviewer found a P1 omission in the original four-wrapper boundary. The follow-up primary-source review confirmed TooltipTrigger, DropdownMenuTrigger and SheetTrigger as supported adjacent paths. Terra accepted the seven-export boundary and found no further concrete supported path for expansion. All three additions have sequential RED/GREEN evidence. Final verdict: **no actionable findings; prior P1 resolved**. The same reviewer examined the final seven-wrapper candidate and observed 731 unit tests, 48 Storybook tests, 459 component checks and clean whitespace checks.

| Review question | Final answer |
| --- | --- |
| 1. React 18 ref forwarding is the root cause? | Yes; preserved null ref/warning/BODY contrasts with final BUTTON. |
| 2. Audit broad enough? | Yes; seven concrete supported targets, including adjacent overlay triggers. |
| 3. Only evidence-backed wrappers changed? | Yes; exact seven-export set accepted. |
| 4. Button forwards actual DOM ref? | Yes; focused and packaged proof. |
| 5. asChild preserved? | Yes; ref/event composition and original Dialog path pass. |
| 6. Escape returns exact Dialog trigger? | Yes; BUTTON with id composed-dialog-trigger. |
| 7. Public types correct? | Yes; strict positive/negative and 14 added ref anti-any checks. |
| 8. React 19 assumptions remain? | None found; one React/React DOM 18.3.1 runtime. |
| 9. Contracts/provenance/identities truthful? | Yes; six factual fields and tested Tooltip behavior with source identity. |
| 10. Projection delta justified? | Yes; precisely six existing refForwarding facts. |
| 11. Same harness passes new candidate? | Yes; retained manifest e72d1a649f63b649bdafad6805ee481031e976072a3d8c2ce2f6858d47f97fea and success=true. |
| 12. False-success path? | None found; blockers, tamper and final bytes remain mandatory. |
| 13. Bounded scope? | Yes; release-001 retained, no further concrete supported target found. |

## Exact changed-file list

Total: 23 tracked modifications and 27 untracked files (including the original 19). Relative to this worktree root; no files are staged.

Tracked modifications:

- `contracts/components/families/button.json`
- `contracts/components/families/dialog.json`
- `contracts/components/families/dropdown-menu.json`
- `contracts/components/families/sheet.json`
- `contracts/components/families/sidebar.json`
- `contracts/components/families/tooltip.json`
- `provenance/component-contract-source.json`
- `provenance/releases/shadcn-radix-release-001.json`
- `provenance/seed-components.json`
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.stories.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/tooltip.tsx`
- `src/contracts/components/canonical-render-source-evidence.ts`
- `src/contracts/components/delegated-host-source-analysis.ts`
- `tests/component-contract-button.test.ts`
- `tests/component-contract-compound-families.test.ts`
- `tests/component-contract-stateful-families.test.ts`
- `tests/library-package.test.ts`
- `tests/package-identity.test.ts`

Untracked files:

- `docs/TASK-6-3-REF-AUDIT.md`
- `docs/TASK-6-3-REF-REPAIR.md`
- `docs/TASK-6-3-VERIFICATION.md`
- `docs/superpowers/plans/2026-09-05-task-6-3-isolated-consumer.md`
- `tests/delegated-host-forward-ref.test.ts`
- `tests/fixtures/isolated-consumer/expectations-ref-repair.json`
- `tests/fixtures/isolated-consumer/expectations.json`
- `tests/fixtures/isolated-consumer/index.html`
- `tests/fixtures/isolated-consumer/package-lock.json`
- `tests/fixtures/isolated-consumer/package.json`
- `tests/fixtures/isolated-consumer/src/main.tsx.template`
- `tests/fixtures/isolated-consumer/src/ref-types.tsx.template`
- `tests/fixtures/isolated-consumer/src/strict-types.tsx.template`
- `tests/fixtures/isolated-consumer/tools/acceptance.mjs`
- `tests/fixtures/isolated-consumer/tools/browser-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/package-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/type-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/verify-bytes.check.mjs`
- `tests/fixtures/isolated-consumer/tools/verify-bytes.mjs`
- `tests/fixtures/isolated-consumer/tsconfig.json`
- `tests/fixtures/isolated-consumer/types/invalid.tsx.template`
- `tests/fixtures/isolated-consumer/types/ref-invalid.tsx.template`
- `tests/fixtures/isolated-consumer/vite.config.mjs`
- `tests/isolated-consumer/README.md`
- `tests/isolated-consumer/reconcile-ref-release.mjs`
- `tests/isolated-consumer/run.mjs`
- `tests/react18-ref-composition.test.tsx`
