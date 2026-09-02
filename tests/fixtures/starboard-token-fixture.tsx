declare function recipe(base: string, config: unknown): (values: unknown) => string
declare function assemble(...values: string[]): string

const panelRecipe = recipe("bg-alert pad-3", {
  variants: {
    tone: {
      urgent: "text-alert",
    },
  },
})

export function ReviewPanel({ tone = "urgent" }: { tone?: "urgent" }) {
  return <section className={assemble(panelRecipe({ tone }), "border-alert")} />
}
