# Release 5 Hardening Specification

## Objective

Turn `feat/release-5-command` at `644f2098fd2ff54e66de27b39f951a341421687a` into a governed, release-ready 38-family design-system release without losing its 223 release commits or the 10 commits already on `main`.

## Required outcomes

1. Preserve all 19 original families and all 19 release.5 families: Alert, Alert Dialog, Avatar, Breadcrumb, Collapsible, Command, Drawer, Empty, Field, Input Group, Pagination, Popover, Progress, Radio Group, Slider, Spinner, Switch, Toggle, Toggle Group.
2. Integrate `main` Storybook infrastructure and all original-family stories alongside all release.5 stories.
3. Make component contracts, the component index, source provenance, canonical loader, and knowledge manifest expose exactly the same 38 families.
4. Correct `PopoverTitle` so its public React type, rendered host, inherited interface contract, and tests agree.
5. Make the independent contract audit authoritative for all 38 families with no ignored release.5 mismatches or orphan evidence.
6. Generate and activate a new immutable executable release containing all 38 families and every export from the canonical contract set; preserve release 001 as immutable history.
7. Make normal typecheck, the full test suite, application build, Storybook build/tests, production audit, and full audit pass without allowlists or `continue-on-error` masking.
8. Keep Node pinned to 22.18.0 and keep the current shadcn/Radix design language and source-ownership model.

## Review contract

Every implementation task is committed separately and receives an independent read-only review before the next task begins. Behavioral fixes follow red-green-refactor. Integration/configuration tasks must demonstrate the failing baseline command before the change and the passing command after it.
