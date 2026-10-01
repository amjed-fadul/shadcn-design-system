import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import type { ComponentContractArtifactSource } from "../src/contracts/components/loader"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = fileURLToPath(new URL("../", import.meta.url))
const manifestPath = "contracts/components/component-contract-set.json"
const indexPath = "contracts/components/index.json"
const manifest = JSON.parse(readFileSync(join(root, manifestPath), "utf8")) as ComponentContractSet

function artifactPaths() {
  return [manifestPath, indexPath, ...manifest.familyFiles, ...manifest.interfaceFiles]
}

function diskSource(): ComponentContractArtifactSource {
  return {
    readJson(path) {
      return JSON.parse(readFileSync(join(root, path), "utf8"))
    },
  }
}

function memorySource(mutator?: (artifacts: Map<string, unknown>) => void): ComponentContractArtifactSource {
  const artifacts = new Map(artifactPaths().map((path) => [path, diskSource().readJson(path)]))
  mutator?.(artifacts)
  return {
    readJson(path) {
      if (!artifacts.has(path)) throw new Error(`missing fixture: ${path}`)
      return structuredClone(artifacts.get(path))
    },
  }
}

describe("component contract loader and derived index", () => {
  test("loads exactly the canonical 41 families and every manifest interface", () => {
    const loaded = loadComponentContracts()

    expect(["candidate", "approved"]).toContain(loaded.contractSet.status)
    expect(loaded.contractSet.familyCount).toBe(canonicalFamilyIds.length)
    expect(loaded.contractSet.familyFiles).toHaveLength(canonicalFamilyIds.length)
    expect(loaded.families).toHaveLength(canonicalFamilyIds.length)
    expect(loaded.interfaces).toHaveLength(manifest.interfaceFiles.length)
    expect(new Set(loaded.families.map((family) => family.id)).size).toBe(canonicalFamilyIds.length)
    expect(new Set(loaded.interfaces.map((contract) => contract.id)).size).toBe(loaded.interfaces.length)
    expect(loaded.families.map((family) => family.id)).toEqual(canonicalFamilyIds)
  })

  test("accepts both component contract lifecycle states", () => {
    for (const status of ["candidate", "approved"] as const) {
      const loaded = loadComponentContracts(memorySource((artifacts) => {
        const contractSet = artifacts.get(manifestPath) as ComponentContractSet
        contractSet.status = status
      }))
      expect(loaded.contractSet.status).toBe(status)
    }
  }, 30_000)

  test("rejects an unknown component contract lifecycle state", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const contractSet = artifacts.get(manifestPath) as unknown as { status: string }
      contractSet.status = "retired"
    }))).toThrow("COMPONENT_CONTRACT_SCHEMA_INVALID")
  })

  test("preserves helper, hook, and component classifications without promoting non-JSX exports", () => {
    const loaded = loadComponentContracts()
    const badge = loaded.families.find((family) => family.id === "badge")!
    const sidebar = loaded.families.find((family) => family.id === "sidebar")!
    const button = loaded.families.find((family) => family.id === "button")!

    expect(badge.exports.find((entry) => entry.name === "badgeVariants")).toMatchObject({ kind: "helper", authorableJsx: false })
    expect(sidebar.exports.find((entry) => entry.name === "useSidebar")).toMatchObject({ kind: "hook", authorableJsx: false })
    expect(button.exports.find((entry) => entry.name === "Button")).toMatchObject({ kind: "component", authorableJsx: true })
    expect(badge.exports.filter((entry) => entry.kind !== "component").every((entry) => entry.authorableJsx === false)).toBe(true)
    expect(sidebar.exports.filter((entry) => entry.kind !== "component").every((entry) => entry.authorableJsx === false)).toBe(true)
  })

  test("rejects missing, malformed, and drifted derived artifacts", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => artifacts.delete(manifest.familyFiles[0])))).toThrow("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get(manifest.familyFiles[0]) as Record<string, unknown>
      family.exports = "not-an-export-list"
    }))).toThrow("COMPONENT_CONTRACT_SCHEMA_INVALID")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const index = artifacts.get(indexPath) as { families: Array<{ components: string[] }> }
      index.families[0].components.reverse()
    }))).toThrow("COMPONENT_CONTRACT_INDEX_DRIFT")
  })

  test("rejects duplicate family and inherited-interface identities", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const contractSet = artifacts.get(manifestPath) as ComponentContractSet
      contractSet.familyFiles[1] = contractSet.familyFiles[0]
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const aliasPath = "contracts/components/interfaces/duplicate.json"
      const contract = structuredClone(artifacts.get(manifest.interfaceFiles[0])) as InheritedInterfaceContract
      artifacts.set(aliasPath, contract)
      const contractSet = artifacts.get(manifestPath) as ComponentContractSet
      contractSet.interfaceFiles[1] = aliasPath
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
  })

  test("rejects duplicate public exports", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get(manifest.familyFiles[0]) as ComponentFamilyContract
      family.exports.push(structuredClone(family.exports[0]))
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
  })

  test("rejects missing interfaces and missing or invalid derived indexes", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => artifacts.delete(manifest.interfaceFiles[0])))).toThrow("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND")
    expect(() => loadComponentContracts(memorySource((artifacts) => artifacts.delete(indexPath)))).toThrow("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const index = artifacts.get(indexPath) as { families: unknown[] }
      index.families = []
    }))).toThrow("COMPONENT_CONTRACT_INDEX_DRIFT")
  })

  test("rejects a valid-looking forged replacement family", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const originalPath = manifest.familyFiles[0]
      const forgedPath = "contracts/components/families/forged.json"
      const forgedFamily = structuredClone(artifacts.get(originalPath)) as ComponentFamilyContract
      forgedFamily.id = "forged"
      artifacts.set(forgedPath, forgedFamily)

      const contractSet = artifacts.get(manifestPath) as ComponentContractSet
      contractSet.familyFiles[0] = forgedPath
      const index = artifacts.get(indexPath) as { families: Array<{ familyId: string }> }
      index.families.find((family) => family.familyId === "accordion")!.familyId = "forged"
      index.families.sort((left, right) => left.familyId < right.familyId ? -1 : left.familyId > right.familyId ? 1 : 0)
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
  })

  test("rejects family source provenance drift", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get(manifest.familyFiles[0]) as ComponentFamilyContract
      family.source.canonicalBlobSha = "0".repeat(40)
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
  })

  test("deep-freezes loaded contract data and keeps repeated loads deterministic", () => {
    const first = loadComponentContracts()
    const second = loadComponentContracts()

    expect(first).toEqual(second)
    expect(Object.isFrozen(first.contractSet)).toBe(true)
    expect(Object.isFrozen(first.families)).toBe(true)
    expect(Object.isFrozen(first.families[0])).toBe(true)
    expect(Object.isFrozen(first.families[0].exports)).toBe(true)
    expect(Object.isFrozen(first.families[0].exports[0])).toBe(true)
    expect(Object.isFrozen(first.interfaces)).toBe(true)

    const button = first.families.find((family) => family.id === "button")!
    const dependency = button.exports.find((entry) => entry.name === "Button")!.component!.tokenDependencies.find((candidate) => candidate.viaDerivedRule)!
    expect(Object.isFrozen(dependency)).toBe(true)
    expect(Object.isFrozen(dependency.evidenceRefs)).toBe(true)
    expect(Object.isFrozen(dependency.viaDerivedRule)).toBe(true)

    expect(() => ((first.families as unknown as Array<{ id: string }>)[0].id = "mutated")).toThrow(TypeError)
    expect(() => (dependency.evidenceRefs as unknown as string[]).push("mutated")).toThrow(TypeError)
    expect(loadComponentContracts().families[0].id).toBe(first.families[0].id)
  })
})
