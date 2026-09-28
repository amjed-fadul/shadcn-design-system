import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import tokenContract from "../../../contracts/tokens/token-contract.json"
import componentContractSource from "../../../provenance/component-contract-source.json"
import seedComponents from "../../../provenance/seed-components.json"
import { reconcileCanonicalComponentSources } from "./canonical-source-reconciliation"
import { ComponentContractLoadError, createComponentContractLoader, type ComponentContractArtifactSource, type LoadedComponentContracts } from "./loader"
import type { ComponentContractSet } from "./types"

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url))
const canonicalFamilyFiles = componentContractSource.familySource.familyIds.map((familyId) => `contracts/components/families/${familyId}.json`)
const canonicalCapabilityIds = new Set(componentContractSource.capabilityIds)

const canonicalSource: ComponentContractArtifactSource = {
  readJson(path) {
    const absolutePath = join(repositoryRoot, path)
    if (!existsSync(absolutePath)) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND", `Missing contract artifact: ${path}.`, path)
    try {
      return JSON.parse(readFileSync(absolutePath, "utf8"))
    } catch (error) {
      throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `Unable to parse contract artifact: ${path}. ${String(error)}`, path)
    }
  },
}

function canonicalContractSetErrors(contractSet: ComponentContractSet): string[] {
  const errors: string[] = []
  const expectedCount = componentContractSource.familySource.familyCount
  if (contractSet.familyCount !== expectedCount || contractSet.familyFiles.length !== expectedCount) errors.push(`The component contract set must match the pinned family count: ${expectedCount}.`)
  const actual = [...contractSet.familyFiles].sort()
  const expected = [...canonicalFamilyFiles].sort()
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) errors.push("Family manifest does not match the pinned canonical family scope.")
  return errors
}

function createCanonicalLoader(source: ComponentContractArtifactSource) {
  return createComponentContractLoader({
    source,
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
    capabilityIds: canonicalCapabilityIds,
    contractSetReconciler: canonicalContractSetErrors,
    sourceIdentityForFamily: (familyId) => {
      const sourceIdentity = seedComponents.components[familyId as keyof typeof seedComponents.components]
      return sourceIdentity ? { canonicalPath: sourceIdentity.canonicalPath, canonicalBlobSha: sourceIdentity.canonicalBlobSha } : undefined
    },
    requireSourceIdentity: true,
    sourceReconciler: (context) => reconcileCanonicalComponentSources(repositoryRoot, context),
  })
}

const canonicalLoader = createCanonicalLoader(canonicalSource)
// Warm the immutable, content-addressed source-evidence cache during module
// initialization so a normal contract load does not spend its test/request
// budget repeatedly rebuilding declaration programs and TSX ASTs.
canonicalLoader()

/** Loads the repository's canonical contract set with its pinned authorities. */
export function loadComponentContracts(source: ComponentContractArtifactSource = canonicalSource): LoadedComponentContracts {
  return source === canonicalSource ? canonicalLoader() : createCanonicalLoader(source)()
}
