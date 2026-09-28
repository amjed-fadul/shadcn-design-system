import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"
import Ajv2020 from "ajv/dist/2020.js"

import { analyzeRenderFlowSource, compareRenderFlowSource } from "../src/contracts/components/render-flow-source-analysis"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import familySchema from "../contracts/components/component-family.schema.json"
import type { ComponentFamilyContract, RenderFlowBranch, RenderingFlow, RenderingTree } from "../src/contracts/components/types"

const temporaries: string[] = []
const evidence = ["source"]

function renderSourceFixture(edit?: (source: string) => string) {
  const directory = mkdtempSync(join(tmpdir(), "neutral-render-flow-"))
  temporaries.push(directory)
  const path = join(directory, "notice-panel.tsx")
  const source = `
    import { useMemo } from "react"
    type Notice = { text: string; visible?: boolean }
    export function NoticePanel({ message, notices }: { message?: string; notices: Notice[] }) {
      const content = useMemo(() => {
        const unique = [...new Map(notices.map((notice) => [notice.text, notice])).values()]
        if (message) return message
        if (!notices.length) return null
        if (unique.length === 1) return unique[0].text
        return <ul>{unique.map((notice) => notice.visible && <li>{notice.text}</li>)}</ul>
      }, [message, notices])
      if (!content) return null
      return <section>{content}</section>
    }
  `
  writeFileSync(path, edit ? edit(source) : source)
  return path
}

function toRenderingTree(root: any): RenderingTree {
  const nodes: RenderingTree["nodes"] = []
  let nextId = 0
  const visit = (node: any): string => {
    const id = `node-${nextId++}`
    const childRefs = (node.children ?? []).map((child: any) => {
      const nodeId = visit(child)
      return {
        nodeId,
        evidenceRefs: evidence,
        ...(child.repetition ? { repeat: {
          collectionId: "unique",
          count: "matching-items" as const,
          itemWhen: { op: "truthy" as const, itemProperty: "visible", optionalItem: false },
          evidenceRefs: evidence,
        } } : {}),
      }
    })
    const kind = node.kind === "intrinsic" ? "intrinsic" : "unresolved"
    nodes.push({
      id,
      host: kind === "intrinsic" ? { kind, tag: node.tag } : { kind },
      receivesPublicProps: Boolean(node.receivesPublicProps),
      dataAttributes: [],
      derivedSpreads: [],
      children: childRefs,
      evidenceRefs: evidence,
    })
    return id
  }
  const rootNodeId = visit(root)
  return { rootNodeId, publicPropsTargetNodeId: rootNodeId, nodes, portalBoundaries: [] }
}

function baselineFlow(path: string): RenderingFlow {
  const analysis = analyzeRenderFlowSource(path, "NoticePanel")
  expect(analysis.errors).toEqual([])
  expect(analysis.flow).toBeDefined()
  const discovered = analysis.flow!
  const branches: RenderFlowBranch[] = discovered.branches.map((branch: any) => ({
    ...(branch.when ? { when: branch.when } : { otherwise: true as const }),
    evidenceRefs: evidence,
    outcome: branch.outcome.kind === "absent"
      ? { kind: "absent" as const }
      : {
          kind: "rendered" as const,
          tree: toRenderingTree(branch.outcome.root),
          ...(branch.outcome.content ? { content: branch.outcome.content } : {}),
        },
  }))
  return {
    collections: discovered.collections.map((collection: any) => ({
      ...collection,
      evidenceRefs: evidence,
      choices: collection.choices.map((choice: any) => ({ ...choice, evidenceRefs: evidence })),
      ...(collection.uniqueBy ? { uniqueBy: { ...collection.uniqueBy, evidenceRefs: evidence } } : {}),
    })),
    branches,
  }
}

function flowFamily(flow: RenderingFlow): ComponentFamilyContract {
  const invariantFlow = structuredClone(flow)
  for (const branch of invariantFlow.branches) if (branch.outcome.kind === "rendered") {
    const tree = branch.outcome.tree
    const root = tree.nodes.find((node) => node.id === tree.rootNodeId)
    if (root) root.receivesPublicProps = true
  }
  return {
    schemaVersion: 1,
    id: "notice-panel",
    source: { canonicalPath: "fixtures/notice-panel.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "fictional" },
    evidence: { source: { kind: "canonical-source", source: "fixtures/notice-panel.tsx" } },
    exports: [{
      name: "NoticePanel", kind: "component", authorableJsx: true, evidenceRefs: evidence,
      component: {
        localProps: [
          { name: "message", required: false, type: { kind: "string" }, evidenceRefs: evidence },
          { name: "notices", required: true, type: { kind: "array", item: { kind: "typescript", typeText: "Notice" } }, evidenceRefs: evidence },
        ],
        inherits: [], slots: [], inheritedPropDefaults: [], composition: { requires: [], provides: [], hardConstraints: [] },
        stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [],
        rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "intrinsic", tag: "section" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: evidence }], portalBoundaries: [] },
        renderingFlow: invariantFlow,
        accessibility: [],
      },
    }],
    unresolved: [],
  }
}

const flowAuthority = {
  interfaceIds: new Set<string>(), interfacePropNames: new Map<string, Set<string>>(), interfaceContracts: new Map(),
  tokenIds: new Set<string>(), derivedTokenRuleIds: new Set<string>(), capabilityIds: new Set<string>(),
  sourceIdentity: { canonicalPath: "fixtures/notice-panel.tsx", canonicalBlobSha: "a".repeat(40) },
}

afterEach(() => {
  for (const directory of temporaries.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("neutral ordered render-flow contracts", () => {
  test("reconciles absent output, ordered content branches, derived collection selection, filtered repetition, and Map retention", () => {
    const path = renderSourceFixture()
    const contract = baselineFlow(path)

    expect(contract.collections).toMatchObject([{
      id: "unique",
      choices: [{ source: { kind: "prop", propName: "notices" } }],
      uniqueBy: { itemProperty: "text", optionalItem: false, retention: "last-value-first-key-order" },
    }])
    expect(contract.branches.map((branch) => "otherwise" in branch ? "otherwise" : branch.when)).toEqual([
      { op: "truthy", source: { kind: "prop", propName: "message" } },
      { op: "empty", source: { kind: "prop", propName: "notices" }, optionalSource: false },
      { all: [{ op: "length-eq", source: { kind: "collection", collectionId: "unique" }, value: 1 }, { op: "falsy", source: { kind: "collection-item-property", collectionId: "unique", itemProperty: "text", index: 0, optionalItem: false } }] },
      { all: [{ op: "length-eq", source: { kind: "collection", collectionId: "unique" }, value: 1 }, { op: "truthy", source: { kind: "collection-item-property", collectionId: "unique", itemProperty: "text", index: 0, optionalItem: false } }] },
      "otherwise",
    ])
    expect(contract.branches[1].outcome).toEqual({ kind: "absent" })
    expect(contract.branches[0].outcome).toMatchObject({ kind: "rendered", content: { source: "prop", propName: "message" } })
    const listTree = contract.branches[4].outcome
    expect(listTree.kind).toBe("rendered")
    if (listTree.kind === "rendered") {
      const repeats = listTree.tree.nodes.flatMap((node) => node.children).filter((child) => child.repeat).map((child) => child.repeat)
      expect(repeats).toEqual([{ collectionId: "unique", count: "matching-items", itemWhen: { op: "truthy", itemProperty: "visible", optionalItem: false }, evidenceRefs: evidence }])
    }
    expect(compareRenderFlowSource(contract, analyzeRenderFlowSource(path, "NoticePanel"))).toEqual([])
  })

  test("rejects branch omission, invention, and reordering against source", () => {
    const path = renderSourceFixture()
    const contract = baselineFlow(path)
    const source = analyzeRenderFlowSource(path, "NoticePanel")

    const missing = structuredClone(contract)
    missing.branches.pop()
    expect(compareRenderFlowSource(missing, source)).toContain("Render flow branch count mismatch.")

    const extra = structuredClone(contract)
    extra.branches.push(structuredClone(extra.branches.at(-1)!))
    expect(compareRenderFlowSource(extra, source)).toContain("Render flow branch count mismatch.")

    const swapped = structuredClone(contract)
    ;[swapped.branches[0], swapped.branches[1]] = [swapped.branches[1], swapped.branches[0]]
    expect(compareRenderFlowSource(swapped, source)).toContain("Render flow guard/order mismatch at 0.")
  })

  test("rejects a wrong collection source or collection choice order", () => {
    const path = renderSourceFixture()
    const contract = baselineFlow(path)
    const source = analyzeRenderFlowSource(path, "NoticePanel")

    const wrongSource = structuredClone(contract)
    wrongSource.collections[0].choices[0].source.propName = "message"
    expect(compareRenderFlowSource(wrongSource, source)).toContain("Collection choice/order mismatch at 0:0.")

    const wrongOrder = structuredClone(contract)
    wrongOrder.collections[0].choices = [
      { when: { op: "truthy", source: { kind: "prop", propName: "message" } }, source: { kind: "prop", propName: "message" }, evidenceRefs: evidence },
      ...wrongOrder.collections[0].choices,
    ]
    expect(compareRenderFlowSource(wrongOrder, source)).toContain("Collection choice count mismatch at 0.")
  })

  test("rejects repeated-child, filter, deduplication, cardinality, and content-reference drift", () => {
    const path = renderSourceFixture()
    const contract = baselineFlow(path)
    const source = analyzeRenderFlowSource(path, "NoticePanel")

    const repeat = structuredClone(contract)
    const repeated = repeat.branches[4].outcome
    if (repeated.kind === "rendered") repeated.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)!.repeat!.collectionId = "notices"
    expect(compareRenderFlowSource(repeat, source)).toContain("Render flow repetition/cardinality mismatch at 4.")

    const filter = structuredClone(contract)
    const filtered = filter.branches[4].outcome
    if (filtered.kind === "rendered") filtered.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)!.repeat!.itemWhen = { op: "truthy", itemProperty: "text", optionalItem: false }
    expect(compareRenderFlowSource(filter, source)).toContain("Render flow repetition/cardinality mismatch at 4.")

    const dedup = structuredClone(contract)
    dedup.collections[0].uniqueBy!.itemProperty = "visible"
    expect(compareRenderFlowSource(dedup, source)).toContain("Collection deduplication mismatch at 0.")

    const optionalDedup = structuredClone(contract)
    optionalDedup.collections[0].uniqueBy!.optionalItem = true
    expect(compareRenderFlowSource(optionalDedup, source)).toContain("Collection deduplication mismatch at 0.")

    const cardinality = structuredClone(contract)
    const counted = cardinality.branches[4].outcome
    if (counted.kind === "rendered") counted.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)!.repeat!.count = "collection-length"
    expect(compareRenderFlowSource(cardinality, source)).toContain("Render flow repetition/cardinality mismatch at 4.")

    const content = structuredClone(contract)
    const singletonIndex = content.branches.findIndex((branch) => branch.outcome.kind === "rendered" && branch.outcome.content?.source === "collection-item-property")
    const singleton = content.branches[singletonIndex].outcome
    if (singleton.kind === "rendered") singleton.content = { source: "collection-item-property", collectionId: "wrong", itemProperty: "text", index: 0, optionalItem: false }
    expect(compareRenderFlowSource(content, source)).toContain(`Render flow content mismatch at ${singletonIndex}.`)
  })

  test("fails closed on unsupported neutral source mutations", () => {
    const unsupportedMap = renderSourceFixture((source) => source.replace("new Map(notices.map", "new Map(notices.filter"))
    expect(analyzeRenderFlowSource(unsupportedMap, "NoticePanel").flow).toBeUndefined()

    const lengthGuard = renderSourceFixture((source) => source.replace("if (message) return message", "if (message.length) return message"))
    const lengthAnalysis = analyzeRenderFlowSource(lengthGuard, "NoticePanel")
    expect(lengthAnalysis.flow).toBeUndefined()
    expect(lengthAnalysis.errors).toContain("NoticePanel memo content contains an unsupported guard or return.")

    const alteredList = renderSourceFixture((source) => source.replace("notice.visible && <li>", "notice.text && <li>"))
    const contract = baselineFlow(renderSourceFixture())
    const alteredAnalysis = analyzeRenderFlowSource(alteredList, "NoticePanel")
    expect(alteredAnalysis.errors).toEqual([])
    expect(compareRenderFlowSource(contract, alteredAnalysis)).toContain("Render flow repetition/cardinality mismatch at 4.")
  })

  test("preserves optional access in empty collection guards and rejects source drift", () => {
    const directPath = renderSourceFixture()
    const contract = baselineFlow(directPath)
    const emptyBranch = contract.branches[1]
    expect(emptyBranch).toMatchObject({ when: { op: "empty", source: { kind: "prop", propName: "notices" }, optionalSource: false } })

    const optionalPath = renderSourceFixture((source) => source.replace("!notices.length", "!notices?.length"))
    const optionalResult = analyzeRenderFlowSource(optionalPath, "NoticePanel")
    expect(optionalResult.errors).toEqual([])
    expect(optionalResult.flow?.branches[1]).toMatchObject({ when: { op: "empty", source: { kind: "prop", propName: "notices" }, optionalSource: true } })
    expect(compareRenderFlowSource(contract, optionalResult)).toContain("Render flow guard/order mismatch at 1.")
  })

  test("accepts the neutral flow schema and invariants, then rejects malformed refs, branches, and repeated trees", () => {
    const flow = baselineFlow(renderSourceFixture())
    const family = flowFamily(flow)
    const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(familySchema)
    expect(validateSchema(family), JSON.stringify(validateSchema.errors)).toBe(true)
    expect(validateComponentFamilyInvariants(family, flowAuthority)).toEqual([])

    const invalidOperator = structuredClone(family)
    ;(invalidOperator.exports[0].component!.renderingFlow!.branches[0] as any).when.op = "nearby"
    expect(validateSchema(invalidOperator)).toBe(false)

    const danglingCollection = structuredClone(family)
    danglingCollection.exports[0].component!.renderingFlow!.branches[0].when = {
      op: "length-gt", source: { kind: "collection", collectionId: "missing" }, value: 1,
    }
    expect(validateComponentFamilyInvariants(danglingCollection, flowAuthority).join("\n")).toMatch(/unknown collection/)

    const emptyBranches = structuredClone(family)
    emptyBranches.exports[0].component!.renderingFlow!.branches = []
    expect(validateSchema(emptyBranches)).toBe(false)
    expect(validateComponentFamilyInvariants(emptyBranches, flowAuthority).join("\n")).toMatch(/has no branches/)

    const inventedFixedRepeat = structuredClone(family)
    const fixedTree = inventedFixedRepeat.exports[0].component!.renderingFlow!.branches.at(-1)!.outcome
    if (fixedTree.kind === "rendered") {
      const repeatedRef = fixedTree.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)!
      ;(repeatedRef.repeat as any).min = 1
      ;(repeatedRef.repeat as any).max = 1
      expect(validateSchema(inventedFixedRepeat)).toBe(false)
    }

    const forwardCollectionRef = structuredClone(family)
    const forwardFlow = forwardCollectionRef.exports[0].component!.renderingFlow!
    forwardFlow.collections.unshift({
      id: "earlier", choices: [{ when: { op: "length-gt", source: { kind: "collection", collectionId: "unique" }, value: 0 }, source: { kind: "prop", propName: "notices" }, evidenceRefs: evidence }], evidenceRefs: evidence,
    })
    expect(validateComponentFamilyInvariants(forwardCollectionRef, flowAuthority).join("\n")).toMatch(/unknown collection/)

    const badRepeat = structuredClone(family)
    const repeatTree = badRepeat.exports[0].component!.renderingFlow!.branches.at(-1)!.outcome
    if (repeatTree.kind === "rendered") {
      const ref = repeatTree.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)!
      ref.repeat!.count = "collection-length"
      ref.repeat!.itemWhen = { op: "truthy", itemProperty: "visible", optionalItem: false }
      expect(validateComponentFamilyInvariants(badRepeat, flowAuthority).join("\n")).toMatch(/cannot filter collection-length/i)
    }

    const cycle = structuredClone(family)
    const cycleTree = cycle.exports[0].component!.renderingFlow!.branches[0].outcome
    if (cycleTree.kind === "rendered") cycleTree.tree.nodes[0].children.push({ nodeId: cycleTree.tree.rootNodeId, evidenceRefs: evidence })
    expect(validateComponentFamilyInvariants(cycle, flowAuthority).join("\n")).toMatch(/cycle/i)
  })

  test("uses length implication direction when checking ordered branch reachability", () => {
    const base = flowFamily(baselineFlow(renderSourceFixture()))
    const branchGuards = (family: ComponentFamilyContract, first: RenderingFlow["branches"][number]["when"], second: RenderingFlow["branches"][number]["when"]) => {
      const branches = family.exports[0].component!.renderingFlow!.branches
      ;(branches[0] as any).when = first
      ;(branches[0] as any).otherwise = undefined
      delete (branches[0] as any).otherwise
      ;(branches[1] as any).when = second
      ;(branches[1] as any).otherwise = undefined
      delete (branches[1] as any).otherwise
    }
    const eqTwo = { op: "length-eq" as const, source: { kind: "prop" as const, propName: "notices" }, value: 2 }
    const gtOne = { op: "length-gt" as const, source: { kind: "prop" as const, propName: "notices" }, value: 1 }

    const specificFirst = structuredClone(base)
    branchGuards(specificFirst, eqTwo, gtOne)
    expect(validateComponentFamilyInvariants(specificFirst, flowAuthority)).toEqual([])

    const broadFirst = structuredClone(base)
    branchGuards(broadFirst, gtOne, eqTwo)
    expect(validateComponentFamilyInvariants(broadFirst, flowAuthority).join("\n")).toMatch(/branch 1 is unreachable because an earlier guard already matches/i)
  })
})
