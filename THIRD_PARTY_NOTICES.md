# Third-party notices

The copyright notice in [COPYRIGHT](COPYRIGHT) covers the original work in this repository. The third-party material listed here stays under its own licence.

## shadcn/ui

- Project: [shadcn-ui/ui](https://github.com/shadcn-ui/ui)
- Release: `shadcn@4.19.0`, commit `1773ecfeeb4a04366978d353e69b5c7ded78dcb2` (radix base, nova style)
- Licence: MIT, full text below

### Files derived from shadcn/ui

**Components.** 38 of the 42 component families in `src/components/ui/` derive from shadcn/ui. `provenance/seed-components.json` records an upstream source for each one. The derived file is `src/components/ui/<family>.tsx`:

`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `input`, `input-group`, `label`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`.

37 of these are modified derivatives (`semantic-token-normalized-derivative`). `collapsible` is a thin upstream wrapper (`upstream-wrapper`). The changes are listed under `derivation.operations` in `provenance/seed-components.json`, and the files are not claimed to be byte-identical to upstream.

These are original to this repository and are not derived from shadcn/ui:

- the 4 `repo-native` families: `chart` (`chart.tsx`, `chart-model.ts`), `icon`, `image` and `link`

The Storybook stories (`src/components/ui/*.stories.tsx`) were written for this repository. Some reuse the example copy from shadcn/ui's documentation demos, for example the alert dialog's "Are you absolutely sure?" text.

**Theme stylesheet.** `src/index.css` takes its semantic light and dark colour tokens from shadcn/ui's neutral theme (`apps/v4/public/r/colors/neutral.json` at the commit above), as `provenance/token-source.json` records. It also keeps the shadcn CLI theme scaffold: the `@theme inline` variable mapping and the `@layer base` rules for borders, outlines and the body.

**Shared helpers.**

- `src/hooks/use-mobile.ts`, shadcn/ui's `useIsMobile` hook
- `src/lib/utils.ts`, shadcn/ui's `cn` class-name helper

**Vendored stylesheet.** `src/vendor/shadcn/tailwind.css` is copied unchanged from the `shadcn@4.19.0` npm package (`dist/tailwind.css`). Its upstream licence is kept beside it in `src/vendor/shadcn/LICENSE.md`. `src/vendor/shadcn/vendored.json` records the package, its integrity and the SHA-256 of each vendored file.

### MIT licence (shadcn/ui)

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Built packages

The library build (`npm run build:library`) bundles third-party code into `dist-library/`. That code includes:

- Radix UI, cmdk, vaul, class-variance-authority, clsx, tailwind-merge and lucide-react
- Recharts and its dependencies, in the `./charts` entry
- Tailwind CSS, tw-animate-css and the shadcn stylesheet
- the Geist variable font from `@fontsource-variable/geist`, licensed under the SIL Open Font License 1.1 (OFL-1.1)

React and React DOM are peer dependencies and are not bundled.

Each built package ships licence notices for what it bundles in `dist-library/THIRD_PARTY_LICENSES.txt`, which `scripts/library-licenses.ts` generates at build time. The Release 012 package's file lists 92 packages under the MIT, ISC, Apache-2.0, 0BSD and OFL-1.1 licences. The generator reads files named LICENSE, LICENCE, COPYING or CopyrightNotice, so two notices are incomplete there and are given here instead:

- `react-remove-scroll-bar` (MIT) publishes no licence file, so its entry carries only its declared licence, author and README. Its licence is the standard MIT licence above, with its own copyright holder.
- `es-toolkit` (MIT) ships a NOTICE file, which the generator does not read. Recharts imports `es-toolkit/compat`, which es-toolkit states is partly derived from Lodash. Lodash's notice follows.

### Lodash notice (via es-toolkit)

As published in `es-toolkit`'s NOTICE file:

```text
Copyright OpenJS Foundation and other contributors <https://openjsf.org/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

The following license applies to all parts of this software except as
documented below:

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

These gaps will be closed in the generator with the next release, when the release inputs are next recorded.
