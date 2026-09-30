import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { reconcileCanonicalComponentSources } from "../src/contracts/components/canonical-source-reconciliation"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const readJson = <T>(path: string) => JSON.parse(readFileSync(join(root, path), "utf8")) as T
const manifest = readJson<ComponentContractSet>("contracts/components/component-contract-set.json")
const familyPaths = new Map(manifest.familyFiles.map((path) => [path.split("/").at(-1)!.replace(".json", ""), path]))
const interfaces = manifest.interfaceFiles.map((path) => readJson<InheritedInterfaceContract>(path))
const alertFamily = readJson<ComponentFamilyContract>(familyPaths.get("alert")!)
const sourceBackedFamilies = ["alert-dialog", "avatar", "collapsible", "command", "drawer", "popover", "radio-group", "toggle-group"]
  .map((familyId) => readJson<ComponentFamilyContract>(familyPaths.get(familyId)!))

const authorityErrors = (families: ComponentFamilyContract[]) => reconcileCanonicalComponentSources(root, { contractSet: manifest, families, interfaces })
  .filter((error) => error.includes(" composition does not match source evidence.") || error.includes(" conditional API does not match source evidence."))

describe("canonical source-backed composition and conditional authority", () => {
  test("accepts the promoted families' exact source-backed facts", () => {
    expect(authorityErrors(sourceBackedFamilies)).toEqual([])
  }, 120_000)

  test("rejects removed release.5 composition and conditional facts", () => {
    const mutated = structuredClone(sourceBackedFamilies)
    mutated.find((family) => family.id === "alert-dialog")!.exports.find((entry) => entry.name === "AlertDialog")!.component!.composition.provides = []
    mutated.find((family) => family.id === "toggle-group")!.exports.find((entry) => entry.name === "ToggleGroup")!.component!.conditionalApi = []

    expect(authorityErrors(mutated)).toEqual(expect.arrayContaining([
      "Component AlertDialog composition does not match source evidence.",
      "Component ToggleGroup conditional API does not match source evidence.",
    ]))
  }, 120_000)

  test("rejects a missing source-declared inherited prop omission", () => {
    const mutated = structuredClone(alertFamily)
    delete mutated.exports.find((entry) => entry.name === "Status")!.component!.inheritedPropOmissions

    expect(reconcileCanonicalComponentSources(root, { contractSet: manifest, families: [mutated], interfaces })).toEqual(expect.arrayContaining([
      "Component Status inherited prop omissions do not match source evidence.",
      "Component Status: Source inherited prop omission aria-live is missing from the contract.",
      "Component Status: Source inherited prop omission role is missing from the contract.",
    ]))
  }, 120_000)
})
