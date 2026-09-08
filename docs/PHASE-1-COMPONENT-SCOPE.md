# Phase 1 Studio V1 component scope

This is the approved minimum component vocabulary for the Studio V1 workload. It is a Phase 1 source/scope decision, not a token or component contract.

## Included

- Existing seeds: Button, Badge, Input, Separator, Skeleton
- Form/layout primitives: Card, Label, Textarea, Checkbox, Table
- Compound controls: Tabs, Select, Dropdown Menu, Accordion
- Portal/overlay controls: Dialog, Sheet, Tooltip
- Scroll/layout and product shell: Scroll Area, Sidebar
- Form control (added under release 003 component governance): Switch

The set covers Studio V1's approved product surfaces: Overview, Design System, Changelog, and Settings; component Interact/Anatomy views; settings and control forms; release/token/component tables; detail drawers; action menus; disclosure sections; and persistent navigation.

## Explicit exclusions

No calendar, date picker, chart, carousel, command palette, popover, pagination, radio group, slider, toast, or other shadcn source is included. Those are deferred until a concrete Studio V1 screen requires them.

Sidebar is included because persistent navigation is a Studio V1 product requirement. Its canonical implementation is a semantic-token-normalized derivative of the pinned upstream source and is intentionally desktop-first; it does not introduce a product-specific Canvas token or package dependency.

## Scope changes since initial approval

Switch was explicitly deferred at initial Phase 1 approval (see prior revision of the exclusions list above). Release 003 component governance (task A3) added it as a twentieth family: settings and control forms on the approved Studio V1 surfaces require a boolean toggle control, `@radix-ui/react-switch` was already an installed transitive dependency of the pinned `radix-ui` package, and the component follows the same Radix-primitive, controlled/uncontrolled-boolean shape already approved for Checkbox. This is recorded here as a deliberate scope change, not a silent gap-fill.

## Provenance rule

Every included component is recorded in `provenance/seed-components.json` with the exact upstream path and blob SHA at shadcn `4.19.0` / commit `1773ecfeeb4a04366978d353e69b5c7ded78dcb2`, plus the local canonical blob SHA and derivative operations. The shadcn CLI version alone is not treated as sufficient evidence for generated registry output.
