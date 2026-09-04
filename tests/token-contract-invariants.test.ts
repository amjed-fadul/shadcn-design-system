import { describe, expect, test } from "vitest"

import {
  assertTokenContractInvariants,
  validateTokenContractInvariants,
} from "../src/contracts/tokens/invariants"
import type { TokenContract } from "../src/contracts/tokens/types"

function validContract(): TokenContract {
  return {
    schemaVersion: 1,
    id: "shadcn-radix-token-contract-001",
    status: "candidate",
    baselineSnapshotId: "shadcn-radix-bootstrap-000",
    sourceBaselineCommit: "f9682ce3238f1fc5f41a91b1d6953a40c12d2288",
    sourceProvenancePath: "provenance/token-contract-source.json",
    modes: ["light", "dark"],
    coverage: { contracted: ["color", "spacing"], representedElsewhere: [], notContracted: [] },
    derivedRules: [{ id: "spacing.multiplier", category: "spacing", baseTokenId: "spacing.unit", parameter: { name: "multiplier", type: "number" }, expression: "calc(var(--spacing) * <multiplier>)", tailwindSyntax: "--spacing(<multiplier>)", producesTokenIds: false }],
    tokens: [
      { id: "color.background", category: "color", sourceId: "canonical-theme", binding: { cssVariable: "--background" }, value: { kind: "modes", values: { light: "white", dark: "black" } } },
      { id: "spacing.unit", category: "spacing", sourceId: "tailwind-theme", binding: { cssVariable: "--spacing" }, value: { kind: "literal", value: "0.25rem" } },
    ],
  }
}

function mutate(mutator: (contract: TokenContract) => void): TokenContract {
  const contract = structuredClone(validContract())
  mutator(contract)
  return contract
}

describe("token contract semantic invariants", () => {
  test("accepts a valid contract and assert API does not throw", () => {
    const contract = validContract()
    expect(validateTokenContractInvariants(contract)).toEqual([])
    expect(() => assertTokenContractInvariants(contract)).not.toThrow()
  })

  test.each([
    ["duplicate token IDs", (contract: TokenContract) => contract.tokens.push({ ...contract.tokens[1] }), "Duplicate token ID: spacing.unit."],
    ["unknown source IDs", (contract: TokenContract) => { (contract.tokens[0] as unknown as { sourceId: string }).sourceId = "unknown" }, "Token color.background has unknown sourceId unknown."],
    ["missing alias targets", (contract: TokenContract) => { contract.tokens[1].value = { kind: "alias", tokenId: "spacing.missing" } }, "Alias token spacing.unit targets missing token spacing.missing."],
    ["missing derived dependencies", (contract: TokenContract) => { contract.tokens[1].value = { kind: "derived", expression: "var(--missing)", dependencies: ["spacing.missing"] } }, "Derived token spacing.unit depends on missing token spacing.missing."],
    ["alias cycles", (contract: TokenContract) => { contract.tokens.push({ ...contract.tokens[1], id: "spacing.peer", binding: { cssVariable: "--spacing-peer" } }); contract.tokens[1].value = { kind: "alias", tokenId: "spacing.peer" }; contract.tokens[2].value = { kind: "alias", tokenId: "spacing.unit" } }, "Alias cycle: spacing.unit -> spacing.peer -> spacing.unit."],
    ["derived-reference cycles", (contract: TokenContract) => { contract.tokens.push({ ...contract.tokens[1], id: "spacing.peer", binding: { cssVariable: "--spacing-peer" } }); contract.tokens[1].value = { kind: "derived", expression: "var(--spacing-peer)", dependencies: ["spacing.peer"] }; contract.tokens[2].value = { kind: "derived", expression: "var(--spacing)", dependencies: ["spacing.unit"] } }, "Derived-reference cycle: spacing.unit -> spacing.peer -> spacing.unit."],
    ["mixed derived and alias cycles", (contract: TokenContract) => { contract.tokens.push({ ...contract.tokens[1], id: "spacing.peer", binding: { cssVariable: "--spacing-peer" } }); contract.tokens[1].value = { kind: "derived", expression: "var(--spacing-peer)", dependencies: ["spacing.peer"] }; contract.tokens[2].value = { kind: "alias", tokenId: "spacing.unit" } }, "Derived-reference cycle: spacing.unit -> spacing.peer -> spacing.unit."],
    ["color tokens with non-mode values", (contract: TokenContract) => { contract.tokens[0].value = { kind: "literal", value: "white" } }, "Color token color.background must use a modes value."],
    ["color mode maps missing light", (contract: TokenContract) => { contract.tokens[0].value = { kind: "modes", values: { dark: "black" } } as unknown as TokenContract["tokens"][number]["value"] }, "Color token color.background is missing a light mode value."],
    ["color mode maps missing dark", (contract: TokenContract) => { contract.tokens[0].value = { kind: "modes", values: { light: "white" } } as unknown as TokenContract["tokens"][number]["value"] }, "Color token color.background is missing a dark mode value."],
    ["categories absent from coverage", (contract: TokenContract) => { contract.tokens[1].category = "shadow" }, "Token spacing.unit has category shadow outside coverage.contracted."],
    ["duplicate canonical CSS variables", (contract: TokenContract) => { contract.tokens[1].sourceId = "canonical-theme"; contract.tokens[1].binding.cssVariable = "--background" }, "Canonical CSS variable --background is bound by both color.background and spacing.unit."],
    ["missing derived rule base tokens", (contract: TokenContract) => { (contract.derivedRules[0] as unknown as { baseTokenId: string }).baseTokenId = "spacing.missing" }, "Derived rule spacing.multiplier references missing base token spacing.missing."],
  ])("reports %s", (_description, mutateContract, expectedError) => {
    const errors = validateTokenContractInvariants(mutate(mutateContract))

    expect(errors).toEqual([expectedError])
  })

  test("throws all invariant errors as a single readable message", () => {
    const contract = mutate((candidate) => { candidate.tokens[0].value = { kind: "alias", tokenId: "color.missing" } })

    expect(() => assertTokenContractInvariants(contract)).toThrow("Alias token color.background targets missing token color.missing.")
  })
})
