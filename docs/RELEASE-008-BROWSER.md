# Release 008 browser evidence

The Icon browser check loads the Storybook iframe IDs declared by `src/components/ui/icon.stories.tsx` from the running Storybook index at `http://127.0.0.1:6008`. It verifies the Geist Variable font response, the 14/16/20 px sizes, meaningful and decorative SVG semantics, Button names and loading behavior, logical versus physical arrow rotation in RTL, and inherited foreground colors in the Dark story. The run also captures console and page errors.

Run it with the pinned toolchain while Storybook is available:

```sh
/Users/amjedfadul/.volta/bin/volta run --node 22.18.0 --npm 10.9.3 node tests/release008-primitives.browser.mjs
```

The Icon check passed in Chromium `145.0.7632.6`. It found no console or page errors, loaded `Geist Variable` from a successful `200` font response, measured the three expected sizes, and observed the expected RTL transforms: logical arrows rotated `180deg`; physical arrows remained unrotated. In Dark, the labeled Information icon inherited `--foreground` (`oklch(0.985 0 0)`) and kept its `img` role and accessible name. The Search button icon inherited the button’s `--primary-foreground` (`oklch(0.145 0 0)`). The loading Button kept its accessible name, disabled state, and busy state while hiding its authored Icon and exposing a decorative hidden spinner.

The machine-readable evidence and screenshots are stored outside the checkout at `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`:

- [Browser evidence JSON](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-browser-evidence.json)
- [Sizes](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-sizes.png)
- [Accessibility](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-accessibility.png)
- [Buttons](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-buttons.png)
- [RTL](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-rtl.png)
- [Dark](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-dark.png)

### Icon semantic colors

The Icon browser check now also opens the source-derived `Colors`, `ColorsDark`, and `ColorsRtl` stories independently and validates their Storybook index entries. It measures SVG `currentColor` stroke paint against each exact semantic CSS token, checks the four explicit color variants and inherited default, confirms accessible labels stay present, measures contrast on the supplied semantic background, and verifies that Icons inside a Button inherit its foreground.

All three color stories passed in Chromium `145.0.7632.6` with zero console/page errors; Geist Variable loaded with HTTP `200`. Each explicit color matched its corresponding token, retained its accessible `img` name and `currentColor` stroke, and exceeded `3:1` on the supplied background. Foreground, Primary, Muted Foreground, and Destructive colors changed with the Light/Dark theme. RTL preserved the Light token colors without rotation or mirroring, and the Button-contained Icon inherited the Button foreground in both themes.

- [Light semantic colors](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-colors-light.png)
- [Dark semantic colors](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-colors-dark.png)
- [RTL semantic colors](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/icon-colors-rtl.png)

## Image

The Image browser check derives the Storybook IDs from `src/components/ui/image.stories.tsx`, confirms those stories are present in the running index, and opens the iframe stories at `http://127.0.0.1:6008`. It verifies natural image loading, meaningful and empty-alt semantics, intrinsic dimensions and responsive proportions, fixed-box `contain` and `cover` behavior, Light and Dark semantic backgrounds, native eager/lazy loading attributes, and no transform or mirroring in RTL. It also checks for console/page errors and confirms the Geist font loaded over the network.

Run it with the pinned toolchain while Storybook is available:

```sh
/Users/amjedfadul/.volta/bin/volta run --node 22.18.0 --npm 10.9.3 node tests/release008-image.browser.mjs
```

The Image check passed in Chromium `145.0.7632.6` with no console or page errors. Meaningful alternatives were exposed as named images; the decorative image with `alt=""` had no image role. The constrained image preserved its 640×360 intrinsic ratio in a 192×108 box. Both fill images occupied a definite 192×192 parent, with computed `contain` and `cover` fits. Light and Dark resolved to different semantic background values, and the RTL image remained untransformed. Eager and lazy stories retained their native `loading` attributes. Geist loaded from a successful `200` font response.

The machine-readable evidence and screenshots are stored outside the checkout at `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`:

- [Browser evidence JSON](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-browser-evidence.json)
- [Default](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-default.png)
- [Decorative](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-decorative.png)
- [Constrained](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-constrained.png)
- [Fill](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-fill.png)
- [Light](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-light.png)
- [Dark](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-dark.png)
- [RTL](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/image-rtl.png)

## Toggle Group

The Toggle Group browser check derives each Storybook ID from `src/components/ui/toggle-group.stories.tsx`, verifies the stories against the running index, and opens their iframe previews at `http://127.0.0.1:6008`. It measures selected and hovered item paint, checks selection behavior for single and multiple groups, inspects native disabled semantics and keyboard focus styling, exercises RTL arrow navigation and logical edge rounding, and confirms the standalone Toggle keeps its existing muted pressed treatment.

Run it with the pinned toolchain while Storybook is available:

```sh
/Users/amjedfadul/.volta/bin/volta run --node 22.18.0 --npm 10.9.3 node tests/release008-toggle-group.browser.mjs
```

The check passed in Chromium `145.0.7632.6` with no console or page errors. Actual selected item paint matched the semantic primary pair at `6.824:1` in Light and `7.506:1` in Dark. Selected paint remained stable on hover; selected-to-unselected-hover background contrast measured `6.256:1` and `5.732:1`, respectively, while each hovered label exceeded `4.5:1`. Keyboard focus showed the semantic ring with a 2px background-colored offset. Single selection remained exclusive, multiple selection toggled independently, disabled items exposed native disabled state at 50% opacity, and RTL ArrowLeft moved to the visually adjacent item while preserving logical rounded corners. The standalone Toggle still uses the muted token when pressed. Geist Variable loaded with a successful `200` font response.

Machine-readable evidence and screenshots are stored outside the checkout at `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`:

- [Browser evidence JSON](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/toggle-group-browser-evidence.json)
- [Light](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/toggle-group-light.png)
- [Dark](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/toggle-group-dark.png)
- [Keyboard focus](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/toggle-group-focus.png)
- [RTL](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/toggle-group-rtl.png)

## Link

The Link browser check derives Storybook IDs from `src/components/ui/link.stories.tsx`, confirms all entries against the running Storybook index, and opens each preview in an iframe at `http://127.0.0.1:6008`. It checks native accessible anchors and preserved internal, fragment, external, `mailto:`, and `tel:` destinations without activating the external or OS-handled links. It verifies `_blank`/`noopener` and the visible new-tab announcement without opening the external destination, keyboard focus ring and native hash navigation, natural inline wrapping, Light/Dark primary color contrast, and RTL direction. The check also enforces no forced icons, disabled semantics, console errors, or page errors, and verifies a successful network font response.

Run it with the pinned toolchain while Storybook is available:

```sh
/Users/amjedfadul/.volta/bin/volta run --node 22.18.0 --npm 10.9.3 node tests/release008-link.browser.mjs
```

The check passed in Chromium `145.0.7632.6` with zero console or page errors. The real primary link paint measured `6.824:1` against the Light background and `7.506:1` against Dark. Keyboard focus showed the semantic ring with a 2px background-colored offset; Enter followed the local `#link-details` hash. The long link wrapped over four text lines while remaining inline, RTL text retained its direction without transforms, all five destination types preserved their hrefs, and new-tab attributes were `target="_blank" rel="noopener"` with the behavior announced in the link name. Geist Variable loaded with an HTTP `200` response.

Machine-readable evidence and screenshots are stored outside the checkout at `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`:

- [Browser evidence JSON](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-browser-evidence.json)
- [Default](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-default.png)
- [New tab](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-new-tab.png)
- [Keyboard focus](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-focus.png)
- [Inline wrapping](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-multiline.png)
- [Light](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-light.png)
- [Dark](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-dark.png)
- [RTL](/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/link-rtl.png)
