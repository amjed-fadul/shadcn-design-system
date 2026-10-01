# Release 008: Generic Image

Image is a repository-native generic native `img`, independent of AvatarImage. It supports logos, meaningful content images and deliberately decorative imagery through a closed public API.

```tsx
import { Image } from "@adc/shadcn-design-system"

<Image src="/landscape.png" alt="Mountain landscape" width={640} height={360} />
```

`src`, `alt`, `width` and `height` are required. Source must contain non-whitespace text. Alternative text must describe meaningful imagery or be exactly `alt=""` for decoration; missing and whitespace-only alternatives fail at runtime. Width and height are positive integer intrinsic pixel dimensions and remain required for both layouts. Runtime guards enforce these string and numeric refinements; the current authoring schema records required string and number types, without claiming to encode positive-integer or non-whitespace validation.

| Prop | Values | Default |
| --- | --- | --- |
| `layout` | `intrinsic`, `fill` | `intrinsic` |
| `fit` | `contain`, `cover` | `contain` |
| `loading` | `eager`, `lazy` | `eager` |

Intrinsic layout uses a block image, `max-width: 100%` and automatic height. It preserves the source ratio as its parent constrains width. Fill uses the entire width and height of a parent with definite dimensions. Contain preserves the entire image in that box; cover crops without distorting proportions. The required width and height attributes still describe the source rather than becoming arbitrary CSS sizing values. All option values are checked at runtime as well as TypeScript and authoring validation.

Image keeps native accessibility semantics. It forwards only source, alternative text, intrinsic dimensions and loading; classes are governed by layout and fit. It does not expose className, style, arbitrary DOM spread, source sets, role overrides, handlers, children or fallback content. Place an interactive image inside a named action. Profile fallback behavior continues to belong to Avatar. Image pixels remain unchanged across light/dark themes and RTL.

Canonical authority is `src/components/ui/image.tsx`, Git blob `e1dbcd1b5d3e703cae7ed4eeb46cc8944b096817`. The family, seed record and knowledge reference declare `repo-native` and contain no invented upstream path or blob. The active inventory is 40 families and 209 public exports: 203 authorable components and six helpers/hooks. Existing compact manifest formatting and knowledge ordering are preserved.

Verification covers default attributes and semantics, decorative alternatives, intrinsic constraints, fill/contain/cover behavior, closed forwarding, invalid source/alt/dimension/enum values, required authoring props, rejected escape hatches and a negative TypeScript fixture. Nine Storybook stories cover content, logo, decorative, constrained, fill, lazy loading, light, dark and RTL; every story uses the enforced accessibility gate with no exemptions. Independent browser evidence is tracked separately in `RELEASE-008-BROWSER.md`.

The new runtime/API tests first failed because Image did not exist. The authoring tests first failed for missing family and knowledge. Final focused results are green: 78 runtime/API/contract/inventory/knowledge tests across seven files, and 134 independent source/runtime-evidence/loader/index/all-family authoring tests across five files. The all-family fixture now supplies required props from its selected conditional branch, including meaningful Icon labels. The public package TypeScript fixture also passes separately with no diagnostics. All nine Image Storybook play/accessibility tests pass, and independent browser evidence is green with zero console or page errors. Release 008 generation and the complete final acceptance suite are reserved for the completed primitive set. No historical release/distribution artifacts are edited, and no commit or publication is performed by this capability task.
