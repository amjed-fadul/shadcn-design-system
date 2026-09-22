import * as React from "react"

import { cn } from "@/lib/utils"
import {
  computedRecipe,
  dynamicRecipe,
  importedRecipe as aliasedRecipe,
} from "./imported-cva-recipe"
// @ts-expect-error Deliberately absent default export for authority testing.
import defaultRecipe from "./imported-cva-recipe"
import * as recipeNamespace from "./imported-cva-recipe"
import { importedRecipe as reexportedRecipe } from "./imported-cva-reexport"
import { unrelatedBodyCall } from "./imported-cva-unrelated"

declare const RecipeContext: React.Context<{ tone?: "default" | "danger" }>
declare const recipeName: "importedRecipe"
declare function computeTone(): "default" | "danger"
declare function computeContext(): { tone?: "default" | "danger" }
declare function computeKey(): "tone"

const context = React.useContext(RecipeContext)

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

function UnknownKeyFixture() {
  return <div className={aliasedRecipe({ missing: "default" }) as string} />
}

function UnknownValueFixture() {
  return <div className={aliasedRecipe({ tone: "unknown" }) as string} />
}

function UnsupportedInvocationFixture() {
  return <div className={aliasedRecipe(context) as string} />
}

function ComputedElementSelectorFixture() {
  return <div className={aliasedRecipe({ tone: context[computeKey()] }) as string} />
}

function ArbitraryCallPropertyFixture() {
  return <div className={aliasedRecipe({ tone: computeContext().tone }) as string} />
}

function ParameterShadowFixture(aliasedRecipe: (...arguments_: unknown[]) => string) {
  return <div className={aliasedRecipe({ tone: "default" })} />
}

function LocalShadowFixture() {
  const aliasedRecipe = () => "shadow-sm"
  return <div className={aliasedRecipe()} />
}

function FunctionShadowFixture() {
  function aliasedRecipe() { return "shadow-sm" }
  return <div className={aliasedRecipe()} />
}

function NamespaceImportFixture() {
  return <div className={recipeNamespace.importedRecipe() as string} />
}

function DefaultImportFixture() {
  return <div className={defaultRecipe() as string} />
}

function ReexportFixture() {
  return <div className={reexportedRecipe() as string} />
}

function AliasChainFixture({ tone = "default" }: { tone?: "default" | "danger" }) {
  const first = tone
  const second = first
  return <div className={aliasedRecipe({ tone: second }) as string} />
}

function UnrelatedBodyCallFixture() {
  const visible = unrelatedBodyCall()
  return <div className={aliasedRecipe() as string}>{visible ? "visible" : "hidden"}</div>
}

function CatchShadowFixture() {
  try {
    throw (() => "shadow-sm")
  } catch (aliasedRecipe) {
    if (typeof aliasedRecipe !== "function") return null
    return <div className={aliasedRecipe()} />
  }
}

function ForShadowFixture() {
  for (let aliasedRecipe = () => "shadow-sm"; ;) {
    return <div className={aliasedRecipe()} />
  }
}

function ForOfShadowFixture() {
  for (const aliasedRecipe of [() => "shadow-sm"]) {
    return <div className={aliasedRecipe()} />
  }
  return null
}

function ForInShadowFixture() {
  for (const aliasedRecipe in { value: true }) {
    // @ts-expect-error The loop key deliberately shadows the imported callable.
    return <div className={aliasedRecipe()} />
  }
  return null
}

function SwitchShadowFixture() {
  switch ("value") {
    case "value":
      const aliasedRecipe = () => "shadow-sm"
      return <div className={aliasedRecipe()} />
  }
}

function PublicPropLocalShadowFixture({ tone }: { tone?: "default" | "danger" }) {
  {
    const tone = computeTone()
    return <div className={aliasedRecipe({ tone }) as string} />
  }
}

function WrappedRecipeFixture() {
  const recipeWrapper = () => aliasedRecipe()
  return <div className={cn("shadow-sm", recipeWrapper())} />
}

function LocalAndImportedFixture() {
  return <div className={cn("px-2 h-0", aliasedRecipe())} />
}

function MappedImportedRecipeFixture() {
  return <>{["first", "second"].map((item) => <div key={item} className={aliasedRecipe()} />)}</>
}

function NestedImportedRecipeFixture() {
  const renderItem = () => <div className={aliasedRecipe()} />
  return <>{renderItem()}</>
}

function MappedWrongRecipeFixture() {
  return <>{["first"].map((item) => <div key={item} className={reexportedRecipe()} />)}</>
}

function NestedDefaultRecipeFixture() {
  const renderItem = () => <div className={defaultRecipe()} />
  return <>{renderItem()}</>
}

function MappedNamespaceRecipeFixture() {
  return <>{["first"].map((item) => <div key={item} className={recipeNamespace.importedRecipe()} />)}</>
}

function MappedShadowRecipeFixture() {
  return <>{[() => "shadow-sm"].map((aliasedRecipe) => <div className={aliasedRecipe()} />)}</>
}

function UnusedNestedRecipeFixture() {
  const unusedRender = () => <div className={defaultRecipe()} />
  return <>{unusedRender() && <div className="shadow-sm" />}</>
}

function RecipeOutsideClassRootFixture() {
  const ignored = aliasedRecipe()
  return <div className="shadow-sm">{String(ignored)}</div>
}

async function DynamicImportFixture() {
  const recipes = await import("./imported-cva-recipe")
  return <div className={recipes[recipeName]({}) as string} />
}

export {
  AliasChainFixture,
  AmbiguousInvocationFixture,
  AmbiguousDataFlowFixture,
  ArbitraryCallPropertyFixture,
  CatchShadowFixture,
  ComputedElementSelectorFixture,
  DefaultImportFixture,
  DynamicImportFixture,
  ForInShadowFixture,
  ForOfShadowFixture,
  ForShadowFixture,
  FunctionShadowFixture,
  ImportedComputedConfigFixture,
  ImportedDefaultsFixture,
  ImportedDynamicConfigFixture,
  ImportedDynamicFixture,
  ImportedStaticFixture,
  LocalShadowFixture,
  LocalAndImportedFixture,
  MappedImportedRecipeFixture,
  MappedNamespaceRecipeFixture,
  MappedShadowRecipeFixture,
  MappedWrongRecipeFixture,
  NamespaceImportFixture,
  NestedDefaultRecipeFixture,
  NestedImportedRecipeFixture,
  ParameterShadowFixture,
  PublicPropLocalShadowFixture,
  RecipeOutsideClassRootFixture,
  ReexportFixture,
  SwitchShadowFixture,
  UnknownKeyFixture,
  UnknownValueFixture,
  UnrelatedBodyCallFixture,
  UnsupportedInvocationFixture,
  UnusedNestedRecipeFixture,
  WrappedRecipeFixture,
}
