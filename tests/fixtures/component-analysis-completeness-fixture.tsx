declare const cva: (...arguments_: unknown[]) => unknown
declare const cn: (...arguments_: unknown[]) => string
declare const styles: { root: string }
declare const classes: string
declare const cvaClasses: string
declare const condition: boolean
declare const tone: string
declare const compute: { (): Record<string, unknown>; (value: unknown): unknown }
declare const computeSomething: () => boolean
declare const dynamicChild: unknown
declare const dynamicVariants: Record<string, unknown>
declare const Primitive: any
declare const StaticChild: any
declare const unrelated: Record<string, unknown>
declare const Tooltip: any
declare const TooltipTrigger: any
declare const TooltipContent: any

function DynamicTokenFixture() {
  return (
    <>
      <div className={styles.root} />
      <div className={`bg-${tone}`} />
      <div className={cn("bg-border", condition && classes)} />
    </>
  )
}

function ScopedCvaFixture({ ...rest }: Record<string, unknown>) {
  const variants = cva("text-sm", {
    variants: {
      size: { sm: "h-2.5" },
    },
    compoundVariants: [{ size: "sm", class: "shadow-sm", className: "bg-border" }],
  })

  if (condition) {
    const variants = cva("rounded-lg", { compoundVariants: [{ className: "shadow-md" }] })
    return <div className={cn(variants)} />
  }

  const baseOnly = cva("font-medium")
  const dynamicBase = cva(cvaClasses)
  return <div {...rest} className={cn(variants, baseOnly, dynamicBase)} />
}

function GenericUtilityFixture() {
  return <div className="rounded-[7px] rounded-[inherit] text-current" />
}

function DynamicCvaFixture() {
  const variants = cva("text-sm", { variants: dynamicVariants })
  const spreadVariants = cva("font-medium", { variants: { ...dynamicVariants } })
  const configSpread = cva("rounded-md", { ...dynamicVariants })
  const variantValueSpread = cva("rounded-lg", { variants: { size: { ...dynamicVariants } } })
  const compoundSpread = cva("shadow-sm", { compoundVariants: [{ ...dynamicVariants }] })
  return <div className={cn(variants, spreadVariants, configSpread, variantValueSpread, compoundSpread)} />
}

function RenderCompletenessFixture({ className, ...rest }: { className?: string; id?: string }) {
  return <Primitive.Root {...rest} {...unrelated} data-slot="static" data-x={compute()}>{className ? <StaticChild /> : dynamicChild}</Primitive.Root>
}

function UnsupportedSpreadFixture(props: Record<string, unknown>) {
  return <Primitive.Root {...compute()} data-state={condition ? "open" : tone} {...props} />
}

function UnsupportedConditionalPresenceFixture({ flag }: { flag: boolean }) {
  return <Primitive.Root data-state={flag || undefined} />
}

function ArbitraryLocalConditionalValueFixture() {
  const flag = computeSomething()
  return <Primitive.Root data-state={flag ? "a" : "b"} />
}

function ArbitraryLocalConditionalArmFixture({ enabled }: { enabled: boolean }) {
  const value = computeSomething()
  return <Primitive.Root data-state={enabled ? value : ""} />
}

function ArbitraryLocalReturnFixture() {
  const flag = computeSomething()
  if (flag) return <Primitive.Root />
  return <Primitive.Fallback />
}

function UnrelatedSpreadFixture() {
  return <Primitive.Root {...unrelated} />
}

function ConditionalRenderFixture({ condition, ...rest }: { condition: boolean }) {
  return <Primitive.Root {...rest}>{condition && <StaticChild />}{condition ? <StaticChild /> : <Primitive.Root />}</Primitive.Root>
}

function MultipleReturnFixture({ condition, ...rest }: { condition: boolean }) {
  if (condition) return <Primitive.Root {...rest}><StaticChild /></Primitive.Root>
  return <Primitive.Root {...rest} />
}

function DerivedAttributeFixture({ mode = "a", ...rest }: { mode?: "a" | "b" }) {
  return <Primitive.Root data-match={mode === "a"} {...rest} />
}

function UnsupportedDerivedAttributeFixture({ mode = "a", ...rest }: { mode?: "a" | "b" }) {
  return <Primitive.Root data-match={compute(mode)} {...rest} />
}

function ConditionalRootFixture({ collapsible, isMobile, ...rest }: { collapsible: "none" | "offcanvas"; isMobile: boolean }) {
  if (collapsible === "none") return <div {...rest} />
  if (isMobile) return <Primitive.Sheet {...rest} />
  return <div {...rest} />
}

function ConditionalValueFixture({ collapsible, state, ...rest }: { collapsible: string; state: string }) {
  return <Primitive.Root data-collapsible={state === "collapsed" ? collapsible : ""} {...rest} />
}

function ArbitraryLocalEqualityFixture() {
  const state = tone
  return <Primitive.Root data-collapsible={state === "collapsed" ? "a" : ""} />
}

function JsxAliasFixture({ tooltip, ...rest }: { tooltip?: string | Record<string, unknown> }) {
  const button = <Primitive.Button {...rest} />
  if (!tooltip) return button
  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip
  return <Tooltip><TooltipTrigger>{button}</TooltipTrigger><TooltipContent {...tooltipProps} /></Tooltip>
}

function UnsupportedDerivedSpreadFixture({ tooltip, ...rest }: { tooltip?: string }) {
  const tooltipProps = compute(tooltip) as Record<string, unknown>
  return <Primitive.Content {...tooltipProps} {...rest} />
}

function UnsupportedReturnConditionFixture({ condition, mode, ...rest }: { condition: boolean; mode?: { value: boolean } }) {
  if (condition) return <Primitive.Known {...rest} />
  if (mode?.value) return <Primitive.Unknown {...rest} />
  return <Primitive.Fallback {...rest} />
}

export { ArbitraryLocalConditionalArmFixture, ArbitraryLocalConditionalValueFixture, ArbitraryLocalEqualityFixture, ArbitraryLocalReturnFixture, ConditionalRenderFixture, ConditionalRootFixture, ConditionalValueFixture, DerivedAttributeFixture, DynamicCvaFixture, DynamicTokenFixture, GenericUtilityFixture, JsxAliasFixture, MultipleReturnFixture, RenderCompletenessFixture, ScopedCvaFixture, UnsupportedConditionalPresenceFixture, UnsupportedDerivedAttributeFixture, UnsupportedDerivedSpreadFixture, UnsupportedReturnConditionFixture, UnsupportedSpreadFixture, UnrelatedSpreadFixture }
