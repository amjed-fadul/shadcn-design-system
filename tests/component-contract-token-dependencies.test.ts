import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import contractSetJson from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import type { ComponentContractSet, ComponentFamilyContract, TokenDependency } from "../src/contracts/components/types"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependenciesForExport, analyzeComponentTokenSource, auditComponentTokenCoverage, compareComponentTokenDependenciesForExport } from "./helpers/component-token-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))
const contractSet = contractSetJson as ComponentContractSet

function loadFamily(file: string): ComponentFamilyContract {
  return JSON.parse(readFileSync(join(root, file), "utf8")) as ComponentFamilyContract
}

const families = contractSet.familyFiles.map(loadFamily)
const approvedTokenIds = new Set(tokenContract.tokens.map((token) => token.id))
const approvedDerivedRuleIds = new Set(tokenContract.derivedRules.map((rule) => rule.id))

function sourcePath(familyId: string) {
  return join(root, "src/components/ui", `${familyId}.tsx`)
}

function normalized(dependencies: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>) {
  return dependencies
    .map(({ tokenId, when, viaDerivedRule }) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) }))
    .filter((dependency, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(dependency)) === index)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

describe("Phase 3 Task 7 cross-family token dependency closure", () => {
  test("reconciles token dependencies per component export across the canonical family scope", () => {
    const mismatches: string[] = []
    for (const family of families) for (const entry of family.exports) {
      if (!entry.component) continue
      const source = sourcePath(family.id)
      const comparison = compareComponentTokenDependenciesForExport(source, entry.name, entry.component.tokenDependencies)
      mismatches.push(...comparison.map((error) => `${family.id}.${entry.name}: ${error}`))
      if (comparison.length === 0) {
        try {
          expect(normalized(entry.component.tokenDependencies)).toEqual(normalized(analyzeComponentTokenDependenciesForExport(source, entry.name)))
        } catch (error) {
          mismatches.push(`${family.id}.${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([])
  })

  test("reports zero missing, invented, unresolved, and suspicious token facts", () => {
    const closure = { missing: 0, invented: 0, unresolved: 0, suspiciousContractedNamespace: 0 }
    for (const family of families) {
      for (const entry of family.exports) {
        if (!entry.component) continue
        const source = sourcePath(family.id)
        const comparison = compareComponentTokenDependenciesForExport(source, entry.name, entry.component.tokenDependencies)
        closure.missing += comparison.filter((error) => error.startsWith("Missing source token dependency")).length
        closure.invented += comparison.filter((error) => error.startsWith("Invented token dependency")).length
        closure.unresolved += comparison.filter((error) => error.startsWith("Unresolved class evidence")).length
      }
      closure.suspiciousContractedNamespace += auditComponentTokenCoverage(sourcePath(family.id)).filter(({ classification }) => classification === "suspicious-contracted-namespace").length
      expect(analyzeComponentTokenSource(sourcePath(family.id)).unresolved, family.id).toEqual([])
    }

    expect(closure).toEqual({ missing: 0, invented: 0, unresolved: 0, suspiciousContractedNamespace: 0 })
  })

  test("keeps every dependency inside the approved token and derivation authorities", () => {
    for (const family of families) for (const entry of family.exports) for (const dependency of entry.component?.tokenDependencies ?? []) {
      expect(approvedTokenIds.has(dependency.tokenId), `${family.id}.${entry.name} ${dependency.tokenId}`).toBe(true)
      if (dependency.viaDerivedRule) expect(approvedDerivedRuleIds.has(dependency.viaDerivedRule.id), `${family.id}.${entry.name} ${dependency.viaDerivedRule.id}`).toBe(true)
      if (dependency.tokenId === "spacing.unit" && dependency.viaDerivedRule) expect(dependency.viaDerivedRule.id).toBe("spacing.multiplier")
    }
  })

  test("detects adversarial missing and invented Button dependencies without weakening variant facts", () => {
    const button = families.find((family) => family.id === "button")!
    const source = sourcePath("button")
    const component = button.exports.find((entry) => entry.name === "Button")!.component!
    const destructive = component.tokenDependencies.filter((dependency) => dependency.when?.propName === "variant" && dependency.when.equals === "destructive")
    const outline = component.tokenDependencies.filter((dependency) => dependency.when?.propName === "variant" && dependency.when.equals === "outline")
    const standard = component.tokenDependencies.filter((dependency) => dependency.when?.propName === "variant" && dependency.when.equals === "default")
    expect(destructive).not.toEqual([])
    expect(outline).not.toEqual([])
    expect(standard).not.toEqual([])
    expect(normalized(destructive)).not.toEqual(normalized(outline))
    expect(compareComponentTokenDependenciesForExport(source, "Button", component.tokenDependencies.slice(1))).not.toEqual([])
    expect(compareComponentTokenDependenciesForExport(source, "Button", [...component.tokenDependencies, { tokenId: "spacing.17", evidenceRefs: ["source", "tokens"] }]).some((error) => error.includes("Invented token dependency"))).toBe(true)
  })
})
