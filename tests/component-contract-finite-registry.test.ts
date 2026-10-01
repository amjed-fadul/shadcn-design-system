import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { analyzeJsxRenderTree, compareJsxRenderTree } from "../src/contracts/components/render-source-analysis"

const rendering = {
  rootNodeId: "host", publicPropsTargetNodeId: "host", portalBoundaries: [],
  nodes: [{ id: "host", host: { kind: "inherited-interface", interfaceId: "svg-fixture" }, receivesPublicProps: false, dataAttributes: [], children: [] }],
}
const conventions = {
  includeUnresolved: true,
  matchesInheritedInterface: (_tag: string, _interfaceId: string, _normalize: unknown, binding?: { moduleSpecifier: string; importedName: string }) =>
    binding?.moduleSpecifier === "svg-fixture" && ["Search", "Check"].includes(binding.importedName),
}

function analyze(registry: string, prefix = "", attributes = "", aliasKind = "const", afterAlias = "") {
  const directory = mkdtempSync(join(tmpdir(), "finite-registry-"))
  try {
    const path = join(directory, "fixture.tsx")
    writeFileSync(path, `import { Search, Check, Unknown } from "svg-fixture"; ${prefix}
      const registry = ${registry};
      function Fixture({ name }: { name: "search" | "check" }) {
        ${aliasKind} Glyph = registry[name]; ${afterAlias} return <Glyph ${attributes} />;
      }`)
    return analyzeJsxRenderTree(path, "Fixture")
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

describe("finite imported JSX host registry", () => {
  test("checks every statically enumerated imported host against the contracted host", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`)
    expect(analysis.unresolved).toEqual([])
    expect(compareJsxRenderTree(rendering, analysis, conventions)).toEqual([])
  })

  test("rejects one unknown registry member instead of trusting the first member", () => {
    const analysis = analyze(`{ search: Search, check: Unknown } as const`)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).toContain("Render host mismatch at Glyph: Glyph.")
  })

  test("recognizes explicit public attribute writes from a closed prop signature", () => {
    expect(analyze(`{ search: Search, check: Check } as const`, "", 'data-icon={name}').root?.receivesPublicProps).toBe(true)
  })

  test.each([
    `{ search: Search, ...extra } as const`,
    `{ search: Search, check: factory() } as const`,
    `{ search: Search, check: Local } as const`,
    `{ [computed]: Search, check: Check } as const`,
  ])("fails closed for an opaque registry: %s", (registry) => {
    const analysis = analyze(registry)
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  })

  test("rejects a registry that escapes into mutable code", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, 'function mutate() { registry["check"] = Unknown; }')
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  })

  test("rejects a cast that writes through a readonly registry element", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, 'function mutate() { (registry["check"] as any) = Unknown; }')
    expect(analysis.unresolved.length).toBeGreaterThan(0)
  })

  test("rejects a mutable selected host alias", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, "", "", "let", "Glyph = Unknown;")
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  })

  test.each([
    '([registry["search"]] = [Unknown]);',
    '({ value: registry["search"] } = { value: Unknown });',
    'for (registry["search"] of [Unknown]) {}',
    '({...registry["search"]} = { type: Unknown });',
  ])("rejects a registry write through an assignment pattern: %s", (mutation) => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, `function mutate() { ${mutation} }`)
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  })

  test("rejects a selected alias shadowed by a block binding", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, "", "", "const", "{ const Glyph = Check; return <Glyph />; }")
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  })

  test("rejects an alias whose component object escapes into mutable code", () => {
    const analysis = analyze(`{ search: Search, check: Check } as const`, "", "", "const", "Glyph.render = Unknown;")
    expect(analysis.unresolved.length).toBeGreaterThan(0)
  })
})

test("does not resolve a function-local registry through module imports when glyphs are shadowed", () => {
  const directory = mkdtempSync(join(tmpdir(), "finite-registry-shadow-"))
  try {
    const path = join(directory, "fixture.tsx")
    writeFileSync(path, `import { Search } from "svg-fixture";
      function Fixture({ name, Search }: any) {
        const registry = { search: Search } as const;
        const Glyph = registry[name]; return <Glyph />;
      }`)
    const analysis = analyzeJsxRenderTree(path, "Fixture")
    expect(analysis.unresolved.length).toBeGreaterThan(0)
    expect(compareJsxRenderTree(rendering, analysis, conventions)).not.toEqual([])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test("does not resolve a destructured registry parameter through a module registry", () => {
  const directory = mkdtempSync(join(tmpdir(), "finite-registry-param-"))
  try {
    const path = join(directory, "fixture.tsx")
    writeFileSync(path, `import { Search } from "svg-fixture";
      const registry = { search: Search } as const;
      function Fixture({ name, registry }: any) { const Glyph = registry[name]; return <Glyph />; }`)
    expect(analyzeJsxRenderTree(path, "Fixture").unresolved.length).toBeGreaterThan(0)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
