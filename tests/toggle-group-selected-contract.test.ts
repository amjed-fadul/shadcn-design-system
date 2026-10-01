import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import tokenContract from "../contracts/tokens/token-contract.json"
import { analyzeComponentTokenDependenciesForExport, compareComponentTokenDependenciesForExport } from "../src/contracts/components/canonical-token-source-analysis"
import type { ComponentFamilyContract } from "../src/contracts/components/types"
import { contrastRatio, oklchToLinearSrgb } from "./helpers/oklch-contrast"

const root = process.cwd()
const source = join(root, "src/components/ui/toggle-group.tsx")
const family = JSON.parse(readFileSync(join(root, "contracts/components/families/toggle-group.json"), "utf8")) as ComponentFamilyContract
const dependencies = family.exports.find((entry) => entry.name === "ToggleGroupItem")!.component!.tokenDependencies
const selected = { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "on" }

function color(id: string, mode: "light" | "dark") {
  const token = tokenContract.tokens.find((entry) => entry.id === id)
  if (!token || token.value.kind !== "modes" || !token.value.values) throw new Error(`Missing mode color ${id}`)
  return oklchToLinearSrgb(token.value.values[mode])
}

describe("ToggleGroup selected source contract", () => {
  test("records semantic selected and focus offset dependencies", () => {
    expect(dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenId: "color.primary", when: selected }),
      expect.objectContaining({ tokenId: "color.primary-foreground", when: selected }),
      expect.objectContaining({ tokenId: "color.background" }),
    ]))
  })

  test("keeps the imported muted source graph truthful and reconciles all local overrides exactly", () => {
    expect(dependencies).toContainEqual({ tokenId: "color.muted", when: selected, evidenceRefs: ["source", "tokens"] })
    expect(compareComponentTokenDependenciesForExport(source, "ToggleGroupItem", dependencies)).toEqual([])
    const derived = analyzeComponentTokenDependenciesForExport(source, "ToggleGroupItem")
    expect(derived).toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenId: "color.muted", when: selected }),
      expect.objectContaining({ tokenId: "color.primary", when: selected }),
    ]))
    const missingSelected = dependencies.filter((fact) => fact.tokenId !== "color.primary")
    expect(compareComponentTokenDependenciesForExport(source, "ToggleGroupItem", missingSelected)).toContainEqual(expect.stringContaining("Missing source token dependency"))
  })

  test.each(["light", "dark"] as const)("semantic selected colors exceed contrast floors against the %s surface and hover", (mode) => {
    const selectedColor = color("color.primary", mode)
    expect(contrastRatio(selectedColor, color("color.background", mode))).toBeGreaterThan(4.5)
    expect(contrastRatio(selectedColor, color("color.muted", mode))).toBeGreaterThan(4.5)
    expect(contrastRatio(color("color.primary-foreground", mode), selectedColor)).toBeGreaterThan(4.5)
  })
})
