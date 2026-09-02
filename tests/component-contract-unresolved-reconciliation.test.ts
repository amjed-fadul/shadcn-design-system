import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { reconcileCanonicalComponentSources } from "../src/contracts/components/canonical-source-reconciliation"
import { createComponentContractLoader, type ComponentContractArtifactSource, type ComponentContractIndex } from "../src/contracts/components/loader"
import { analyzeComponentTokenSourceForExport } from "../src/contracts/components/canonical-token-source-analysis"
import { readCanonicalSourceBlobSha } from "../src/contracts/components/render-source-analysis"
import type { ComponentContractSet, ComponentFamilyContract } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = "tests/fixtures/component-unresolved-reconciliation-fixture.tsx"
const sourceFinding = analyzeComponentTokenSourceForExport(join(root, sourcePath), "UnresolvedFixture").unresolved[0]!

function sourceFact(overrides: Partial<typeof sourceFinding> = {}) {
  const { reason: _reason, ...sourceOverrides } = overrides
  return {
    sourcePath,
    start: sourceFinding.start,
    end: sourceFinding.end,
    expressionKind: sourceFinding.expressionKind,
    sourceText: sourceFinding.sourceText,
    ...sourceOverrides,
  }
}

function family(unresolved: unknown[] = []): ComponentFamilyContract {
  return {
    schemaVersion: 1,
    id: "unresolved-proof",
    source: { canonicalPath: sourcePath, canonicalBlobSha: readCanonicalSourceBlobSha(join(root, sourcePath)), implementationKind: "fixture" },
    evidence: { source: { kind: "canonical-source", source: sourcePath } },
    exports: [{
      name: "UnresolvedFixture", kind: "component", authorableJsx: true, evidenceRefs: ["source"],
      component: {
        localProps: [
          { name: "props", required: true, type: { kind: "typescript", typeText: "Record<string, unknown>" }, evidenceRefs: ["source"] },
          { name: "className", required: true, type: { kind: "string" }, evidenceRefs: ["source"] },
        ],
        inherits: [], slots: [], inheritedPropDefaults: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [],
        rendering: { rootNodeId: "root", publicPropsTargetNodeId: "root", nodes: [{ id: "root", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] },
        accessibility: [],
      },
    }],
    unresolved: unresolved as ComponentFamilyContract["unresolved"],
  }
}

function unresolvedFact(source = sourceFact()) {
  return {
    topic: "token-class-resolution",
    scope: "UnresolvedFixture",
    reason: sourceFinding.reason,
    source,
    evidenceAttempted: ["source-analysis"],
    evidenceRefs: ["source"],
  }
}

function sourceWith(unresolved: unknown[]): ComponentContractArtifactSource {
  const artifact = family(unresolved)
  const contractSet: ComponentContractSet = {
    schemaVersion: 1, id: "unresolved-proof-set", status: "candidate", designSystemId: "proof", sourceBaselineCommit: "a".repeat(40), tokenContractId: "proof-tokens", familyCount: 1,
    familyFiles: ["contracts/components/families/unresolved-proof.json"], interfaceFiles: [],
  }
  const index: ComponentContractIndex = { schemaVersion: 1, contractSetId: contractSet.id, familyCount: 1, families: [{ familyId: artifact.id, components: ["UnresolvedFixture"], hooks: [], helpers: [] }] }
  const artifacts = new Map<string, unknown>([
    ["contracts/components/component-contract-set.json", contractSet],
    ["contracts/components/index.json", index],
    [contractSet.familyFiles[0], artifact],
  ])
  return { readJson(path) { return structuredClone(artifacts.get(path)) } }
}

function load(unresolved: unknown[]) {
  return createComponentContractLoader({
    source: sourceWith(unresolved),
    sourceReconciler: (context) => reconcileCanonicalComponentSources(root, context),
  })
}

describe("source unresolved evidence reconciliation", () => {
  test("the source analyzer records a stable unresolved expression identity", () => {
    expect(sourceFinding).toMatchObject({ sourcePath: join(root, sourcePath), expressionKind: "TemplateExpression", sourceText: "`bg-${className}`" })
  })

  test.each([
    ["missing", [], "omits unresolved source evidence"],
    ["extra forged", [unresolvedFact(), unresolvedFact(sourceFact({ start: sourceFinding.start + 1 }))], "contains unresolved fact with no matching source evidence"],
    ["duplicate", [unresolvedFact(), unresolvedFact()], "duplicates unresolved source evidence"],
    ["wrong source", [unresolvedFact(sourceFact({ sourcePath: "tests/fixtures/forged.tsx" }))], "omits unresolved source evidence"],
    ["wrong span", [unresolvedFact(sourceFact({ start: sourceFinding.start + 1 }))], "omits unresolved source evidence"],
    ["wrong expression", [unresolvedFact(sourceFact({ sourceText: "`bg-forged`" }))], "omits unresolved source evidence"],
  ])("production reconciliation rejects %s unresolved evidence", (_name, unresolved, expected) => {
    expect(load(unresolved)).toThrow(expected)
  })

  test("production reconciliation accepts the exact unresolved source multiset", () => {
    expect(load([unresolvedFact()])).not.toThrow()
  })
})
