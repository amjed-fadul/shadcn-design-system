declare const cva: (...arguments_: unknown[]) => (...arguments_: unknown[]) => string

const conditionalRecipe = cva("rounded-lg", {
  variants: {
    tone: {
      default: "data-[state=open]:bg-background",
      danger: "data-[state=closed]:bg-destructive",
    },
  },
})

function ConditionalUtilityFixture() {
  return (
    <div
      className="data-[size=sm]:rounded-md group-data-[orientation=vertical]/root:data-[spacing=0]:gap-2 dark:hover:data-[state=open]:bg-background"
    />
  )
}

function RecipeAndUtilityConditionFixture({ tone }: { tone?: "default" | "danger" }) {
  return <div className={conditionalRecipe({ tone })} />
}

function MalformedUtilityFixture() {
  return (
    <div className="data-[size=sm:rounded-md data-[${dimension}=sm]:rounded-lg mystery-data-[size=sm]:bg-background [&:has([data-size=sm])]:bg-destructive" />
  )
}

declare const dimension: string

export {
  ConditionalUtilityFixture,
  MalformedUtilityFixture,
  RecipeAndUtilityConditionFixture,
}
