# Phase 2 Token Contract Scope

This scope is frozen for the approved `shadcn-radix-bootstrap-000` baseline. The canonical theme has precedence over Tailwind defaults. The final expected token count is 82.

The contract includes:

- 31 semantic color tokens.
- 8 canonical radius tokens.
- Geist sans + heading alias.
- Complete named Tailwind typography primitive namespaces.
- One Tailwind spacing base token plus derivation rule.
- Seven standard box-shadow tokens.

The contract boundaries are explicit:

- No raw Tailwind color-palette contract.
- No inferred semantic-to-primitive color links.
- Border color is represented by `color.border`/`color.input`.
- No named border-width token.
- No inset/drop/text shadows.
- No breakpoints/containers/blur/animation.
- No Canvas product tokens.
