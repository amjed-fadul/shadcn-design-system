import {
  computedRecipe,
  dynamicRecipe,
  importedRecipe as aliasedRecipe,
} from "./imported-cva-recipe"

declare const context: { tone?: "default" | "danger" }
declare const recipeName: "importedRecipe"
declare function computeTone(): "default" | "danger"

function ImportedDynamicFixture({
  tone = "default",
  size = "default",
}: {
  tone?: "default" | "danger"
  size?: "default" | "sm"
}) {
  const resolvedTone = context.tone ?? tone
  return <div className={aliasedRecipe({ tone: resolvedTone, size }) as string} />
}

function ImportedDefaultsFixture() {
  return <div className={aliasedRecipe() as string} />
}

function ImportedStaticFixture() {
  return <div className={aliasedRecipe({ tone: "danger", size: "sm" }) as string} />
}

function ImportedDynamicConfigFixture() {
  return <div className={dynamicRecipe() as string} />
}

function ImportedComputedConfigFixture() {
  return <div className={computedRecipe() as string} />
}

function AmbiguousInvocationFixture() {
  return <div className={aliasedRecipe({ ...context }) as string} />
}

function AmbiguousDataFlowFixture() {
  const computedTone = computeTone()
  return <div className={aliasedRecipe({ tone: computedTone }) as string} />
}

async function DynamicImportFixture() {
  const recipes = await import("./imported-cva-recipe")
  return <div className={recipes[recipeName]({}) as string} />
}

export {
  AmbiguousInvocationFixture,
  AmbiguousDataFlowFixture,
  DynamicImportFixture,
  ImportedComputedConfigFixture,
  ImportedDefaultsFixture,
  ImportedDynamicConfigFixture,
  ImportedDynamicFixture,
  ImportedStaticFixture,
}
