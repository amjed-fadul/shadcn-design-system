declare const cva: (...arguments_: unknown[]) => (...arguments_: unknown[]) => string

const importedRecipe = cva("shadow-sm", {
  variants: {
    tone: {
      default: "bg-background",
    },
  },
})

export { importedRecipe }
