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
const field = fileURLToPath(new URL("../src/components/ui/field.tsx", import.meta.url))
const fieldContract = JSON.parse(readFileSync(fileURLToPath(new URL("../contracts/components/families/field.json", import.meta.url)), "utf8"))
const toggleGroup = fileURLToPath(new URL("../src/components/ui/toggle-group.tsx", import.meta.url))
const toggleGroupContract = JSON.parse(readFileSync(fileURLToPath(new URL("../contracts/components/families/toggle-group.json", import.meta.url)), "utf8"))

describe("generic render-model alternatives and factual aliases", () => {
  test("treats a directly rendered scalar public prop as content rather than unresolved structure", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "ScalarPropChildFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.root?.children).toEqual([])
  })

  test("does not analyze an unused conditional local as a JSX host alias", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "NonHostConditionalFixture")

    expect(tree.unresolved).toEqual([])
  })

  test("preserves coerced prop truthiness in data attributes and conditional child edges", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "CoercedTruthinessFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.root?.dataAttributes).toEqual([
      { name: "data-content", source: "derived-condition", condition: { propName: "children", truthiness: "truthy" } },
    ])
    expect(tree.root?.children[0]).toMatchObject({ tag: "StaticChild", when: { propName: "children", truthiness: "truthy" } })
  })

  test("reconciles FieldLabel through its immediate cross-family Label host", () => {
    const component = fieldContract.exports.find((entry: any) => entry.name === "FieldLabel").component
    const source = sourceAnalysis.analyzeJsxRenderTree(field, "FieldLabel")

    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    mutated.nodes[0].host.familyId = "separator"
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Render host mismatch at Label: Label.")
  })

  test("reconciles FieldSeparator coerced data and child truthiness facts", () => {
    const component = fieldContract.exports.find((entry: any) => entry.name === "FieldSeparator").component
    const source = sourceAnalysis.analyzeJsxRenderTree(field, "FieldSeparator")

    expect(source.unresolved).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    mutated.nodes[0].children[1].when = { propName: "children", truthiness: "falsy" }
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Conditional render edge mismatch at div>span.")
  })

  test("reconciles ToggleGroup's provider child and rejects its omission", () => {
    const component = toggleGroupContract.exports.find((entry: any) => entry.name === "ToggleGroup").component
    const source = sourceAnalysis.analyzeJsxRenderTree(toggleGroup, "ToggleGroup")

    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    mutated.nodes[0].children = []
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Automatic child count mismatch at ToggleGroupPrimitive.Root.")
  })

  test("reconciles ToggleGroupItem derived-state attribute targets and rejects drift", () => {
    const component = toggleGroupContract.exports.find((entry: any) => entry.name === "ToggleGroupItem").component
    const source = sourceAnalysis.analyzeJsxRenderTree(toggleGroup, "ToggleGroupItem")

    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    mutated.nodes[0].dataAttributes.find((attribute: any) => attribute.name === "data-variant").prop = "variant"
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Data attributes mismatch at ToggleGroupPrimitive.Item.")
  })

  test("normalizes a single surviving branch after a source null return", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(field, "FieldError")

    expect(tree.unresolved).toEqual(["Unsupported JSX child expression: content"])
    expect(tree.unresolvedFindings).toEqual([expect.objectContaining({ expressionKind: "Identifier", sourceText: "content" })])
    expect(tree).toMatchObject({
      root: expect.objectContaining({
        tag: "div",
        dataAttributes: [{ name: "data-slot", source: "literal", value: "field-error" }],
      }),
    })
    expect(tree.alternatives).toBeUndefined()
  })

  test("records direct local property access as primitive-state provenance", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(toggleGroup, "ToggleGroupItem")

    expect(tree.unresolved).toEqual([])
    expect(tree.root?.dataAttributes).toEqual(expect.arrayContaining([
      { name: "data-spacing", source: "primitive-state", prop: "context.spacing" },
    ]))
  })

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
        when: { propName: "children", nullishness: "non-nullish" },
        root: expect.objectContaining({ tag: "Primitive.Root", children: [] }),
      },
      {
        when: { propName: "children", nullishness: "nullish" },
        root: expect.objectContaining({
          tag: "Primitive.Root",
          children: [expect.objectContaining({ tag: "Primitive.Fallback" })],
        }),
      },
    ])
  })

  test("retains nested host, import, and portal facts under an outer return predicate", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "NestedHostPortalFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      {
        when: { propName: "enabled", truthiness: "falsy" },
        root: expect.objectContaining({ tag: "Primitive.Fallback", portal: false }),
      },
      {
        when: { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: true }] },
        root: expect.objectContaining({
          tag: "Comp",
          resolvedHost: { tag: "Primitive.Portal", kind: "member" },
          portal: true,
        }),
      },
      {
        when: { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: false }] },
        root: expect.objectContaining({
          tag: "Comp",
          resolvedHost: { tag: "div", kind: "intrinsic" },
          portal: false,
        }),
      },
    ])

    const rendering: Parameters<typeof sourceAnalysis.compareJsxRenderTree>[0] = {
      alternatives: [
        {
          when: { propName: "enabled", truthiness: "falsy" },
          rendering: { rootNodeId: "fallback", publicPropsTargetNodeId: "fallback", nodes: [{ id: "fallback", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [] }], portalBoundaries: [] },
        },
        {
          when: { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: true }] },
          rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [{ name: "data-slot", source: "literal", value: "nested-portal" }], derivedSpreads: [], children: [] }], portalBoundaries: [{ nodeId: "host" }] },
        },
        {
          when: { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: false }] },
          rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [{ name: "data-slot", source: "literal", value: "nested-portal" }], derivedSpreads: [], children: [] }], portalBoundaries: [] },
        },
      ],
    }
    expect(sourceAnalysis.compareJsxRenderTree(rendering, tree)).toEqual([])
    const misplacedPortal = structuredClone(rendering)
    ;[misplacedPortal.alternatives[1].rendering, misplacedPortal.alternatives[2].rendering] = [misplacedPortal.alternatives[2].rendering, misplacedPortal.alternatives[1].rendering]
    expect(sourceAnalysis.compareJsxRenderTree(misplacedPortal, tree)).toEqual(expect.arrayContaining([
      "Portal boundary mismatch at Comp.",
      "Render host mismatch at Comp: Comp.",
    ]))
  })

  test("prunes impossible cross-products from same-predicate sibling ternaries", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(fixture, "SamePredicateSiblingTernaryFixture")

    expect(tree.unresolved).toEqual([])
    expect(tree.alternatives).toEqual([
      {
        when: { propName: "enabled", equals: true },
        root: expect.objectContaining({
          children: [expect.objectContaining({ tag: "Primitive.FirstOn" }), expect.objectContaining({ tag: "Primitive.SecondOn" })],
        }),
      },
      {
        otherwise: true,
        root: expect.objectContaining({
          children: [expect.objectContaining({ tag: "Primitive.FirstOff" }), expect.objectContaining({ tag: "Primitive.SecondOff" })],
        }),
      },
    ])
  })

  test("retains both && and nested ternary predicates and rejects either mutation", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(fixture, "AndTernaryChildFixture")
    const tree = (childTag: "Compact" | "Expanded") => ({
      rootNodeId: "root",
      publicPropsTargetNodeId: "root",
      nodes: [
        { id: "root", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [{ nodeId: "child", when: { propName: "enabled", equals: true } }] },
        { id: "child", host: { kind: "component-export", exportName: childTag }, receivesPublicProps: false, dataAttributes: [], derivedSpreads: [], children: [] },
      ],
      portalBoundaries: [],
    })
    const rendering: Parameters<typeof sourceAnalysis.compareJsxRenderTree>[0] = {
      alternatives: [
        { when: { propName: "compact", equals: true }, rendering: tree("Compact") },
        { otherwise: true, rendering: tree("Expanded") },
      ],
    }

    expect(source.unresolved).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree(rendering, source)).toEqual([])
    const branchMutation = structuredClone(rendering)
    branchMutation.alternatives[0].when = { propName: "compact", equals: false }
    expect(sourceAnalysis.compareJsxRenderTree(branchMutation, source)).toContain("Render alternative condition mismatch at 0.")
    const edgeMutation = structuredClone(rendering)
    edgeMutation.alternatives[0].rendering.nodes[0].children[0].when = { propName: "enabled", equals: false }
    expect(sourceAnalysis.compareJsxRenderTree(edgeMutation, source)).toContain("Conditional render edge mismatch at Primitive.Root>Primitive.Compact.")
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
      {
        when: { all: [{ propName: "tooltip", truthiness: "falsy" }, { propName: "asChild", equals: true }] },
        root: expect.objectContaining({
          tag: "Comp",
          resolvedHost: expect.objectContaining({
            tag: "Slot.Root",
            kind: "member",
            importBinding: { importedName: "Slot", localName: "Slot", moduleSpecifier: "radix-ui" },
          }),
        }),
      },
      {
        when: { all: [{ propName: "tooltip", truthiness: "falsy" }, { propName: "asChild", equals: false }] },
        root: expect.objectContaining({ tag: "Comp", resolvedHost: { tag: "button", kind: "intrinsic" } }),
      },
      {
        when: { all: [{ propName: "tooltip", truthiness: "truthy" }, { propName: "asChild", equals: true }] },
        root: expect.objectContaining({
          tag: "Tooltip",
          children: expect.arrayContaining([
            expect.objectContaining({
              tag: "TooltipTrigger",
              children: [expect.objectContaining({
                tag: "Comp",
                resolvedHost: expect.objectContaining({
                  tag: "Slot.Root",
                  kind: "member",
                  importBinding: { importedName: "Slot", localName: "Slot", moduleSpecifier: "radix-ui" },
                }),
              })],
            }),
            expect.objectContaining({ tag: "TooltipContent", derivedSpreads: [{ source: "prop", name: "tooltip" }] }),
          ]),
        }),
      },
      {
        when: { all: [{ propName: "tooltip", truthiness: "truthy" }, { propName: "asChild", equals: false }] },
        root: expect.objectContaining({
          tag: "Tooltip",
          children: expect.arrayContaining([
            expect.objectContaining({ tag: "TooltipTrigger", children: [expect.objectContaining({ tag: "Comp", resolvedHost: { tag: "button", kind: "intrinsic" } })] }),
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
        { when: { propName: "children", nullishness: "non-nullish" }, rendering: rootOnly() },
        { when: { propName: "children", nullishness: "nullish" }, rendering: rootOnly([{ nodeId: "fallback" }]) },
      ],
    }

    expect(sourceAnalysis.compareJsxRenderTree(rendering, source)).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree({ alternatives: rendering.alternatives!.slice(0, 1) }, source)).toContain("Render alternative count mismatch.")
    const mutated = structuredClone(rendering)
    mutated.alternatives![0] = { when: { propName: "children", truthiness: "truthy" }, rendering: mutated.alternatives![0].rendering }
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).toContain("Render alternative condition mismatch at 0.")
  })

  test("rejects a single default tree when source has conditional alternatives", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(breadcrumb, "BreadcrumbLink")
    const component = breadcrumbContract.exports.find((entry: any) => entry.name === "BreadcrumbLink").component
    const omittedBranch = structuredClone(component.rendering.alternatives[1].rendering)

    expect(sourceAnalysis.compareJsxRenderTree(omittedBranch, source)).toContain(
      "Source has render alternatives but contract has a single render tree.",
    )
  })

  test("reconciles the real BreadcrumbLink conditional render alternatives", () => {
    const component = breadcrumbContract.exports.find((entry: any) => entry.name === "BreadcrumbLink").component
    const source = sourceAnalysis.analyzeJsxRenderTree(breadcrumb, "BreadcrumbLink")

    expect(source.unresolved).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const mutated = structuredClone(component.rendering)
    mutated.alternatives[0].when = { propName: "asChild", equals: false }
    expect(sourceAnalysis.compareJsxRenderTree(mutated, source)).not.toEqual([])
  })

  test("reconciles BreadcrumbSeparator nullishness and rejects predicate drift", () => {
    const component = breadcrumbContract.exports.find((entry: any) => entry.name === "BreadcrumbSeparator").component
    const source = sourceAnalysis.analyzeJsxRenderTree(breadcrumb, "BreadcrumbSeparator")

    expect(source.unresolved).toEqual([])
    expect(sourceAnalysis.compareJsxRenderTree(component.rendering, source)).toEqual([])
    const predicateMutation = structuredClone(component.rendering)
    predicateMutation.alternatives[0].when = { propName: "children", truthiness: "truthy" }
    expect(sourceAnalysis.compareJsxRenderTree(predicateMutation, source)).toContain("Render alternative condition mismatch at 0.")
    const hostMutation = structuredClone(component.rendering)
    hostMutation.alternatives[0].rendering.nodes[0].host.interfaceId = "html.ol"
    expect(sourceAnalysis.compareJsxRenderTree(hostMutation, source)).toContain("Render host mismatch at li: li.")
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
