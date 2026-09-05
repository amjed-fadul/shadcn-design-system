# Task 6.3 isolated package proof

Run from the design-system checkout, with its existing build dependencies installed:

```sh
volta run --node 22.18.0 --npm 10.9.3 node tests/isolated-consumer/run.mjs
```

This generates a fresh candidate through the committed Task 6.2 generation path, verifies it against a fresh build, then installs it into a new external temporary consumer with `npm ci --ignore-scripts`. The fixture lock pins React/React DOM 18.3.1, all consumer tooling/transitive dependencies, and the reviewed tarball's npm integrity. Candidate generation never updates fixture expectations or the lock. A different tarball integrity is rejected.

To verify the Task 6.3 candidate with its independently retained manifest digest:

```sh
volta run --node 22.18.0 --npm 10.9.3 node tests/isolated-consumer/run.mjs \
  --candidate /tmp/task63-candidate-EaA3gl \
  --manifest-sha256 205c2fa459210fec044b9d9912025211f2930046821ea7ced45a5338145fb318
```

The candidate directory must contain `adc-shadcn-design-system-0.0.0-release.1.tgz` and `distribution-manifest.json`. Do not derive a new trusted digest when verifying an existing candidate. Temporary paths are local evidence, not permanent artifact storage.

The runner prints the new evidence/consumer directory, preserves phase logs, and returns nonzero for a failed check. `consumer/evidence.json` has `success: true` only after all checks, including final byte verification, pass. Failure logs and partial evidence remain available. No consumer `node_modules`, tarball, external distribution manifest, build output, or screenshots belong in Git.

The runner requires Task 6.2 commit `a07117fe380ec1fc8527641817e8547a2bb9d540` in its ancestry and verifies the unchanged release/package input identity before packaging. This permits a subsequent harness-only commit without changing the candidate authority. All fixture source files use `.template` suffixes so repository typechecks do not accidentally resolve consumer imports inside the design-system checkout.

## Checks

- Exact three exported package paths; denied private paths; approved 107 runtime exports; browser-safe release APIs, 19 families and full release/component/token document hashes frozen from Task 6.2 authorities.
- Independent complete installed-file inventory, sizes and SHA-256 digests, tarball SHA-256/SHA-512 integrity, and external manifest digest. Verification runs before importing installed package JavaScript.
- Strict positive TypeScript including six component families, helpers/hooks and release data; 17 compiler-inspected anti-any assertions; six unsuppressed negative cases must each yield TS2322 at their expected line. No aliases and `skipLibCheck: false`; all compiler source files must resolve within the consumer.
- Package lock, every installed symlink, ESM entrypoint resolution, physical React package roots, `npm ls react react-dom --all`, emitted package imports and full Vite module graph. The fixture has no Tailwind dependency/config, workspace or React alias.
- Real headless Chromium against the production build: public stateful hook and responsive effect, Button click, Tabs selection, body-level Dialog portal/initial-focus/Escape/focus-return, keyboard focus and PageDown/wheel scrolling.
- Computed CSS for light, dark and restored light; button/card/tabs semantics and utility sizing; root variables, portal inheritance in all themes, successful embedded Geist font loading. App code only imports packaged CSS and uses inline dimensions for the fixture; it defines no theme/component styles.
- Same-size JS/CSS/declaration/package/notices corruption, changed embedded release data, wrong tarball/digest and changed external manifest are rejected on private copies. Canonical bytes are reverified at completion.

On macOS the runner denies filesystem reads to **all** design-system worktrees for the consumer process and its build/browser children, and first proves each checkout's package.json is unreadable. On other platforms the required minimum checks still run (external install, symlinks, resolution, compiler/module graph and browser resources); the report explicitly states that no OS sandbox was applied. For a stronger Linux boundary, run the copied consumer in a container that has no checkout mount.

Chromium must be available for Playwright 1.58.2. On a fresh CI host, use the existing pinned repository Playwright installation to run `npx playwright install --with-deps chromium` before this harness. This supplies a browser executable; all consumer JavaScript/build/type tools come from the consumer's own lockfile installation.

Focused verifier regression tests:

```sh
volta run --node 22.18.0 --npm 10.9.3 node --test tests/fixtures/isolated-consumer/tools/verify-bytes.check.mjs
```

This is Task 6.3 evidence only. It does not perform release acceptance, publish a package, touch Canvas, or start Task 6.4.

## Known candidate blocker

The frozen Task 6.2 candidate fails focus restoration for the public composition `<DialogTrigger asChild><Button /></DialogTrigger>` on React 18.3.1: Escape closes the dialog and leaves focus on `BODY`. Button is a function component without `forwardRef`; Radix's trigger ref does not reach the DOM button. The fixture preserves this regression alongside a native DialogTrigger control that passes. Browser evidence records the failure; after completing tamper and final-byte checks the runner exits nonzero with `Browser regressions block Task 6.3` and `success: false`. Do not remove the regression, accept the native control as a substitute, or change package/release bytes under this candidate identity.

## React 18 ref repair candidate

The earlier sections preserve the RED candidate instructions and findings. The corrected uncommitted source has a separate reviewed expectation profile; the default RED profile deliberately does not accept its changed release identity.

```sh
volta run --node 22.18.0 --npm 10.9.3 node tests/isolated-consumer/run.mjs \
  --candidate /tmp/task63-seven-candidate-4udqhnlx \
  --manifest-sha256 e72d1a649f63b649bdafad6805ee481031e976072a3d8c2ce2f6858d47f97fea \
  --expectations tests/fixtures/isolated-consumer/expectations-ref-repair.json
```

The original Dialog+Button regression remains mandatory. This profile additionally runs TooltipTrigger asChild → DropdownMenuTrigger asChild → SidebarMenuButton with actual incoming DOM ref and Escape focus return. The type proof adds 14 ref anti-any assertions and seven wrong-element-ref rejections while retaining every original type check. Only the external consumer's copied design-system lock integrity is set to the profile's explicitly reviewed integrity; the original lock and all transitive pins remain unchanged. Details and preservation checks: [repair report](../../docs/TASK-6-3-REF-REPAIR.md).
