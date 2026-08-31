declare const cva: (...arguments_: unknown[]) => unknown
declare const cn: (...arguments_: unknown[]) => string
declare const styles: { root: string }
declare const classes: string
declare const cvaClasses: string
declare const condition: boolean
declare const tone: string
declare const compute: () => Record<string, unknown>
declare const dynamicChild: unknown
declare const dynamicVariants: Record<string, unknown>
declare const Primitive: any
declare const StaticChild: any
declare const unrelated: Record<string, unknown>

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

export { ConditionalRenderFixture, DynamicCvaFixture, DynamicTokenFixture, GenericUtilityFixture, MultipleReturnFixture, RenderCompletenessFixture, ScopedCvaFixture, UnsupportedSpreadFixture, UnrelatedSpreadFixture }
