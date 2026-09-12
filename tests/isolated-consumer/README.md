# Release 004 isolated consumer proof

Use Node 22.18.0 and run the frozen literal candidate only:

```sh
PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH node tests/isolated-consumer/run.mjs --tarball /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz
```

The runner fails closed unless the fixture package and lock name the approved R4 archive, SHA-256, and npm integrity. It creates a fresh temporary React 18.3.1 consumer, with no workspace or producer-source fallback, and proves the package root, stylesheet, and release entrypoints resolve from installed tarball bytes. It also verifies that consumer and package share exactly one physical React and React DOM runtime.

The production-build Chromium proof keeps component props and host dimensions fixed at two browser widths, then changes only `isMobile`. It exercises independent desktop/mobile state channels, a cancelled trigger click, and desktop `collapsible="none"`. For the mobile Sheet it mounts through the supplied portal container inside a finite transformed host, checks numerical containment and physical side for LTR/RTL × left/right, and verifies Escape restores focus to the visible Sidebar trigger. It also confirms that core does not write persistence cookies, register an initial global keyboard listener, or react to Cmd/Ctrl+B.

The standalone portal entrypoint is intentionally the same proof, so package identity and browser evidence cannot drift:

```sh
PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH node tests/isolated-consumer/portal-proof.mjs --tarball /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz
```
