import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import {
  analyzeComponentTokenDependenciesForExport,
  analyzeTailwindTokenDependencies,
  auditComponentTokenCoverage,
} from "../src/contracts/components/canonical-token-source-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))

function spacing(multiplier: number) {
  return {
    tokenId: "spacing.unit",
    viaDerivedRule: { id: "spacing.multiplier", multiplier },
    evidenceRefs: ["source"],
  }
}

describe("canonical signed Tailwind spacing analysis", () => {
  test.each([
    ["right-1", 1],
    ["-right-1", -1],
    ["-mx-1", -1],
    ["-top-2", -2],
    ["-ml-1.5", -1.5],
  ] as const)("resolves %s through spacing.multiplier", (utility, multiplier) => {
    expect(analyzeTailwindTokenDependencies(utility)).toEqual([spacing(multiplier)])
  })

  test("preserves Tabs ancestor applicability and pseudo-element target without inventing when", () => {
    const dependencies = analyzeTailwindTokenDependencies("group-data-[orientation=vertical]/tabs:after:-right-1")

    expect(dependencies).toEqual([{
      ...spacing(-1),
      sourceContext: {
        applicability: ["group-data-[orientation=vertical]/tabs"],
        target: { kind: "pseudo-element", name: "after" },
      },
    }])
    expect(dependencies[0]).not.toHaveProperty("when")
  })

  test("keeps the Sidebar ancestor conjunction atomic without inventing when", () => {
    const dependencies = analyzeTailwindTokenDependencies("[[data-side=left][data-collapsible=offcanvas]_&]:-right-2")

    expect(dependencies).toEqual([{
      ...spacing(-2),
      sourceContext: {
        applicability: ["[[data-side=left][data-collapsible=offcanvas]_&]"],
      },
    }])
    expect(dependencies[0]).not.toHaveProperty("when")
  })

  test("records a target-only pseudo-element context without fake applicability or when", () => {
    const dependencies = analyzeTailwindTokenDependencies("after:-inset-2")

    expect(dependencies).toEqual([{
      ...spacing(-2),
      sourceContext: {
        applicability: [],
        target: { kind: "pseudo-element", name: "after" },
      },
    }])
    expect(dependencies[0]).not.toHaveProperty("when")
  })

  test.each([
    "-translate-x-1/2",
    "-rotate-45",
    "bottom-[-5px]",
    "-size-1",
    "-h-1",
    "-p-1",
    "-gap-1",
  ])("does not classify unrelated or arbitrary negative utility %s as spacing", (utility) => {
    expect(analyzeTailwindTokenDependencies(utility)).toEqual([])
  })

  test("classifies canonical negative spacing coverage as resolved-approved-token", () => {
    const findings = auditComponentTokenCoverage(join(root, "src/components/ui/dropdown-menu.tsx"))

    expect(findings).toContainEqual({
      utility: "-mx-1",
      classification: "resolved-approved-token",
      tokenId: "spacing.unit",
      namespace: "spacing",
    })
  })

  test("preserves existing local CVA when semantics for positive spacing", () => {
    const dependencies = analyzeComponentTokenDependenciesForExport(join(root, "src/components/ui/button.tsx"), "Button")

    expect(dependencies).toContainEqual(expect.objectContaining({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 8 },
      when: { propName: "size", equals: "default" },
    }))
  })
})
