# Canonical token source

Phase 1 freezes the source values only. Machine-readable token contracts are created in Phase 2.

## Included

- Neutral shadcn semantic color tokens for light and dark modes.
- Sidebar semantic tokens shipped by the neutral shadcn theme.
- Radius source `--radius: 0.625rem` and the derived radius scale exposed through Tailwind.
- Geist Variable as the canonical sans/heading font used by the current Canvas shadcn implementation.

## Excluded

Canvas-specific host chrome, selection, ready-status, experiment-status, and other product tokens are intentionally excluded. They belong to the Canvas product, not to this reusable shadcn design system.

## Provenance

See `provenance/token-source.json` for the pinned upstream release/commit and the Canvas source used as compatibility evidence.
