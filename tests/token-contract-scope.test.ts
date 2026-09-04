import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import { validateTokenContractInvariants } from "../src/contracts/tokens/invariants"
import type { TokenContract } from "../src/contracts/tokens/types"
import schema from "../contracts/tokens/token-contract.schema.json"

const contractPath = new URL("../contracts/tokens/token-contract.json", import.meta.url)
const task3Base = "afb5dde2f0dbb4267350afe93be8d79887c7f5db"

function readContract(): TokenContract {
  return JSON.parse(readFileSync(contractPath, "utf8")) as TokenContract
}

describe("Phase 2 Tailwind contract scope", () => {
  test("has the exact 82-token category shape and one non-token-producing spacing rule", () => {
    const contract = readContract()
    const counts = Object.fromEntries([...new Set(contract.tokens.map((token) => token.category))].map((category) => [category, contract.tokens.filter((token) => token.category === category).length]))

    expect(counts).toEqual({
      color: 31,
      radius: 8,
      "font-family": 2,
      "font-size": 13,
      "font-weight": 9,
      "letter-spacing": 6,
      "line-height": 5,
      spacing: 1,
      shadow: 7,
    })
    expect(contract.tokens).toHaveLength(82)
    expect(contract.derivedRules).toEqual([{
      id: "spacing.multiplier",
      category: "spacing",
      baseTokenId: "spacing.unit",
      parameter: { name: "multiplier", type: "number" },
      expression: "calc(var(--spacing) * <multiplier>)",
      tailwindSyntax: "--spacing(<multiplier>)",
      producesTokenIds: false,
    }])
  })

  test("preserves every Task 3 definition and its canonical font and radius precedence", () => {
    const contract = readContract()
    const task3Contract = JSON.parse(execFileSync("git", ["show", `${task3Base}:contracts/tokens/token-contract.json`], { encoding: "utf8" })) as TokenContract

    expect(task3Contract.tokens).toHaveLength(41)
    expect(contract.tokens.slice(0, 41)).toEqual(task3Contract.tokens)
    expect(contract.tokens.find((token) => token.id === "radius.sm")?.value).toEqual({ kind: "derived", expression: "calc(var(--radius) * 0.6)", dependencies: ["radius.base"] })
    expect(contract.tokens.find((token) => token.id === "font.sans")?.value).toEqual({ kind: "literal", value: '"Geist Variable", sans-serif' })
    expect(contract.tokens.find((token) => token.id === "font.heading")?.value).toEqual({ kind: "alias", tokenId: "font.sans" })
  })

  test("states the approved coverage boundary without leaked namespaces", () => {
    const contract = readContract()
    const excluded = ["primitive-color", "border-width", "inset-shadow", "drop-shadow", "text-shadow", "breakpoint", "container", "blur", "animation", "canvas-product-token"]
    const forbidden = /(?:^|\.)(?:color\.(?:neutral|zinc|slate|gray|stone)-|border-width|inset-shadow|drop-shadow|text-shadow|breakpoint|container|blur|animation|canvas-product-token)(?:[.-]|$)/i

    expect(contract.coverage.contracted).toEqual(["color", "radius", "font-family", "font-size", "font-weight", "letter-spacing", "line-height", "spacing", "shadow"])
    expect(contract.coverage.representedElsewhere).toEqual([{
      namespace: "border-color",
      tokenIds: ["color.border", "color.input"],
      reason: "Border color semantics are already represented by the canonical semantic color contract.",
    }])
    expect(contract.coverage.notContracted.map((entry) => entry.namespace)).toEqual(excluded)
    expect(contract.coverage.notContracted.every((entry) => entry.reason.length > 0)).toBe(true)
    expect(contract.tokens.some((token) => token.id === "spacing.17")).toBe(false)
    expect(contract.tokens.every((token) => !forbidden.test(token.id))).toBe(true)
  })

  test("continues to satisfy the accepted schema and semantic invariants", () => {
    const contract = readContract()
    const ajv = new Ajv2020({ allErrors: true, strict: true })

    expect(ajv.compile(schema)(contract)).toBe(true)
    expect(validateTokenContractInvariants(contract)).toEqual([])
  })
})
