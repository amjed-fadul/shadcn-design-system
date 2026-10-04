import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { listModuleExports } from "../src/contracts/components/render-source-analysis"
import type { ComponentContractIndex } from "../src/contracts/components/loader"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import { canonicalCapabilityIds, canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = <T,>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8"))
const manifest = read<ComponentContractSet>("contracts/components/component-contract-set.json")
const index = read<ComponentContractIndex>("contracts/components/index.json")
const provenance = read<{ familySource: { familyIds: string[]; familyCount: number }; capabilityIds: string[] }>("provenance/component-contract-source.json")
const families = canonicalFamilyIds.map((id) => read<ComponentFamilyContract>(`contracts/components/families/${id}.json`))

describe("canonical component inventory", () => {
  test("registers the independently approved 42 families in every authority", () => {
    expect(canonicalFamilyIds).toHaveLength(42)
    expect(manifest.familyCount).toBe(42)
    expect(manifest.familyFiles).toEqual(canonicalFamilyIds.map((id) => `contracts/components/families/${id}.json`))
    expect(index.contractSetId).toBe(manifest.id)
    expect(index.familyCount).toBe(42)
    expect(index.families.map((family) => family.familyId)).toEqual(canonicalFamilyIds)
    expect(provenance.familySource.familyCount).toBe(42)
    expect(provenance.familySource.familyIds).toEqual(canonicalFamilyIds)
    expect(families.map((family) => family.id)).toEqual(canonicalFamilyIds)
  })

  test("indexes exactly the public source exports with their JSX, hook, and helper classifications", () => {
    const expected = families.map((family) => {
      const names = listModuleExports(join(root, family.source.canonicalPath)).map(({ name }) => name).sort()
      expect(family.exports.map(({ name }) => name).sort(), family.id).toEqual(names)
      return {
        familyId: family.id,
        components: names.filter((name) => /^[A-Z]/.test(name)),
        hooks: names.filter((name) => /^use[A-Z]/.test(name)),
        helpers: names.filter((name) => !/^[A-Z]|^use[A-Z]/.test(name)),
      }
    })
    expect(index.families).toEqual(expected)
  })

  test("registers every and only physically referenced inherited interface", () => {
    const referenced = new Set<string>()
    for (const family of families) for (const entry of family.exports) {
      if (!entry.component) continue
      entry.component.inherits.forEach((id) => referenced.add(id))
      const rendering = entry.component.rendering
      const trees = "nodes" in rendering ? [rendering] : rendering.alternatives.map((alternative) => alternative.rendering)
      for (const tree of trees) for (const node of tree.nodes) {
        if (node.host.kind === "inherited-interface") referenced.add(node.host.interfaceId)
      }
    }
    expect(manifest.interfaceFiles).toEqual([...referenced].sort().map((id) => `contracts/components/interfaces/${id}.json`))
    expect(manifest.interfaceFiles.map((path) => read<InheritedInterfaceContract>(path).id).sort()).toEqual([...referenced].sort())
  })

  test("pins the complete capability union without allowing contracts to authorize arbitrary capabilities", () => {
    const required = new Set(families.flatMap((family) => family.exports.flatMap((entry) => entry.component
      ? Object.values(entry.component.composition).flat() : [])))
    expect([...required].sort()).toEqual(canonicalCapabilityIds)
    expect(provenance.capabilityIds).toEqual(canonicalCapabilityIds)
  })
})
