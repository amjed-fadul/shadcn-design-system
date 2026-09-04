import { describe, expect, test } from "vitest"

import { createTokenSourceAnalyzer } from "../src/contracts/components/token-source-analysis"
import type { TokenDependency } from "../src/contracts/components/types"

function resolveFixtureUtility(utility: string) {
  if (utility === "bg-signal") return { tokenId: "color.signal" }
  const spacing = utility.match(/^(-?)(?:mx|right|left|inset)-(\d+(?:\.\d+)?)$/)
  if (!spacing) return undefined
  return {
    tokenId: "spacing.unit",
    viaDerivedRule: {
      id: "spacing.multiplier",
      multiplier: (spacing[1] === "-" ? -1 : 1) * Number(spacing[2]),
    },
  }
}

function analyzer(readSource?: (sourcePath: string) => string) {
  return createTokenSourceAnalyzer({
    resolveUtility: resolveFixtureUtility,
    classMergeFunctionNames: ["cn"],
    recipeFunctionNames: ["cva"],
    readSource,
  })
}

describe("token dependency source selector context", () => {
  test("preserves the Tabs ancestor selector and after target without inventing a local prop condition", () => {
    const dependencies = analyzer().analyzeTailwindTokenDependencies("group-data-[orientation=vertical]/tabs:after:-right-1")

    expect(dependencies).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: -1 },
      sourceContext: {
        applicability: ["group-data-[orientation=vertical]/tabs"],
        target: { kind: "pseudo-element", name: "after" },
      },
      evidenceRefs: ["source"],
    }])
    expect(dependencies[0]).not.toHaveProperty("when")
  })

  test("preserves the Sidebar ancestor conjunction as one exact atomic selector", () => {
    const dependencies = analyzer().analyzeTailwindTokenDependencies("[[data-side=left][data-collapsible=offcanvas]_&]:-right-2")

    expect(dependencies).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: -2 },
      sourceContext: {
        applicability: ["[[data-side=left][data-collapsible=offcanvas]_&]"],
      },
      evidenceRefs: ["source"],
    }])
  })

  test("keeps simple negative spacing free of fake selector context", () => {
    expect(analyzer().analyzeTailwindTokenDependencies("-mx-1")).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: -1 },
      evidenceRefs: ["source"],
    }])
  })

  test("records a pseudo-element target without inventing ancestor applicability", () => {
    expect(analyzer().analyzeTailwindTokenDependencies("after:-inset-2")).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: -2 },
      sourceContext: {
        applicability: [],
        target: { kind: "pseudo-element", name: "after" },
      },
      evidenceRefs: ["source"],
    }])
  })

  test("can represent all eight deferred signed-spacing source occurrences without fake props", () => {
    const cases = [
      ["DropdownMenuSeparator", "-mx-1", undefined],
      ["SelectSeparator", "-mx-1", undefined],
      ["SidebarRail left edge", "group-data-[side=left]:-right-4", { applicability: ["group-data-[side=left]"] }],
      ["SidebarRail left offcanvas", "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2", { applicability: ["[[data-side=left][data-collapsible=offcanvas]_&]"] }],
      ["SidebarRail right offcanvas", "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2", { applicability: ["[[data-side=right][data-collapsible=offcanvas]_&]"] }],
      ["SidebarGroupAction", "after:-inset-2", { applicability: [], target: { kind: "pseudo-element", name: "after" } }],
      ["SidebarMenuAction", "after:-inset-2", { applicability: [], target: { kind: "pseudo-element", name: "after" } }],
      ["TabsTrigger", "group-data-[orientation=vertical]/tabs:after:-right-1", { applicability: ["group-data-[orientation=vertical]/tabs"], target: { kind: "pseudo-element", name: "after" } }],
    ] as const

    for (const [label, utility, sourceContext] of cases) {
      const dependencies = analyzer().analyzeTailwindTokenDependencies(utility)
      expect(dependencies, label).toHaveLength(1)
      expect(dependencies[0], label).not.toHaveProperty("when")
      expect(dependencies[0].sourceContext, label).toEqual(sourceContext)
      expect(dependencies[0].viaDerivedRule?.multiplier, label).toBeLessThan(0)
    }
  })

  test("keeps CVA local conditions in when while source context remains separate", () => {
    const source = `
      const styles = cva("", {
        variants: {
          variant: {
            default: "right-1",
            line: "group-data-[orientation=vertical]/tabs:after:right-1",
          },
        },
      })
      export function Example() {
        return <div className={styles()} />
      }
    `
    const dependencies = analyzer(() => source).analyzeComponentTokenDependenciesForExport("fixture.tsx", "Example")

    expect(dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tokenId: "spacing.unit",
        when: { propName: "variant", equals: "default" },
      }),
      expect.objectContaining({
        tokenId: "spacing.unit",
        when: { propName: "variant", equals: "line" },
        sourceContext: {
          applicability: ["group-data-[orientation=vertical]/tabs"],
          target: { kind: "pseudo-element", name: "after" },
        },
      }),
    ]))
  })

  test("includes exact source context in dependency comparison identity", () => {
    const source = `export function Example() { return <div className="hover:group-data-[state=open]/item:after:right-1" /> }`
    const sourceAnalyzer = analyzer(() => source)
    const exact = sourceAnalyzer.analyzeComponentTokenDependenciesForExport("fixture.tsx", "Example")
    const missing = exact.map(({ sourceContext: _sourceContext, ...dependency }) => dependency)
    const reordered = exact.map((dependency) => ({
      ...dependency,
      sourceContext: {
        ...dependency.sourceContext!,
        applicability: [...dependency.sourceContext!.applicability].reverse(),
      },
    }))

    expect(exact[0].sourceContext?.applicability).toEqual(["hover", "group-data-[state=open]/item"])
    expect(sourceAnalyzer.compareComponentTokenDependenciesForExport("fixture.tsx", "Example", exact)).toEqual([])
    expect(sourceAnalyzer.compareComponentTokenDependenciesForExport("fixture.tsx", "Example", missing)).toEqual(expect.arrayContaining([
      expect.stringContaining("Missing source token dependency"),
      expect.stringContaining("Invented token dependency"),
    ]))
    expect(sourceAnalyzer.compareComponentTokenDependenciesForExport("fixture.tsx", "Example", reordered as TokenDependency[])).not.toEqual([])
  })

  test("splits only top-level modifier colons and leaves unactivated contexts outside this narrow model", () => {
    const dependencies = analyzer().analyzeTailwindTokenDependencies("[&[data-label='a:b']]:right-1")

    expect(dependencies).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 1 },
      evidenceRefs: ["source"],
    }])
  })

  test.each([
    "group-data-[orientation=vertical:after:-right-1",
    "group-data-orientation-vertical:after:-right-1",
    "group-data-[orientation=vertical]::after:-right-1",
    "after:before:-right-1",
  ])("fails closed for malformed or unsupported activated selector context: %s", (classNames) => {
    expect(() => analyzer().analyzeTailwindTokenDependencies(classNames)).toThrow(/source context/i)
  })
})
