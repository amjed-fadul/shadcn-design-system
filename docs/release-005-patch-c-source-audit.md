# Release 005 Patch C source audit

Canonical source: `src/components/ui/toggle-group.tsx` at the Patch B source blob. This patch records its behavior without changing the runtime component.

`ToggleGroupContext` is created with standalone defaults `size="default"`, `variant="default"`, `spacing=2`, and `orientation="horizontal"`. `ToggleGroup` destructuring defaults `variant`, `size`, `spacing`, and `orientation` when their props are `undefined`, then passes those local bindings to the provider. Its root writes explicit `data-slot`, `data-variant`, `data-size`, `data-spacing`, and `data-orientation` attributes before the final public prop spread. A forwarded group `data-*` value can therefore replace a root attribute while the provider retains the local binding.

`ToggleGroupItem` defaults local `variant` and `size` to `"default"`. It reads the context with `React.useContext`. `resolvedVariant = context.variant ?? variant` and `resolvedSize = context.size ?? size`, so any non-nullish context value wins, including a false or empty value if supplied at runtime. A nullish context value selects the local prop/default. `data-spacing` reads `context.spacing` directly. The item writes these three attributes and `data-slot` before its final public prop spread; forwarded item `data-*` values can replace final attributes. The class recipe still receives `resolvedVariant` and `resolvedSize`, so a forwarded attribute need not match the chosen class recipe.

The standalone React context default is populated. Radix's `ToggleGroupPrimitive.Item` requires its Root and rejects a standalone item render. The context default remains a source fact; it is not a claim that a standalone item produces DOM.

The full producer contract uses closed context fields, nullish coalescing, and ordered JSX writes. The executable projection continues to carry public API and composition facts without copying render internals. Toggle Group factual contract is resolved; Canvas still requires an explicit authoring-policy decision.
