import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import schema from "../contracts/tokens/token-contract.schema.json"

function validContract() {
  return {
    schemaVersion: 1,
    id: "shadcn-radix-token-contract-002",
    status: "candidate",
    baselineSnapshotId: "shadcn-radix-bootstrap-000",
    sourceBaselineCommit: "f9682ce3238f1fc5f41a91b1d6953a40c12d2288",
    sourceProvenancePath: "provenance/token-contract-source.json",
    modes: ["light", "dark"],
    coverage: {
      contracted: ["color"],
      representedElsewhere: [],
      notContracted: [],
    },
    derivedRules: [],
    tokens: [
      {
        id: "color.background",
        category: "color",
        sourceId: "canonical-theme",
        binding: { cssVariable: "--background" },
        value: {
          kind: "modes",
          values: { light: "oklch(1 0 0)", dark: "oklch(0 0 0)" },
        },
      },
    ],
  }
}

function validate(document: unknown) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  })

  return ajv.compile(schema)(document)
}

describe("token contract JSON Schema", () => {
  test("accepts a minimal valid contract", () => {
    expect(validate(validContract())).toBe(true)
  })

  test("accepts the approved signed spacing multiplier rule without a lower bound", () => {
    const contract: any = validContract()
    contract.derivedRules = [{
      id: "spacing.multiplier",
      category: "spacing",
      baseTokenId: "spacing.unit",
      parameter: { name: "multiplier", type: "number" },
      expression: "calc(var(--spacing) * <multiplier>)",
      tailwindSyntax: "--spacing(<multiplier>)",
      producesTokenIds: false,
    }]

    expect(validate(contract)).toBe(true)
  })

  test.each([
    ["unknown top-level property", (contract: Record<string, unknown>) => ({ ...contract, unexpected: true })],
    ["invalid token ID", (contract: any) => ({ ...contract, tokens: [{ ...contract.tokens[0], id: "background" }] })],
    ["invalid CSS variable", (contract: any) => ({ ...contract, tokens: [{ ...contract.tokens[0], binding: { cssVariable: "background" } }] })],
    ["unknown category", (contract: any) => ({ ...contract, tokens: [{ ...contract.tokens[0], category: "palette" }] })],
    ["mode token without dark", (contract: any) => ({ ...contract, tokens: [{ ...contract.tokens[0], value: { kind: "modes", values: { light: "oklch(1 0 0)" } } }] })],
    ["literal value with an illegal extra field", (contract: any) => ({ ...contract, tokens: [{ ...contract.tokens[0], category: "radius", id: "radius.sm", value: { kind: "literal", value: "0.25rem", invalid: true } }] })],
    ["legacy nonnegative spacing bound", (contract: any) => ({ ...contract, derivedRules: [{ id: "spacing.multiplier", category: "spacing", baseTokenId: "spacing.unit", parameter: { name: "multiplier", type: "number", minimum: 0 }, expression: "calc(var(--spacing) * <multiplier>)", tailwindSyntax: "--spacing(<multiplier>)", producesTokenIds: false }] })],
    ["derived rule with wrong producesTokenIds value", (contract: any) => ({ ...contract, derivedRules: [{ id: "spacing.multiplier", category: "spacing", baseTokenId: "spacing.unit", parameter: { name: "multiplier", type: "number" }, expression: "calc(var(--spacing) * <multiplier>)", tailwindSyntax: "--spacing(<multiplier>)", producesTokenIds: true }] })],
  ])("rejects a contract with %s", (_description, mutate) => {
    // Each mutation models untrusted JSON at the runtime boundary.
    const malformed = mutate(validContract() as unknown as Record<string, unknown>)

    expect(validate(malformed)).toBe(false)
  })
})
