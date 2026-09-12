import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import * as sourceAnalysis from "./helpers/component-source-analysis"

const fixture = fileURLToPath(new URL("./fixtures/component-analysis-completeness-fixture.tsx", import.meta.url))
const sidebar = fileURLToPath(new URL("../src/components/ui/sidebar.tsx", import.meta.url))

describe("generic render-model alternatives and factual aliases", () => {
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
      { when: { propName: "collapsible", equals: "none" }, root: expect.objectContaining({ tag: "SidebarRenderContext.Provider" }) },
      { when: { source: "state", name: "isMobile", truthiness: "truthy" }, root: expect.objectContaining({ tag: "SidebarRenderContext.Provider" }) },
      { otherwise: true, root: expect.objectContaining({ tag: "SidebarRenderContext.Provider" }) },
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

  test("models Sidebar's explicit mobile attribute values and rail absence without evaluating state", () => {
    const providerTree = sourceAnalysis.analyzeJsxRenderTree(sidebar, "SidebarProvider")
    const sidebarTree = sourceAnalysis.analyzeJsxRenderTree(sidebar, "Sidebar")
    const railTree = sourceAnalysis.analyzeJsxRenderTree(sidebar, "SidebarRail")

    expect(providerTree.unresolved).toEqual([])
    expect(providerTree.root?.children[0]?.children[0]?.dataAttributes).toEqual(expect.arrayContaining([
      {
        name: "data-mobile",
        source: "derived-condition",
        condition: { propName: "isMobile", truthiness: "truthy" },
      },
    ]))
    expect(sidebarTree.unresolved).toEqual([])
    expect(sidebarTree.alternatives?.[1]?.root.children[0]?.children[0]?.dataAttributes).toEqual(expect.arrayContaining([
      {
        name: "data-state",
        source: "conditional-value",
        condition: { source: "state", name: "openMobile", truthiness: "truthy" },
        whenTrue: { source: "literal", value: "expanded" },
        whenFalse: { source: "literal", value: "collapsed" },
      },
      {
        name: "data-collapsible",
        source: "conditional-value",
        condition: { source: "state", name: "openMobile", truthiness: "truthy" },
        whenTrue: { source: "literal", value: "" },
        whenFalse: { source: "prop", name: "collapsible" },
      },
    ]))
    expect(railTree).toMatchObject({
      alternatives: [
        { when: { source: "state", name: "isMobile", truthiness: "falsy" }, root: expect.objectContaining({ tag: "button" }) },
      ],
      unresolved: [],
    })
  })

  test("keeps non-mobile conditional data attribute presence unresolved", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "UnsupportedConditionalPresenceFixture")

    expect(tree.unresolved).toEqual(["Dynamic data attribute data-state: flag || undefined"])
    expect(tree.root?.dataAttributes).toEqual([{ name: "data-state", source: "unresolved", expression: "flag || undefined" }])
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
})
