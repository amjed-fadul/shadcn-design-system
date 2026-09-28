import { describe, expect, test } from "vitest"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { analyzeContextRenderSource } from "../src/contracts/components/context-render-source-analysis"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import { analyzeJsxRenderTree, compareJsxRenderTree } from "../src/contracts/components/render-source-analysis"
import type { ComponentFamilyContract, ContextFact, RenderAttributeValue } from "../src/contracts/components/types"

const evidence = { source: { kind: "canonical-source" as const, source: "src/widget.tsx" } }
const authority = {
  interfaceIds: new Set<string>(),
  interfacePropNames: new Map<string, Set<string>>(),
  interfaceContracts: new Map(),
  tokenIds: new Set<string>(),
  derivedTokenRuleIds: new Set<string>(),
  capabilityIds: new Set<string>(),
  componentExportIds: new Set<string>(),
  sourceIdentity: { canonicalPath: "src/widget.tsx", canonicalBlobSha: "a".repeat(40) },
}

const contextValue: RenderAttributeValue = {
  source: "nullish-coalesce",
  first: { source: "context-field", contextId: "widget.context", field: "tone" },
  fallback: { source: "prop", name: "localTone" },
}
const sourceFixture = fileURLToPath(new URL("./fixtures/context-render-neutral.tsx", import.meta.url))

function analyzeMutatedSource(mutate: (source: string) => string) {
  const directory = mkdtempSync(join(tmpdir(), "context-render-source-"))
  const path = join(directory, "fixture.tsx")
  try {
    writeFileSync(path, mutate(readFileSync(sourceFixture, "utf8")))
    return analyzeJsxRenderTree(path, "AppearanceBadge")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function validFamily(): ComponentFamilyContract {
  const context: ContextFact = {
    id: "widget.context",
    defaultFields: [{ name: "tone", value: "quiet" }],
    provider: {
      nodeId: "root",
      fields: [{ name: "tone", value: { source: "prop", name: "providerTone" } }],
    },
    evidenceRefs: ["source"],
  }

  return {
    schemaVersion: 1,
    id: "widget",
    source: { canonicalPath: "src/widget.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "fixture" },
    evidence,
    exports: [{
      name: "Widget",
      kind: "component",
      authorableJsx: true,
      evidenceRefs: ["source"],
      component: {
        localProps: ["providerTone", "localTone"].map((name) => ({
          name,
          required: false,
          type: { kind: "string" as const },
          evidenceRefs: ["source"],
        })),
        inherits: [],
        slots: [],
        inheritedPropDefaults: [],
        composition: { requires: [], provides: [], hardConstraints: [] },
        stateChannels: [],
        conditionalApi: [],
        events: [],
        tokenDependencies: [],
        context: [context],
        rendering: {
          rootNodeId: "root",
          publicPropsTargetNodeId: "root",
          nodes: [{
            id: "root",
            host: { kind: "intrinsic", tag: "div" },
            receivesPublicProps: true,
            dataAttributes: [{
              name: "data-tone",
              source: "ordered-writes",
              writes: [
                { kind: "value", value: contextValue },
                { kind: "public-props-spread" },
              ],
              evidenceRefs: ["source"],
            }],
            children: [],
            evidenceRefs: ["source"],
          }],
          portalBoundaries: [],
        },
        accessibility: [],
      },
    }],
    unresolved: [],
  }
}

function errorsAfter(change: (family: ComponentFamilyContract) => void) {
  const family = structuredClone(validFamily())
  change(family)
  return validateComponentFamilyInvariants(family, authority)
}

describe("generic context-derived render attribute facts", () => {
  test("source analysis finds generic React context defaults, provider values, and consumer bindings", () => {
    const provider = analyzeContextRenderSource(sourceFixture, "AppearanceProvider")
    expect(provider.unresolved).toEqual([])
    expect(provider.context).toMatchObject([{
      id: "AppearanceContext",
      defaultFields: [
        { name: "tone", value: "quiet" },
        { name: "density", value: "compact" },
      ],
      provider: {
        nodeTag: "AppearanceContext.Provider",
        fields: [
          { name: "tone", value: { source: "prop", name: "tone" } },
          { name: "density", value: { source: "literal", value: "comfortable" } },
        ],
      },
    }])

    const consumer = analyzeContextRenderSource(sourceFixture, "AppearanceBadge")
    expect(consumer.unresolved).toEqual([])
    expect(consumer.bindings.get("appearance")).toBe("AppearanceContext")
    expect(consumer.context).toMatchObject([{
      id: "AppearanceContext",
      defaultFields: [
        { name: "tone", value: "quiet" },
        { name: "density", value: "compact" },
      ],
      providerExportName: "AppearanceProvider",
    }])
  })

  test("render source analysis retains nullish context fallback and attribute write order", () => {
    const tree = analyzeJsxRenderTree(sourceFixture, "AppearanceBadge")
    expect(tree.unresolved).toEqual([])
    expect(tree.root?.dataAttributes).toEqual([
      {
        name: "data-tone",
        source: "ordered-writes",
        writes: [
          { kind: "value", value: {
            source: "nullish-coalesce",
            first: { source: "context-field", contextId: "AppearanceContext", field: "tone" },
            fallback: { source: "prop", name: "localTone" },
          } },
          { kind: "public-props-spread" },
        ],
      },
      {
        name: "data-density",
        source: "ordered-writes",
        writes: [
          { kind: "value", value: {
            source: "nullish-coalesce",
            first: { source: "context-field", contextId: "AppearanceContext", field: "density" },
            fallback: { source: "literal", value: "compact" },
          } },
          { kind: "public-props-spread" },
        ],
      },
    ])
  })

  test("source mutation from nullish coalescing to truthiness is not silently treated as equivalent", () => {
    const mutated = analyzeMutatedSource((source) => source.replace("appearance.tone ?? localTone", "appearance.tone || localTone"))
    expect(mutated.unresolved).toContain("Unsupported contextual data attribute: data-tone")
    expect(mutated.root?.dataAttributes.find((attribute) => attribute.name === "data-tone")).toMatchObject({
      source: "ordered-writes",
      writes: [{ kind: "public-props-spread" }],
    })
  })

  test("source mutation that removes the final forwarded-props spread fails reconciliation", () => {
    const original = analyzeJsxRenderTree(sourceFixture, "AppearanceBadge").root!
    const rendering = {
      rootNodeId: "root",
      publicPropsTargetNodeId: "root",
      nodes: [{
        id: "root",
        host: { kind: "intrinsic", tag: "span" },
        receivesPublicProps: true,
        dataAttributes: original.dataAttributes.map(({ name, source, writes }) => ({ name, source, writes })),
        derivedSpreads: [],
        children: [],
      }],
      portalBoundaries: [],
    }
    const mutated = analyzeMutatedSource((source) => source.replace("      {...props}\n", ""))

    expect(mutated.unresolved).toEqual([])
    expect(compareJsxRenderTree(rendering, mutated)).toContain("Public-props target mismatch at span.")
  })

  test("source mutation of JSX spread order is retained and fails reconciliation against the original fact", () => {
    const original = analyzeJsxRenderTree(sourceFixture, "AppearanceBadge").root!
    const rendering = {
      rootNodeId: "root",
      publicPropsTargetNodeId: "root",
      nodes: [{
        id: "root",
        host: { kind: "intrinsic", tag: "span" },
        receivesPublicProps: true,
        dataAttributes: original.dataAttributes.map(({ name, source, writes }) => ({ name, source, writes })),
        derivedSpreads: [],
        children: [],
      }],
      portalBoundaries: [],
    }
    const mutated = analyzeMutatedSource((source) => source.replace(
      /      data-tone=\{appearance\.tone \?\? localTone\}\n      data-density=\{appearance\.density \?\? "compact"\}\n      \{\.\.\.props\}/,
      '      {...props}\n      data-tone={appearance.tone ?? localTone}\n      data-density={appearance.density ?? "compact"}'
    ))
    expect(mutated.unresolved).toEqual([])
    expect(mutated.root?.dataAttributes[0]?.writes).toEqual([
      { kind: "public-props-spread" },
      { kind: "value", value: {
        source: "nullish-coalesce",
        first: { source: "context-field", contextId: "AppearanceContext", field: "tone" },
        fallback: { source: "prop", name: "localTone" },
      } },
    ])
    expect(compareJsxRenderTree(rendering, mutated)).toContain("Data attributes mismatch at span.")
  })

  test("accepts a provider value with nullish local-prop fallback and a later public-props write", () => {
    expect(validateComponentFamilyInvariants(validFamily(), authority)).toEqual([])

    const family = validFamily()
    const component = family.exports[0].component!
    expect(component.context?.[0].provider?.fields[0].value).toEqual({ source: "prop", name: "providerTone" })
    expect(component.rendering).toMatchObject({
      nodes: [{ dataAttributes: [{
        source: "ordered-writes",
        writes: [
          { kind: "value", value: { source: "nullish-coalesce", first: { source: "context-field" }, fallback: { source: "prop", name: "localTone" } } },
          { kind: "public-props-spread" },
        ],
      }] }],
    })
    expect(contextValue.source).toBe("nullish-coalesce")
    expect(contextValue).not.toHaveProperty("truthiness")
  })

  test("accepts a provider value that reads a context declared later", () => {
    const family = validFamily()
    const component = family.exports[0].component!
    component.context![0].provider!.fields[0].value = {
      source: "context-field",
      contextId: "other.context",
      field: "tone",
    }
    component.context!.push({
      id: "other.context",
      defaultFields: [{ name: "tone", value: "quiet" }],
      provider: {
        nodeId: "root",
        fields: [{ name: "tone", value: { source: "literal", value: "bright" } }],
      },
      evidenceRefs: ["source"],
    })

    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])
  })

  test("rejects unknown provider context references and unknown context fields", () => {
    const unknownContext = errorsAfter((family) => {
      const value = family.exports[0].component!.context![0].provider!.fields[0].value as any
      value.source = "context-field"
      value.contextId = "missing.context"
      value.field = "tone"
    })
    expect(unknownContext.some((error) => error.includes("references unknown context: missing.context"))).toBe(true)

    const unknownField = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).nodes[0].dataAttributes[0].writes[0].value.first.field = "weight"
    })
    expect(unknownField.some((error) => error.includes("references unknown context field: widget.context.weight"))).toBe(true)
  })

  test("rejects unknown fallback props", () => {
    const errors = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).nodes[0].dataAttributes[0].writes[0].value.fallback.name = "unknownTone"
    })
    expect(errors.some((error) => error.includes("references unknown prop: unknownTone"))).toBe(true)
  })

  test("rejects cyclic context provider dependencies", () => {
    const errors = errorsAfter((family) => {
      const component = family.exports[0].component!
      const context = component.context![0]
      context.provider!.fields[0].value = { source: "context-field", contextId: "other.context", field: "tone" }
      component.context!.push({
        id: "other.context",
        defaultFields: [{ name: "tone", value: "quiet" }],
        provider: {
          nodeId: "root",
          fields: [{ name: "tone", value: { source: "context-field", contextId: "widget.context", field: "tone" } }],
        },
        evidenceRefs: ["source"],
      })
    })
    expect(errors.some((error) => error.includes("context values contain a cycle"))).toBe(true)
  })

  test("rejects empty ordered writes and accepts public-props spread before explicit values", () => {
    const empty = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).nodes[0].dataAttributes[0].writes = []
    })
    expect(empty.some((error) => error.includes("needs a value write"))).toBe(true)

    const spreadFirst = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).nodes[0].dataAttributes[0].writes = [
        { kind: "public-props-spread" },
        { kind: "value", value: contextValue },
      ]
    })
    expect(spreadFirst).toEqual([])
  })

  test("rejects unsupported writes and public-props writes targeting another node", () => {
    const unsupported = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).nodes[0].dataAttributes[0].writes[0] = { kind: "unknown-write" }
    })
    expect(unsupported.some((error) => error.includes("has an unsupported write"))).toBe(true)

    const wrongTarget = errorsAfter((family) => {
      ;(family.exports[0].component!.rendering as any).publicPropsTargetNodeId = "different-node"
    })
    expect(wrongTarget.some((error) => error.includes("public-props write on a non-target node"))).toBe(true)
  })
})
