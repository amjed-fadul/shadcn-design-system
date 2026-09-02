declare const cva: (...arguments_: unknown[]) => unknown
declare const cn: (...arguments_: unknown[]) => string
declare const Icon: any
declare const Fallback: any
declare const Primitive: any

const unrelated = "do-not-harvest-this-string"

const recipe = cva("rounded-md", {
  variants: {
    tone: {
      quiet: "text-sm",
    },
  },
  compoundVariants: [
    { tone: "quiet", class: "shadow-sm" },
  ],
})

const compoundOnlyRecipe = cva("", {
  compoundVariants: [
    { className: "shadow-md" },
  ],
})

function TokenFixture({ orientation, active, ...props }: { orientation: "vertical" | "horizontal"; active: boolean }) {
  return (
    <>
      <Icon className="size-3.5" />
      <div className="text-sm" />
      <div className={cn(recipe, compoundOnlyRecipe, "bg-border", orientation === "vertical" && "h-full w-2.5", active ? "ring-ring" : "fill-foreground")} {...props} />
    </>
  )
}

function RenderFixture({ visible, ...props }: { visible: boolean }) {
  return (
    <Primitive.Root {...props}>
      <Primitive.Portal>
        {visible ? <Primitive.Content><Icon /></Primitive.Content> : <><span /><Fallback /></>}
      </Primitive.Portal>
    </Primitive.Root>
  )
}
