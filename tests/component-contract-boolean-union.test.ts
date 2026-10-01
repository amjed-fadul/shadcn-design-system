import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, test } from "vitest"
import { createComponentPropSourceAnalyzer } from "../src/contracts/components/component-prop-source-analysis"

test("derives conditional label authority from a boolean discriminated component API", () => {
  const analyzer = createComponentPropSourceAnalyzer({ compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true,
    baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
  } })
  const analysis = analyzer.analyzeComponentPropSource(fileURLToPath(new URL("../src/components/ui/icon.tsx", import.meta.url)), "Icon")
  expect((analysis as unknown as { conditionalApi?: unknown }).conditionalApi).toEqual([
    { when: { propName: "decorative", equals: false }, propRefinements: [{ propName: "label", availability: "available", required: true, type: { kind: "string" }, evidenceRefs: ["source"] }], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
    { when: { propName: "decorative", equals: true }, propRefinements: [{ propName: "label", availability: "unavailable", evidenceRefs: ["source"] }], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
  ])
})
