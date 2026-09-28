import { readdirSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"

import ts from "typescript"

import { createComponentPropSourceAnalyzer } from "./component-prop-source-analysis"

/** Canonical path/module policy layered over the design-system-neutral prop analyzer. */
export function canonicalComponentPropSourceAnalyzer(repositoryRoot: string) {
  const normalizedRoot = realpathSync.native(resolve(repositoryRoot))
  const componentRoot = join(normalizedRoot, "src/components/ui")
  return createComponentPropSourceAnalyzer({
    rootNames: readdirSync(componentRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
      .map((entry) => join(componentRoot, entry.name)),
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      baseUrl: normalizedRoot,
      paths: { "@/*": ["src/*"] },
    },
  })
}
