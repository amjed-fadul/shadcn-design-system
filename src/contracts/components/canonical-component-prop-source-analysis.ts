import { readdirSync } from "node:fs"
import { join } from "node:path"

import ts from "typescript"

import { createComponentPropSourceAnalyzer } from "./component-prop-source-analysis"

const analyzers = new Map<string, ReturnType<typeof createComponentPropSourceAnalyzer>>()

/** Canonical path/module policy layered over the design-system-neutral prop analyzer. */
export function canonicalComponentPropSourceAnalyzer(repositoryRoot: string) {
  let analyzer = analyzers.get(repositoryRoot)
  if (!analyzer) {
    const componentRoot = join(repositoryRoot, "src/components/ui")
    analyzer = createComponentPropSourceAnalyzer({
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
        baseUrl: repositoryRoot,
        paths: { "@/*": ["src/*"] },
      },
    })
    analyzers.set(repositoryRoot, analyzer)
  }
  return analyzer
}
