import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import * as sourceAnalysis from "./helpers/component-source-analysis"

const fixture = fileURLToPath(new URL("./fixtures/component-analysis-completeness-fixture.tsx", import.meta.url))
const sidebar = fileURLToPath(new URL("../src/components/ui/sidebar.tsx", import.meta.url))
const breadcrumb = fileURLToPath(new URL("../src/components/ui/breadcrumb.tsx", import.meta.url))
const breadcrumbContract = JSON.parse(readFileSync(fileURLToPath(new URL("../contracts/components/families/breadcrumb.json", import.meta.url)), "utf8"))
const slider = fileURLToPath(new URL("../src/components/ui/slider.tsx", import.meta.url))
const sliderContract = JSON.parse(readFileSync(fileURLToPath(new URL("../contracts/components/families/slider.json", import.meta.url)), "utf8"))

describe("generic render-model alternatives and factual aliases", () => {
  test("preserves every conditional host alias alternative and its predicate", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalHostAliasFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      {
        when: { propName: "asChild", equals: true },
        root: expect.objectContaining({
          tag: "Comp",
          resolvedHost: expect.objectContaining({ tag: "Primitive.Slot", kind: "member" }),
          receivesPublicProps: true,
        }),
      },
      {
        otherwise: true,
        root: expect.objectContaining({
          tag: "Comp",
          resolvedHost: { tag: "a", kind: "intrinsic" },
          receivesPublicProps: true,
        }),
      },
    ])
  })

  test("preserves conditional JSX aliases instead of selecting one initializer branch", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalJsxAliasFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      { when: { propName: "expanded", equals: true }, root: expect.objectContaining({ tag: "Primitive.Expanded" }) },
      { otherwise: true, root: expect.objectContaining({ tag: "Primitive.Collapsed" }) },
    ])
  })

  test("preserves nullish child presence and fallback as complete render alternatives", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "NullishChildFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      {
        when: { propName: "children", truthiness: "truthy" },
        root: expect.objectContaining({ tag: "Primitive.Root", children: [] }),
      },
      {
        otherwise: true,
        root: expect.objectContaining({
          tag: "Primitive.Root",
          children: [expect.objectContaining({ tag: "Primitive.Fallback" })],
        }),
      },
    ])
  })

  test("traverses map callbacks and retains mapped hosts, attributes, child edges, and repetition provenance", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "MappedChildrenFixture")
    const item = tree.root?.children[0]

    expect(tree.unresolved).toEqual([])
    expect(tree.root).toMatchObject({
      tag: "Primitive.Root",
      dataAttributes: [{ name: "data-slot", source: "literal", value: "mapped-root" }],
    })
    expect(item).toMatchObject({
      tag: "Primitive.Item",
      dataAttributes: [{ name: "data-slot", source: "literal", value: "mapped-item" }],
      repetition: { kind: "map", source: "prop", name: "items" },
      children: [
        expect.objectContaining({
          tag: "Primitive.Label",
          dataAttributes: [{ name: "data-slot", source: "literal", value: "mapped-label" }],
          when: { propName: "showLabels", equals: true },
        }),
      ],
    })
  })

  test("does not treat arbitrary callback-returned JSX as rendered map children", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "NonMapCallbackFixture")

    expect(tree.root?.children).toEqual([])
    expect(tree.unresolved).toEqual([
      expect.stringContaining("Unsupported JSX child expression: items.filter"),
    ])
  })

  test("preserves ordered conditional top-level render alternatives", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalRootFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      { when: { propName: "collapsible", equals: "none" }, root: expect.objectContaining({ tag: "div", receivesPublicProps: true }) },
      { when: { source: "state", name: "isMobile", truthiness: "truthy" }, root: expect.objectContaining({ tag: "Primitive.Sheet", receivesPublicProps: true }) },
      { otherwise: true, root: expect.objectContaining({ tag: "div", receivesPublicProps: true }) },
    ])
  })

  test("records both values of an equality-derived data attribute", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalValueFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.root?.dataAttributes).toEqual(expect.arrayContaining([
      {
        name: "data-collapsible",
        source: "conditional-value",
        condition: { source: "state", name: "state", equals: "collapsed" },
        whenTrue: { source: "prop", name: "collapsible" },
        whenFalse: { source: "literal", value: "" },
      },
    ]))
  })

  test("resolves JSX aliases and keeps prop-derived spreads explicit", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "JsxAliasFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      { when: { propName: "tooltip", truthiness: "falsy" }, root: expect.objectContaining({ tag: "Primitive.Button", receivesPublicProps: true }) },
      {
        when: { propName: "tooltip", truthiness: "truthy" },
        root: expect.objectContaining({
          tag: "Tooltip",
          children: expect.arrayContaining([
            expect.objectContaining({ tag: "TooltipTrigger", children: [expect.objectContaining({ tag: "Primitive.Button" })] }),
            expect.objectContaining({ tag: "TooltipContent", derivedSpreads: [{ source: "prop", name: "tooltip" }] }),
          ]),
        }),
      },
    ])
  })

  test("leaves unsupported named derived spreads unresolved instead of guessing prop provenance", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "UnsupportedDerivedSpreadFixture")

    expect(tree.root?.derivedSpreads).toEqual([])
    expect(tree.unresolved).toEqual(["Unsupported spread provenance: tooltipProps"])
  })

  test("preserves representable return branches without inventing an otherwise after an unsupported condition", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "UnsupportedReturnConditionFixture")

    expect(tree.unresolved).toEqual(expect.arrayContaining(["Unsupported return condition: mode?.value"]))
    expect(tree.alternatives).toEqual([
      { when: { propName: "condition", truthiness: "truthy" }, root: expect.objectContaining({ tag: "Primitive.Known", receivesPublicProps: true }) },
    ])
  })

  test("reconciles Sidebar's factual branches, conditional value, aliases, and derived spread", () => {
    const sidebarTree = sourceAnalysis.analyzeJsxRenderTree(sidebar, "Sidebar")
    const menuButtonTree = sourceAnalysis.analyzeJsxRenderTree(sidebar, "SidebarMenuButton")

    expect(sidebarTree.unresolved).toEqual([])
    expect(sidebarTree.alternatives).toEqual([
      { when: { propName: "collapsible", equals: "none" }, root: expect.objectContaining({ tag: "div" }) },
      { when: { source: "state", name: "isMobile", truthiness: "truthy" }, root: expect.objectContaining({ tag: "Sheet" }) },
      {
        otherwise: true,
        root: expect.objectContaining({
          tag: "div",
          dataAttributes: expect.arrayContaining([
            expect.objectContaining({
              name: "data-collapsible",
              source: "conditional-value",
              condition: { source: "state", name: "state", equals: "collapsed" },
              whenTrue: { source: "prop", name: "collapsible" },
              whenFalse: { source: "literal", value: "" },
            }),
          ]),
        }),
      },
    ])
    expect(menuButtonTree.unresolved).toEqual([])
    expect(menuButtonTree.alternatives).toEqual([
      { when: { propName: "tooltip", truthiness: "falsy" }, root: expect.objectContaining({ tag: "Comp" }) },
      {
        when: { propName: "tooltip", truthiness: "truthy" },
        root: expect.objectContaining({
          tag: "Tooltip",
          children: expect.arrayContaining([
            expect.objectContaining({ tag: "TooltipTrigger", children: [expect.objectContaining({ tag: "Comp" })] }),
            expect.objectContaining({ tag: "TooltipContent", derivedSpreads: [{ source: "prop", name: "tooltip" }] }),
          ]),
        }),
      },
    ])
  })

  test("compares each alternative independently instead of collapsing source branches", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalRootFixture")
    const divBranch = (id: string) => ({ rootNodeId: id, publicPropsTargetNodeId: id, nodes: [{ id, host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [] }], portalBoundaries: [] })
    const sheetBranch = { rootNodeId: "sheet", publicPropsTargetNodeId: "sheet", nodes: [{ id: "sheet", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [] }], portalBoundaries: [] }
    const rendering: Parameters<typeof sourceAnalysis.compareJsxRenderTree>[0] = {
      alternatives: [
        { when: { propName: "collapsible", equals: "none" }, rendering: divBranch("plain") },
        { when: { source: "state", name: "isMobile", truthiness: "truthy" }, rendering: sheetBranch },
        { otherwise: true as const, rendering: divBranch("desktop") },
      ],
    }

    expect(sourceAnalysis.compareJsxRenderTree(rendering, source)).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree({ ...rendering, alternatives: rendering.alternatives!.slice(0, 2) }, source)).not.toEqual([])
  })

  test("rejects a mutated nullish predicate or omitted fallback alternative", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(fixture, "NullishChildFixture")
    const rootOnly = (children: Array<{ nodeId: string }> = []) => ({
      rootNodeId: "root",
      publicPropsTargetNodeId: "root",
      nodes: [
        { id: "root", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [{ name: "data-slot", source: "literal", value: "nullish-root" }], derivedSpreads: [], children },
        ...(children.length ? [{ id: "fallback", host: { kind: "unresolved" }, receivesPublicProps: false, dataAttributes: [{ name: "data-slot", source: "literal", value: "nullish-fallback" }], derivedSpreads: [], children: [] }] : []),
      ],
      portalBoundaries: [],
    })
    const rendering: Parameters<typeof sourceAnalysis.compareJsxRenderTree>[0] = {
      alternatives: [
        { when: { propName: "children", truthiness: "truthy" }, rendering: rootOnly() },
        { otherwise: true, rendering: rootOnly([{ nodeId: "fallback" }]) },
      ],
    }

    expect(sourceAnalysis.compareJsxRenderTree(rendering, source)).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree({ alternatives: rendering.alternatives!.slice(0, 1) }, source)).toContain("Render alternative count mismatch.")
    const mutated = structuredClone(rendering)
    mutated.alternatives![0] = { when: { propName: "children", truthiness: "falsy" }, rendering: mutated.alternatives![0].rendering }
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Render alternative condition mismatch at 0.")
  })

  test("compares a single default-host contract against the explicit otherwise source branch", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(fixture, "ConditionalHostAliasFixture")
    const rendering: Parameters<typeof sourceAnalysis.compareJsxRenderTree>[0] = {
      rootNodeId: "host",
      publicPropsTargetNodeId: "host",
      nodes: [{
        id: "host",
        host: { kind: "intrinsic", tag: "a" },
        receivesPublicProps: true,
        dataAttributes: [{ name: "data-slot", source: "literal", value: "conditional-host" }],
        derivedSpreads: [],
        children: [],
      }],
      portalBoundaries: [],
    }

    expect(sourceAnalysis.compareJsxRenderTree(rendering, source)).toEqual([])
    const mutated = structuredClone(rendering)
    mutated.nodes[0].host = { kind: "intrinsic", tag: "div" }
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Render host mismatch at Comp: Comp.")
  })

  test.each(["BreadcrumbLink", "BreadcrumbSeparator"])("reconciles the real %s conditional render alternatives", (exportName) => {
    const component = breadcrumbContract.exports.find((entry: any) => entry.name === exportName).component
    const source = sourceAnalysis.analyzeJsxRenderTree(breadcrumb, exportName)

    expect(source.unresolved).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    if (exportName === "BreadcrumbLink") mutated.alternatives[0].when = { propName: "asChild", equals: false }
    else mutated.alternatives[0].rendering.nodes[0].host.interfaceId = "html.ol"
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).not.toEqual([])
  })

  test("reconciles the real Slider Thumb mapped callback as a repeated child template", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(slider, "Slider")
    const thumb = source.root?.children.find((child) => child.tag === "SliderPrimitive.Thumb")
    const component = sliderContract.exports.find((entry: any) => entry.name === "Slider").component

    expect(source.unresolved).toEqual([])
    expect(thumb).toMatchObject({
      dataAttributes: [{ name: "data-slot", source: "literal", value: "slider-thumb" }],
      repetition: { kind: "map", source: "state", name: "values" },
    })
    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
  })
})
