declare const cva: (...arguments_: unknown[]) => (...arguments_: unknown[]) => string
declare const dynamicConfiguration: Record<string, unknown>
declare const dynamicVariantName: string

const importedRecipe = cva("rounded-lg text-sm", {
  variants: {
    tone: {
      default: "bg-background",
      danger: "bg-destructive",
    },
    size: {
      default: "h-0",
      sm: "h-2.5",
    },
  },
  defaultVariants: {
    tone: "default",
    size: "default",
  },
})

const dynamicRecipe = cva("rounded-md", dynamicConfiguration)

const computedRecipe = cva("shadow-sm", {
  variants: {
    [dynamicVariantName]: {
      default: "shadow-md",
    },
  },
})

export { computedRecipe, dynamicRecipe, importedRecipe }
