# Task 6.3 isolated consumer verification

**Result: blocked by a reproduced React 18 Dialog/Button focus-return defect in the frozen candidate.** The reusable harness is implemented and deliberately exits nonzero (`success: false`). This is not Task 6.4 acceptance.

## Starting state

Worktree: `/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate`. Confirmed clean before changes, branch `fix/release-hardening-snapshot-gate`, HEAD `a07117fe380ec1fc8527641817e8547a2bb9d540`, parent `765e2d7786142cb3ed9f9ae56ebbc8c5e07614d2`. Volta Node `22.18.0`, npm `10.9.3`. Only release-001 exists. The app’s initial directory was an older bootstrap worktree; all task work used the matching release worktree above.

## Candidate identity

- Release: `shadcn-radix-release-001`
- Release SHA-256: `5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f`
- Package: `@adc/shadcn-design-system@0.0.0-release.1`
- Tarball: `/private/tmp/task63-candidate-EaA3gl/adc-shadcn-design-system-0.0.0-release.1.tgz`
- Tarball SHA-256: `29c9743ba6c263bf01afafa6702ee88ace2fe21c46d6348a1da7953ddb21dd5f`
- npm integrity: `sha512-pBjZ6VLD7kYw/3frZKVS1Idb+f+Vc7jFjbfltTu9/2kFSDcxnNj8Iqy9AeizXT8+gX3onpZTvyw0LPBQlJ5WUg==`
- External manifest SHA-256: `205c2fa459210fec044b9d9912025211f2930046821ea7ced45a5338145fb318`
- Packed files: **35**

Generated fresh through the committed Task 6.2 `candidate:generate` path before implementation, in a new external directory. The forbidden `/tmp/task62-candidate-final` was not reused. Existing candidate verification requires the retained digest and compares a fresh build inventory. No package input, source, release data, or build configuration was changed. The runner lives under `tests/` because Task 6.2 binds the entire `scripts/` directory into release identity.

## Isolation

Final fresh consumer: `/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/consumer`.
Run metadata and checkout denial evidence: [task63-run-XPyE4n](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/run.json), [denial log](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/checkout-denial.log).

The consumer installs its own lockfile with `npm ci --ignore-scripts`; its only DS dependency resolves to the copied `.tgz` and the lock integrity equals the external manifest. No workspace, source alias, source mount/import, checkout file dependency, `npm link`, direct dist import, or React alias is used. No Tailwind dependency/config exists. Every installed symlink resolves inside the consumer. TypeScript sources and all resolved Vite modules stay inside its directory. Browser resources come only from the local production server; fonts are embedded in packaged CSS.

All six design-system worktrees were denied filesystem reads by the macOS sandbox. Each package.json read was actively attempted and rejected before running the consumer process and its type/build/browser children under the same sandbox. The checkout was never renamed or deleted.

## Package API and release data

Exactly three entrypoints resolve through ESM export maps: root, `./release`, `./styles.css`. Five private/unknown paths are rejected. Root exposes the approved **107** runtime exports. Release subpath exposes exactly `getExecutableRelease`, `getComponentContracts`, and `getTokenContract`. Node and actual Chromium validate the release ID/hash/package identity, complete release and component documents, **19** families, approved export list, and all **82** token definitions against static Task 6.2 fingerprints. The application uses public imports only and has no filesystem/Git/internal-validator imports.

## Types

Strict positive usage compiles for Button, Card, Tabs, Dialog/DialogContent, ScrollArea, buttonVariants, useSidebar, and the release APIs. `strict: true`, `skipLibCheck: false`, no paths/baseUrl. The compiler inspects **17** anti-any tuple results, all `false`. All declaration/source files resolve inside the consumer.

Six unsuppressed negative examples independently produce TS2322 at their expected line: invalid Button variant, Card size, Tabs callback payload, Dialog callback payload, ScrollArea type, and Button click callback. No `@ts-expect-error` hides these diagnostics.

## React

The physical dependency tree and `npm ls react react-dom --all` contain one React and one React DOM, both **18.3.1**; all package/dependency references dedupe to those roots. DS package has peers rather than runtime dependencies on React. Its emitted JavaScript uses React/React DOM externals and has no bundled React implementation markers. The consumer Vite graph contains **29** modules and exactly one root for each React package.

Real browser state updates, Tabs, useSidebar context/toggle and mobile effect, and native-trigger Dialog portals work. This does **not** erase the Button-composed trigger defect below.

## CSS/theme

| Computed evidence | Light | Dark | Restored light |
| --- | --- | --- | --- |
| `--background` | `oklch(100% 0 0)` | `oklch(14.5% 0 0)` | `oklch(100% 0 0)` |
| `--primary` | `oklch(20.5% 0 0)` | `oklch(92.2% 0 0)` | `oklch(20.5% 0 0)` |
| `--card` | `oklch(100% 0 0)` | `oklch(20.5% 0 0)` | `oklch(100% 0 0)` |
| Button background | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | `oklch(0.205 0 0)` |
| Card border | `oklch(0.922 0 0)` | `oklch(1 0 0 / 0.1)` | `oklch(0.922 0 0)` |
| Tabs list background | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `oklch(0.97 0 0)` |
| Body portal background | `oklch(1 0 0)` | `oklch(0.145 0 0)` | `oklch(1 0 0)` |

Also asserted Button foreground/32px height/8px radius, Card surfaces/1px border, CardHeader grid/16px padding, Tabs active colors/list padding, ScrollArea viewport 320×120px, and body semantics. Light values restore after actual theme-toggle clicks. Dialog content is a direct body child outside the React root and receives the root theme in all three states. Geist font faces load successfully from packaged base64 WOFF2; font checks and computed family pass. No consumer CSS file or Tailwind compilation supplies these styles.

## Interactions and blocker

- Button click updates `Clicked 0` → `Clicked 1`.
- Tabs click selects Second and renders Second panel.
- useSidebar toggles and updates its responsive mobile result on viewport changes.
- Native DialogTrigger opens a body portal, receives initial dialog focus, closes with Escape, and restores focus in all three theme states.
- Keyboard Tab reaches the ScrollArea viewport; settled PageDown scrollTop is **105**, then settled wheel scrollTop is **345**, from 0 (1440px scroll content / 120px viewport).

**Blocking regression:** `<DialogTrigger asChild><Button /></DialogTrigger>` opens and closes, but Escape leaves focus on **BODY** rather than the trigger, including after a five-second condition wait. The same artifact, React runtime and browser pass with a native DialogTrigger. `Button` is a plain function in `src/components/ui/button.tsx`; in React 18 the Radix trigger ref passed through Slot does not reach its button DOM element. Radix Dialog close auto-focus calls `context.triggerRef.current?.focus()`.

The original failing composition remains in the fixture as a regression. A native trigger control was added to finish the independent theme/portal/scroll proofs, not to replace the failure. Browser blockers are asserted empty only after the remaining evidence finishes, so this candidate cannot receive success. Fixing the component would change the required package/release identity and is outside this exact-artifact task; no such change was made.

## Installed-byte verification and tamper proof

All **35** installed files match the digest-anchored external distribution manifest before importing package JS and again after browser/tamper execution: JS, CSS with embedded fonts, all declarations, release.js with embedded data, package.json, README, and third-party notices. File-set equality rejects missing/extra files and regular-file checks reject symlinks.

The focused verifier tests had 12 expected failures before implementation and now pass 12/12. They cover altered bytes, wrong tarball/digest/manifest, missing/extra files, symlinks and traversal. Final candidate-copy tamper results:

- javascript: rejected with `INSTALLED_BYTE_MISMATCH: dist-library/index.js`.
- css: rejected with `INSTALLED_BYTE_MISMATCH: dist-library/styles.css`.
- declarations: rejected with `INSTALLED_BYTE_MISMATCH: dist-library/types/src/components/ui/button.d.ts`.
- package-json: rejected with `INSTALLED_BYTE_MISMATCH: package.json`.
- notices: rejected with `INSTALLED_BYTE_MISMATCH: dist-library/THIRD_PARTY_LICENSES.txt`.
- release-data: rejected with `INSTALLED_BYTE_MISMATCH: dist-library/release.js`.
- wrong-tarball: rejected with `TARBALL_IDENTITY_MISMATCH`.
- wrong-manifest-digest: rejected with `MANIFEST_HASH_MISMATCH`.
- modified-manifest: rejected with `MANIFEST_HASH_MISMATCH`.

Same-size JS/CSS/declaration/package/notices corruption forces digest checking. All tamper probes operate on private copies; canonical candidate/manifest/installed package remain unchanged.

## Full verification

Final focused run: **nonzero by design**, solely for `DIALOG_BUTTON_TRIGGER_FOCUS_RETURN`; all other recorded phases completed. [Machine evidence](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/consumer/evidence.json), [full consumer log](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/consumer-acceptance.log), [focused verifier tests](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/verifier-tests.log), [candidate verification](/private/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/task63-run-XPyE4n/candidate-verify.log).

| Repository check | Exit | Log |
| --- | ---: | --- |
| typecheck | 0 | [log](/tmp/task63-full-kfdvee3g/typecheck.log) |
| unit | 0 | [log](/tmp/task63-full-kfdvee3g/unit.log) |
| build-library | 0 | [log](/tmp/task63-full-kfdvee3g/build-library.log) |
| library | 0 | [log](/tmp/task63-full-kfdvee3g/library.log) |
| release | 0 | [log](/tmp/task63-full-kfdvee3g/release.log) |
| storybook | 0 | [log](/tmp/task63-full-kfdvee3g/storybook.log) |
| components | 0 | [log](/tmp/task63-full-kfdvee3g/components.log) |
| tokens | 0 | [log](/tmp/task63-full-kfdvee3g/tokens.log) |
| snapshot | 0 | [log](/tmp/task63-full-kfdvee3g/snapshot.log) |
| audit-production | 0 | [log](/tmp/task63-full-kfdvee3g/audit-production.log) |
| audit-all | 0 | [log](/tmp/task63-full-kfdvee3g/audit-all.log) |
| diff-check | 0 | [log](/tmp/task63-full-kfdvee3g/diff-check.log) |

Counts: 719 unit, 6 library, 47 Storybook, 459 component, 87 token, and 5 snapshot tests passed. Both audits reported zero vulnerabilities. No known Git-timeout flake occurred and no such tests were changed. Final release verification and all 12 verifier tests were rerun after implementation; all 19 added files also passed no-index whitespace checks (ordinary `git diff --check` alone omits untracked files). Consumer production build emits a size warning because this proof deliberately imports all exports and full release/contract data (approximately 3.56MB JavaScript uncompressed); build exits zero.

## Terra review

One independent **read-only gpt-5.6-terra, High** review completed. It inspected the exact candidate, complete 19-file diff, locked consumer, package install/type/build/browser evidence, module graph, computed themes/portal styles, byte/tamper results and full repository verification.

**Verdict: Task 6.3 blocked, P1.** The reviewer confirmed that the Button-composed Dialog trigger violates required focus-return behavior on React 18.3.1 and that the native-trigger control is not a substitute. It found no additional harness findings or false-success path. The candidate remains unaccepted. A package fix would require separately authorized artifact/identity work; none was performed.

| Review question | Result |
| --- | --- |
| 1. Genuinely isolated from checkout? | Yes; external consumer and six-worktree read denial. |
| 2. DS installs only the tarball? | Yes; npm ci, local tgz resolved path and pinned integrity. |
| 3. No consumer Tailwind? | Yes; no dependency/config and lock check. |
| 4. Portable strict declarations? | Yes; strict/no aliases, 17 anti-any checks, six TS2322 negatives. |
| 5. Exactly one React runtime? | Yes; physical, resolver and Vite graph checks. |
| 6. Hooks/portals runtime correctness? | Passed for state/context/effect and native-trigger portal. |
| 7. Packaged light/dark CSS? | Passed through computed-style checks. |
| 8. Body portal theming? | Passed light/dark/restored light. |
| 9. Real interactions including focus? | **P1 failure:** Button-composed trigger returns focus to BODY. Other interactions pass. |
| 10. Release data without browser Git/filesystem? | Passed public browser API/hash checks. |
| 11. Installed bytes match anchored manifest? | Passed all 35 files and artifact digests. |
| 12. Tamper rejected? | Passed all nine candidate-copy cases. |
| 13. Hidden source/workspace/link dependencies? | None found for this execution. |
| 14. Real Canvas untouched? | Yes within reviewed diff/scope evidence. |
| 15. Any false-success path? | None found; nonempty blockers prevent success. |

The review identifies the non-ref-forwarding Button at `src/components/ui/button.tsx:44`, the preserved browser regression at `tests/fixtures/isolated-consumer/tools/browser-proof.mjs:181`, and the final failure gate at `tests/fixtures/isolated-consumer/tools/acceptance.mjs:71`.

## Exact changed files

- `docs/TASK-6-3-VERIFICATION.md`
- `docs/superpowers/plans/2026-09-05-task-6-3-isolated-consumer.md`
- `tests/fixtures/isolated-consumer/expectations.json`
- `tests/fixtures/isolated-consumer/index.html`
- `tests/fixtures/isolated-consumer/package-lock.json`
- `tests/fixtures/isolated-consumer/package.json`
- `tests/fixtures/isolated-consumer/src/main.tsx.template`
- `tests/fixtures/isolated-consumer/src/strict-types.tsx.template`
- `tests/fixtures/isolated-consumer/tools/acceptance.mjs`
- `tests/fixtures/isolated-consumer/tools/browser-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/package-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/type-proof.mjs`
- `tests/fixtures/isolated-consumer/tools/verify-bytes.check.mjs`
- `tests/fixtures/isolated-consumer/tools/verify-bytes.mjs`
- `tests/fixtures/isolated-consumer/tsconfig.json`
- `tests/fixtures/isolated-consumer/types/invalid.tsx.template`
- `tests/fixtures/isolated-consumer/vite.config.mjs`
- `tests/isolated-consumer/README.md`
- `tests/isolated-consumer/run.mjs`

## Scope

No commit, push, merge, PR, release-002, Task 6.4, real Canvas changes, or M7 work. Existing tracked repository files remain unchanged; only the listed harness/template/documentation files are added. Task 6.3 has not passed the exact-candidate acceptance proof.
