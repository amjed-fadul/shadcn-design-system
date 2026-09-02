import { createComponentContractLoader, type ComponentContractArtifactSource, type LoadedComponentContracts } from "../../src/contracts/components/loader"
import type { ComponentContractSet, ComponentFamilyContract } from "../../src/contracts/components/types"
import type { ExecutableContractSource } from "../../src/validator/types"

const contractSet: ComponentContractSet = {
  schemaVersion: 1,
  id: "nebula-components-001",
  status: "approved",
  designSystemId: "nebula",
  sourceBaselineCommit: "a".repeat(40),
  tokenContractId: "nebula-tokens-001",
  familyCount: 1,
  familyFiles: ["contracts/components/families/action-button.json"],
  interfaceFiles: [],
}

const family: ComponentFamilyContract = {
  schemaVersion: 1,
  id: "action-button",
  source: { canonicalPath: "fixtures/nebula/action-button.tsx", canonicalBlobSha: "b".repeat(40), implementationKind: "fictional" },
  evidence: { source: { kind: "canonical-source", source: "fixtures/nebula/action-button.tsx" } },
  exports: [{
    name: "ActionButton",
    kind: "component",
    authorableJsx: true,
    evidenceRefs: ["source"],
    component: {
      localProps: [{ name: "tone", required: false, type: { kind: "enum", values: ["strong", "quiet", "critical"] }, default: "quiet", evidenceRefs: ["source"] }],
      inherits: [],
      slots: [],
      inheritedPropDefaults: [],
      composition: { requires: [], provides: [], hardConstraints: [] },
      stateChannels: [],
      conditionalApi: [],
      events: [],
      tokenDependencies: [{ tokenId: "color.signal", evidenceRefs: ["source"] }],
      rendering: {
        rootNodeId: "host",
        publicPropsTargetNodeId: "host",
        nodes: [{ id: "host", host: { kind: "intrinsic", tag: "button" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }],
        portalBoundaries: [],
      },
      accessibility: [],
    },
  }],
  unresolved: [],
}

const index = {
  schemaVersion: 1 as const,
  contractSetId: contractSet.id,
  familyCount: 1,
  families: [{ familyId: family.id, components: ["ActionButton"], hooks: [], helpers: [] }],
}

const artifacts = new Map<string, unknown>([
  ["contracts/components/component-contract-set.json", contractSet],
  ["contracts/components/index.json", index],
  [contractSet.familyFiles[0], family],
])

const source: ComponentContractArtifactSource = {
  readJson(path) {
    const artifact = artifacts.get(path)
    if (artifact === undefined) throw new Error(`Missing fictional artifact: ${path}`)
    return structuredClone(artifact)
  },
}

type NeutralCompositionOptions = Readonly<{
  requires?: readonly string[]
  provides?: readonly string[]
  hardConstraints?: readonly string[]
}>

export function createNeutralExecutableContractSource(options: NeutralCompositionOptions = {}): ExecutableContractSource {
  const requires = [...(options.requires ?? [])]
  const provides = [...(options.provides ?? [])]
  const hardConstraints = [...(options.hardConstraints ?? [])]
  const neutralSource: ComponentContractArtifactSource = {
    readJson(path) {
      const artifact = source.readJson(path) as ComponentFamilyContract | ComponentContractSet | typeof index
      if (path !== contractSet.familyFiles[0]) return artifact

      const neutralFamily = artifact as ComponentFamilyContract
      neutralFamily.exports[0].component!.composition = { requires, provides, hardConstraints }
      return neutralFamily
    },
  }
  const componentContracts = createComponentContractLoader({
    source: neutralSource,
    tokenIds: new Set(["color.signal"]),
    derivedTokenRuleIds: new Set(),
    capabilityIds: new Set([...requires, ...provides, ...hardConstraints]),
    sourceReconciler: () => [],
  })()
  return {
    componentContracts,
    tokenContract: {
      id: "nebula-tokens-001",
      status: "approved",
      sourceBaselineCommit: "c".repeat(40),
      tokens: [{ id: "color.signal" }],
      derivedRules: [],
    },
  }
}

export type NeutralLoadedContracts = LoadedComponentContracts
