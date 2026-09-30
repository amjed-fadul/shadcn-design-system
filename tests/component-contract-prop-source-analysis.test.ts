import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import ts from "typescript"
import { describe, expect, test } from "vitest"

import {
  createComponentPropSourceAnalyzer,
  type ComponentPropSourceFact,
} from "../src/contracts/components/component-prop-source-analysis"
import type { ComponentFamilyContract, LocalPropContract } from "../src/contracts/components/types"

const root = resolve(process.cwd())
const sourcePath = (id: string) => join(root, "src/components/ui", `${id}.tsx`)
const family = (id: string) => JSON.parse(readFileSync(join(root, "contracts/components/families", `${id}.json`), "utf8")) as ComponentFamilyContract
const analyzer = createComponentPropSourceAnalyzer({
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    baseUrl: root,
    paths: { "@/*": ["src/*"] },
  },
})

function selected(facts: ComponentPropSourceFact[], names: string[]) {
  return facts.filter((fact) => names.includes(fact.name)).sort((left, right) => left.name.localeCompare(right.name))
}

function localProps(id: string, exportName: string) {
  const component = family(id).exports.find((entry) => entry.name === exportName)?.component
  if (!component) throw new Error(`Missing component ${id}.${exportName}`)
  return { contracted: component.localProps }
}

describe("general composed component prop source analysis", () => {
  test("shares configured roots while retaining an isolated fallback for external sources", () => {
    const fixture = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const shared = createComponentPropSourceAnalyzer({
      rootNames: [sourcePath("alert-dialog"), sourcePath("pagination"), fixture],
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        baseUrl: root,
        paths: { "@/*": ["src/*"] },
      },
    })

    expect(shared.analyzeComponentPropSource(sourcePath("alert-dialog"), "AlertDialogAction").unresolved).toEqual([])
    expect(shared.analyzeComponentPropSource(sourcePath("pagination"), "PaginationPrevious").unresolved).toEqual([])
    expect(shared.analyzeComponentPropSource(sourcePath("accordion"), "Accordion").unresolved).toEqual([])
  })

  test("resolves Pick<ComponentProps<Button>> enum literals and binding defaults", () => {
    const analysis = analyzer.analyzeComponentPropSource(sourcePath("alert-dialog"), "AlertDialogAction")

    expect(analysis.unresolved).toEqual([])
    expect(selected(analysis.props, ["variant", "size"])).toEqual([
      { name: "size", required: false, type: { kind: "enum", values: ["default", "icon", "icon-lg", "icon-sm", "icon-xs", "lg", "sm", "xs"] }, default: "default" },
      { name: "variant", required: false, type: { kind: "enum", values: ["default", "destructive", "ghost", "link", "outline", "secondary"] }, default: "default" },
    ])
  })

  test("combines Omit<ComponentProps<Button>> with local VariantProps and delegated defaults", () => {
    const analysis = analyzer.analyzeComponentPropSource(sourcePath("input-group"), "InputGroupButton")

    expect(analysis.unresolved).toEqual([])
    expect(selected(analysis.props, ["asChild", "size", "variant"])).toEqual([
      { name: "asChild", required: false, type: { kind: "boolean" }, default: false },
      { name: "size", required: false, type: { kind: "enum", values: ["icon-sm", "icon-xs", "sm", "xs"] }, default: "xs" },
      { name: "variant", required: false, type: { kind: "enum", values: ["default", "destructive", "ghost", "link", "outline", "secondary"] }, default: "ghost" },
    ])
  })

  test("reconciles inherited prop omissions from an intrinsic ComponentProps source", () => {
    const analysis = analyzer.analyzeComponentPropSource(sourcePath("alert"), "Status")
    const contracted = family("alert").exports.find((entry) => entry.name === "Status")!.component!.inheritedPropOmissions!
    const inherited = new Set(["aria-live", "role"])

    expect(analysis.inheritedPropOmissionNames).toEqual(["aria-live", "role"])
    expect(analyzer.compareComponentInheritedPropOmissions(contracted, analysis, inherited)).toEqual([])
    expect(analyzer.compareComponentInheritedPropOmissions(contracted.slice(1), analysis, inherited)).toContain(
      "Source inherited prop omission aria-live is missing from the contract.",
    )
  })

  test("resolves same-file CVA defaults and forwardRef generic intersections", () => {
    const alert = analyzer.analyzeComponentPropSource(sourcePath("alert"), "Alert")
    const dialog = analyzer.analyzeComponentPropSource(sourcePath("dialog"), "DialogContent")
    const field = analyzer.analyzeComponentPropSource(sourcePath("field"), "FieldError")
    const separator = analyzer.analyzeComponentPropSource(sourcePath("field"), "FieldSeparator")
    const toggleGroup = analyzer.analyzeComponentPropSource(sourcePath("toggle-group"), "ToggleGroup")
    const toggleContracted = localProps("toggle-group", "ToggleGroup").contracted

    expect(selected(alert.props, ["variant"])).toEqual([
      { name: "variant", required: false, type: { kind: "enum", values: ["default", "destructive"] }, default: "default" },
    ])
    expect(dialog.localPropNames).toContain("showCloseButton")
    expect(selected(dialog.props, ["showCloseButton"])).toEqual([
      { name: "showCloseButton", required: false, type: { kind: "boolean" }, default: true },
    ])
    expect(selected(field.props, ["errors"])).toEqual([
      { name: "errors", required: false, type: { kind: "typescript", typeText: "Array<{ message?: string } | undefined>" } },
    ])
    expect(separator.localPropNames).not.toContain("children")
    expect(analyzer.compareComponentLocalProps([], separator)).toEqual([])
    expect(toggleGroup.localPropNames).not.toContain("orientation")
    expect(toggleContracted).not.toContainEqual(expect.objectContaining({ name: "orientation" }))
    expect(family("toggle-group").exports.find((entry) => entry.name === "ToggleGroup")?.component?.inheritedPropDefaults).toContainEqual(expect.objectContaining({ propName: "orientation", value: "horizontal" }))
    expect(analyzer.compareComponentLocalProps(toggleContracted, toggleGroup, new Set(["orientation"]))).toEqual([])
  })

  test("preserves authored local TypeScript expressions instead of checker aliases", () => {
    const sidebar = analyzer.analyzeComponentPropSource(sourcePath("sidebar"), "SidebarMenuButton")

    expect(selected(sidebar.props, ["tooltip"])).toEqual([
      { name: "tooltip", required: false, type: { kind: "typescript", typeText: "string | ComponentProps<typeof TooltipContent>" } },
    ])
  })

  test("uses the declaring source file for a cross-file picked authored type", () => {
    const parent = join(root, "tests/fixtures/component-prop-source-analysis-parent-fixture.tsx")
    const analysis = analyzer.analyzeComponentPropSource(parent, "CrossFileWrapper")

    expect(selected(analysis.props, ["payload"])).toEqual([
      { name: "payload", required: false, type: { kind: "typescript", typeText: "Promise<string>" } },
    ])
  })

  test("reports an exact child-file identity for a cross-file unsafe property", () => {
    const parent = join(root, "tests/fixtures/component-prop-source-analysis-parent-fixture.tsx")
    const child = join(root, "tests/fixtures/component-prop-source-analysis-child-fixture.tsx")
    const analysis = analyzer.analyzeComponentPropSource(parent, "CrossFileUnsafeWrapper")

    expect(analysis.props).toEqual([])
    expect(analysis.unresolved).toEqual([{
      sourcePath: child,
      start: 161,
      end: 164,
      expressionKind: "AnyKeyword",
      sourceText: "any",
      reason: "Component props type contains unsafe any or unknown authority.",
    }])
  })

  test("follows a local ComponentProps<PaginationLink> alias and wrapper defaults", () => {
    const link = analyzer.analyzeComponentPropSource(sourcePath("pagination"), "PaginationLink")
    const previous = analyzer.analyzeComponentPropSource(sourcePath("pagination"), "PaginationPrevious")

    expect(link.unresolved).toEqual([])
    expect(selected(link.props, ["isActive", "size"])).toEqual([
      { name: "isActive", required: false, type: { kind: "boolean" } },
      { name: "size", required: false, type: { kind: "enum", values: ["default", "icon", "icon-lg", "icon-sm", "icon-xs", "lg", "sm", "xs"] }, default: "icon" },
    ])
    expect(previous.unresolved).toEqual([])
    expect(selected(previous.props, ["isActive", "size", "text"])).toEqual([
      { name: "isActive", required: false, type: { kind: "boolean" } },
      { name: "size", required: false, type: { kind: "enum", values: ["default", "icon", "icon-lg", "icon-sm", "icon-xs", "lg", "sm", "xs"] }, default: "default" },
      { name: "text", required: false, type: { kind: "string" }, default: "Previous" },
    ])
  })

  test("compares the exact local surface and rejects enum, default, and omission mutations", () => {
    const { contracted } = localProps("pagination", "PaginationPrevious")
    const analysis = analyzer.analyzeComponentPropSource(sourcePath("pagination"), "PaginationPrevious")

    expect(analyzer.compareComponentLocalProps(contracted, analysis)).toEqual([])

    const wrongEnum = structuredClone(contracted)
    ;(wrongEnum.find((prop) => prop.name === "size")!.type as { kind: "enum"; values: string[] }).values = ["default"]
    expect(analyzer.compareComponentLocalProps(wrongEnum, analysis)).toContain("Local prop size type does not match source evidence.")

    const wrongDefault = structuredClone(contracted)
    wrongDefault.find((prop) => prop.name === "size")!.default = "icon"
    expect(analyzer.compareComponentLocalProps(wrongDefault, analysis)).toContain("Local prop size default does not match source evidence.")

    expect(analyzer.compareComponentLocalProps(contracted.filter((prop) => prop.name !== "isActive"), analysis)).toContain("Source local prop isActive is missing from the contract.")
  })

  test("does not let forged contract inheritance hide a source-local omission", () => {
    const fixture = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const analysis = analyzer.analyzeComponentPropSource(fixture, "CollisionFixture")

    expect(analyzer.compareComponentLocalProps([], analysis)).toContain(
      "Source local prop collision is missing from the contract.",
    )
  })

  test("rejects every exact local mutation including an inherited DOM member mislabeled local", () => {
    const { contracted } = localProps("pagination", "PaginationPrevious")
    const analysis = analyzer.analyzeComponentPropSource(sourcePath("pagination"), "PaginationPrevious")
    const mutations: Array<[LocalPropContract[], string]> = [
      [structuredClone(contracted).map((prop) => prop.name === "text" ? { ...prop, type: { kind: "number" } } : prop), "Local prop text type does not match source evidence."],
      [structuredClone(contracted).map((prop) => prop.name === "isActive" ? { ...prop, required: true } : prop), "Local prop isActive requiredness does not match source evidence."],
      [structuredClone(contracted).map((prop) => {
        if (prop.name !== "size") return prop
        const { default: _removed, ...withoutDefault } = prop
        return withoutDefault
      }), "Local prop size default does not match source evidence."],
      [[...structuredClone(contracted), { name: "href", required: false, type: { kind: "string" }, evidenceRefs: ["source"] }], "Contract local prop href is absent from source evidence."],
    ]

    for (const [mutated, expected] of mutations) {
      expect(analyzer.compareComponentLocalProps(mutated, analysis)).toContain(expected)
    }
  })

  test("refreshes configured and fallback Programs after an in-process source change", () => {
    const directory = mkdtempSync(join(tmpdir(), "component-prop-source-"))
    const mutablePath = join(directory, "mutable.tsx")
    const stablePath = join(directory, "stable.tsx")
    writeFileSync(stablePath, "export function Stable(props: { stable?: string }) { return null }\n")
    const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true }
    try {
      for (const configured of [true, false]) {
        writeFileSync(mutablePath, "export function Mutable(props: { value?: string }) { return null }\n")
        const refreshing = createComponentPropSourceAnalyzer({
          ...(configured ? { rootNames: [mutablePath, stablePath] } : { rootNames: [stablePath] }),
          compilerOptions,
        })
        expect(selected(refreshing.analyzeComponentPropSource(mutablePath, "Mutable").props, ["value"])).toEqual([
          { name: "value", required: false, type: { kind: "string" } },
        ])

        writeFileSync(mutablePath, "export function Mutable(props: { value?: number }) { return null }\n")
        expect(selected(refreshing.analyzeComponentPropSource(mutablePath, "Mutable").props, ["value"])).toEqual([
          { name: "value", required: false, type: { kind: "number" } },
        ])
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("fails closed when the component props type is any", () => {
    const fixture = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const analysis = analyzer.analyzeComponentPropSource(fixture, "AnyPropsFixture")
    const contracted: LocalPropContract[] = [{ name: "invented", required: false, type: { kind: "string" }, evidenceRefs: ["source"] }]

    expect(analysis.props).toEqual([])
    expect(analysis.unresolved).toEqual([expect.objectContaining({ reason: "Component props type is any." })])
    expect(analyzer.compareComponentLocalProps(contracted, analysis)).toContain("Unresolved component prop source: Component props type is any.")
  })

  test.each([
    ["UnknownPropsFixture", "Component props type cannot be resolved."],
    ["PickAnyPropsFixture", "Component props type contains unsafe any or unknown authority."],
    ["VariantAnyPropsFixture", "Component props type contains unsafe any or unknown authority."],
  ])("fails closed for %s", (exportName, reason) => {
    const fixture = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const analysis = analyzer.analyzeComponentPropSource(fixture, exportName)

    expect(analysis.props).toEqual([])
    expect(analysis.unresolved).toEqual([expect.objectContaining({ reason })])
  })
})
