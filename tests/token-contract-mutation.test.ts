import { readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import committedIndex from "../contracts/tokens/index.json"
import committedContract from "../contracts/tokens/token-contract.json"
import schema from "../contracts/tokens/token-contract.schema.json"
import { getTokenContract } from "../src/contracts/tokens/contract"
import {
  assertTokenContractInvariants,
  validatePhaseTwoTokenScope,
  validateTokenContractInvariants,
} from "../src/contracts/tokens/invariants"
import { buildTokenIndex, type TokenIndex } from "../src/contracts/tokens/index"
import {
  listTokenIds,
  listTokens,
  lookupToken,
} from "../src/contracts/tokens/query"
import type { TokenContract, TokenDefinition } from "../src/contracts/tokens/types"
import {
  extractCssBlock,
  parseCustomProperties,
} from "./helpers/css-custom-properties"

function cloneContract(): TokenContract {
  return structuredClone(committedContract) as TokenContract
}

function cloneIndex(): TokenIndex {
  return structuredClone(committedIndex) as TokenIndex
}

function token(contract: TokenContract, id: string): TokenDefinition {
  const candidate = contract.tokens.find((definition) => definition.id === id)
  if (!candidate) throw new Error(`Missing committed token fixture: ${id}`)
  return candidate
}

function replaceToken(contract: TokenContract, replacedId: string, replacement: TokenDefinition): void {
  const position = contract.tokens.findIndex((definition) => definition.id === replacedId)
  if (position < 0) throw new Error(`Missing replacement target: ${replacedId}`)
  contract.tokens[position] = replacement
}

function expectInvariantRejection(contract: TokenContract, error: string): void {
  expect(validateTokenContractInvariants(contract)).toContain(error)
}

function expectScopeRejection(contract: TokenContract, error: string): void {
  expect(validatePhaseTwoTokenScope(contract)).toContain(error)
}

function sourceErrors(contract: TokenContract): string[] {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const root = parseCustomProperties(extractCssBlock(css, ":root"))
  const dark = parseCustomProperties(extractCssBlock(css, ".dark"))
  const theme = parseCustomProperties(extractCssBlock(
    readFileSync(new URL("../node_modules/tailwindcss/theme.css", import.meta.url), "utf8"),
    "@theme default",
  ))
  const errors: string[] = []
  const background = token(contract, "color.background")
  const radius = token(contract, "radius.sm")
  const fontSize = token(contract, "font-size.sm")
  const shadow = token(contract, "shadow.sm")

  if (background.value.kind !== "modes" || background.value.values.light !== root.get("--background") || background.value.values.dark !== dark.get("--background")) {
    errors.push("color.background no longer reconciles to canonical light/dark CSS.")
  }
  if (radius.value.kind !== "derived" || radius.value.expression !== "calc(var(--radius) * 0.6)" || radius.value.dependencies.join(",") !== "radius.base") {
    errors.push("radius.sm no longer reconciles to the canonical radius expression.")
  }
  if (fontSize.value.kind !== "typography-size" || fontSize.value.fontSize !== theme.get("--text-sm") || fontSize.value.lineHeight !== theme.get("--text-sm--line-height")) {
    errors.push("font-size.sm no longer reconciles to the Tailwind font-size source.")
  }
  if (shadow.value.kind !== "literal" || shadow.value.value !== theme.get("--shadow-sm")) {
    errors.push("shadow.sm no longer reconciles to the Tailwind shadow source.")
  }

  return errors
}

describe("Phase 2 token contract mutation resistance", () => {
  test("rejects duplicate token IDs", () => {
    const contract = cloneContract()
    contract.tokens.push(structuredClone(token(contract, "color.background")))

    expectInvariantRejection(contract, "Duplicate token ID: color.background.")
  })

  test("rejects a dangling alias", () => {
    const contract = cloneContract()
    token(contract, "font.heading").value = { kind: "alias", tokenId: "font.nonexistent" }

    expectInvariantRejection(contract, "Alias token font.heading targets missing token font.nonexistent.")
  })

  test("rejects a pure alias cycle", () => {
    const contract = cloneContract()
    token(contract, "font.sans").value = { kind: "alias", tokenId: "font.heading" }
    token(contract, "font.heading").value = { kind: "alias", tokenId: "font.sans" }

    expectInvariantRejection(contract, "Alias cycle: font.sans -> font.heading -> font.sans.")
  })

  test("rejects a mixed alias and derived-reference cycle", () => {
    const contract = cloneContract()
    token(contract, "font.heading").value = { kind: "alias", tokenId: "radius.sm" }
    token(contract, "radius.sm").value = {
      kind: "derived",
      expression: "var(--font-heading)",
      dependencies: ["font.heading"],
    }

    expectInvariantRejection(contract, "Derived-reference cycle: radius.sm -> font.heading -> radius.sm.")
  })

  test("rejects a missing derived dependency", () => {
    const contract = cloneContract()
    token(contract, "radius.sm").value = {
      kind: "derived",
      expression: "calc(var(--radius) * 0.6)",
      dependencies: ["radius.nonexistent"],
    }

    expectInvariantRejection(contract, "Derived token radius.sm depends on missing token radius.nonexistent.")
  })

  test("rejects a derivation rule with a missing base token", () => {
    const contract = cloneContract()
    ;(contract.derivedRules[0] as unknown as { baseTokenId: string }).baseTokenId = "spacing.nonexistent"

    expectInvariantRejection(contract, "Derived rule spacing.multiplier references missing base token spacing.nonexistent.")
  })

  test("rejects duplicate canonical CSS-variable ownership", () => {
    const contract = cloneContract()
    token(contract, "color.foreground").binding.cssVariable = "--background"

    expectInvariantRejection(contract, "Canonical CSS variable --background is bound by both color.background and color.foreground.")
  })

  test("rejects category coverage drift", () => {
    const contract = cloneContract()
    contract.coverage.contracted = contract.coverage.contracted.filter((category) => category !== "color")

    expectInvariantRejection(contract, "Token color.background has category color outside coverage.contracted.")
  })

  test("rejects coverage metadata that names a missing token", () => {
    const contract = cloneContract()
    contract.coverage.representedElsewhere[0].tokenIds[0] = "color.nonexistent"

    expectInvariantRejection(contract, "Coverage namespace border-color references missing token color.nonexistent.")
  })

  test("rejects an inferred primitive-color mapping on an otherwise semantic token", () => {
    const contract = cloneContract()
    token(contract, "color.background").binding.tailwindExpression = "var(--color-neutral-500)"

    expectScopeRejection(contract, "Token color.background introduces a primitive-color mapping.")
  })

  test("rejects a raw blue palette mapping on an otherwise semantic token", () => {
    const contract = cloneContract()
    token(contract, "color.background").binding.tailwindExpression = "var(--color-blue-500)"

    expectScopeRejection(contract, "Token color.background introduces a primitive-color mapping.")
  })

  test("runtime invariant assertion includes the Phase 2 scope boundary", () => {
    const contract = cloneContract()
    replaceToken(contract, "color.chart-5", {
      ...structuredClone(token(contract, "color.background")),
      id: "color.neutral-500",
      binding: { cssVariable: "--neutral-500", tailwindThemeVariable: "--color-neutral-500", tailwindExpression: "var(--neutral-500)" },
    })

    expect(() => assertTokenContractInvariants(contract)).toThrow("Token color.neutral-500 uses excluded Phase 2 scope namespace primitive-color.")
  })

  test("schema rejects a missing dark mode", () => {
    const contract = cloneContract()
    const background = token(contract, "color.background") as unknown as { value: { kind: string; values: Record<string, string> } }
    delete background.value.values.dark
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

    expect(validate(contract)).toBe(false)
  })

  test("schema rejects an unknown structured token property", () => {
    const contract = cloneContract()
    ;(token(contract, "color.background") as TokenDefinition & { invented?: true }).invented = true
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

    expect(validate(contract)).toBe(false)
  })

  test.each([
    [
      "primitive color",
      (contract: TokenContract) => replaceToken(contract, "color.chart-5", {
        ...structuredClone(token(contract, "color.background")),
        id: "color.neutral-500",
        binding: { cssVariable: "--neutral-500", tailwindThemeVariable: "--color-neutral-500", tailwindExpression: "var(--neutral-500)" },
      }),
      "Token color.neutral-500 uses excluded Phase 2 scope namespace primitive-color.",
    ],
    [
      "border-width token",
      (contract: TokenContract) => replaceToken(contract, "shadow.xs", {
        ...structuredClone(token(contract, "shadow.sm")),
        id: "border-width.default",
        binding: { cssVariable: "--border-width" },
      }),
      "Token border-width.default uses excluded Phase 2 scope namespace border-width.",
    ],
    [
      "per-multiplier spacing token",
      (contract: TokenContract) => replaceToken(contract, "shadow.xs", {
        ...structuredClone(token(contract, "spacing.unit")),
        id: "spacing.17",
        binding: { cssVariable: "--spacing-17" },
      }),
      "Token spacing.17 is outside the sole Phase 2 spacing.unit token scope.",
    ],
    [
      "excluded shadow namespace",
      (contract: TokenContract) => replaceToken(contract, "shadow.xs", {
        ...structuredClone(token(contract, "shadow.sm")),
        id: "inset-shadow.xs",
        binding: { cssVariable: "--inset-shadow-xs" },
      }),
      "Token inset-shadow.xs uses excluded Phase 2 scope namespace inset-shadow.",
    ],
  ])("rejects an equal-count substitution for an invented %s", (_description, mutate, error) => {
    const contract = cloneContract()
    mutate(contract)

    expect(contract.tokens).toHaveLength(82)
    expectScopeRejection(contract, error)
  })

  test.each(["breakpoint", "container", "blur", "animation", "canvas-product-token"] as const)("rejects an equal-count substitution for an invented %s namespace", (namespace) => {
    const contract = cloneContract()
    replaceToken(contract, "color.chart-5", {
      ...structuredClone(token(contract, "color.background")),
      id: `color.${namespace}`,
      binding: { cssVariable: `--${namespace}`, tailwindThemeVariable: `--color-${namespace}`, tailwindExpression: `var(--${namespace})` },
    })

    expect(contract.tokens).toHaveLength(82)
    expectScopeRejection(contract, `Token color.${namespace} uses excluded Phase 2 scope namespace ${namespace}.`)
  })

  test("rejects an equal-count substitution for an invented red palette token", () => {
    const contract = cloneContract()
    replaceToken(contract, "color.chart-5", {
      ...structuredClone(token(contract, "color.background")),
      id: "color.red-500",
      binding: { cssVariable: "--red-500", tailwindThemeVariable: "--color-red-500", tailwindExpression: "var(--red-500)" },
    })

    expect(contract.tokens).toHaveLength(82)
    expectScopeRejection(contract, "Token color.red-500 uses excluded Phase 2 scope namespace primitive-color.")
  })

  test("rejects an index missing a committed token", () => {
    const index = cloneIndex()
    index.categories.find((category) => category.id === "color")?.tokenIds.splice(0, 1)

    expect(index).not.toEqual(buildTokenIndex(cloneContract()))
  })

  test("rejects an index that substitutes an invented token while preserving its size", () => {
    const index = cloneIndex()
    const category = index.categories.find((candidate) => candidate.id === "shadow")
    if (!category) throw new Error("Missing shadow index category")
    category.tokenIds[0] = "spacing.17"

    expect(index.tokenCount).toBe(82)
    expect(index.categories.flatMap((candidate) => candidate.tokenIds)).toHaveLength(82)
    expect(index).not.toEqual(buildTokenIndex(cloneContract()))
  })

  test("rejects an index that moves a real token into the wrong category", () => {
    const index = cloneIndex()
    const radius = index.categories.find((category) => category.id === "radius")
    const shadow = index.categories.find((category) => category.id === "shadow")
    if (!radius || !shadow) throw new Error("Missing index category")
    radius.tokenIds.splice(radius.tokenIds.indexOf("radius.sm"), 1)
    shadow.tokenIds.push("radius.sm")

    expect(index.categories.flatMap((category) => category.tokenIds)).toHaveLength(82)
    expect(index).not.toEqual(buildTokenIndex(cloneContract()))
  })

  test.each([
    ["a semantic light/dark color", (contract: TokenContract) => {
      const background = token(contract, "color.background")
      if (background.value.kind === "modes") background.value.values.dark = "oklch(0.5 0 0)"
    }, "color.background no longer reconciles to canonical light/dark CSS."],
    ["a canonical radius expression", (contract: TokenContract) => {
      const radius = token(contract, "radius.sm")
      if (radius.value.kind === "derived") radius.value.expression = "calc(var(--radius) * 0.7)"
    }, "radius.sm no longer reconciles to the canonical radius expression."],
    ["a Tailwind font-size value", (contract: TokenContract) => {
      const fontSize = token(contract, "font-size.sm")
      if (fontSize.value.kind === "typography-size") fontSize.value.fontSize = "99rem"
    }, "font-size.sm no longer reconciles to the Tailwind font-size source."],
    ["a Tailwind shadow value", (contract: TokenContract) => {
      const shadow = token(contract, "shadow.sm")
      if (shadow.value.kind === "literal") shadow.value.value = "none"
    }, "shadow.sm no longer reconciles to the Tailwind shadow source."],
  ])("detects source-contract drift for %s", (_description, mutate, error) => {
    const contract = cloneContract()
    mutate(contract)

    expect(sourceErrors(contract)).toContain(error)
  })

  test("does not permit mutations of canonical runtime state through any query boundary", () => {
    const contract = getTokenContract()
    const background = lookupToken("color.background")
    const tokens = listTokens()
    const tokenIds = listTokenIds()

    expect(() => { (contract as { status: string }).status = "candidate" }).toThrow()
    expect(() => { (contract.tokens as TokenDefinition[]).pop() }).toThrow()
    if (background.ok && background.token.value.kind === "modes") {
      const modeValues = background.token.value.values
      expect(() => { (background.token as { id: string }).id = "color.changed" }).toThrow()
      expect(() => { (modeValues as { light: string }).light = "changed" }).toThrow()
    }
    expect(() => { (contract.coverage.contracted as string[]).pop() }).toThrow()
    expect(() => { (contract.derivedRules[0] as unknown as { baseTokenId: string }).baseTokenId = "spacing.changed" }).toThrow()
    expect(() => { (tokens as TokenDefinition[]).pop() }).toThrow()
    expect(() => { (tokenIds as string[]).pop() }).toThrow()

    expect(getTokenContract().status).toBe("candidate")
    expect(lookupToken("color.background")).toEqual(background)
    expect(listTokens()).toHaveLength(82)
    expect(listTokenIds()).toHaveLength(82)
  })

  test("keeps the query boundary exact-match only", () => {
    const uncontracted = [
      "background",
      "--background",
      "Color.Background",
      " color.background",
      "color.background ",
      "#fff",
      "oklch(1 0 0)",
      "neutral-500",
      "color.neutral-500",
      "spacing.4",
      "spacing.17",
      "spacing.multiplier",
      "font.sans-serif",
      "radius.unknown",
    ]

    for (const tokenId of uncontracted) {
      expect(lookupToken(tokenId)).toEqual({ ok: false, code: "TOKEN_NOT_CONTRACTED", tokenId })
    }
  })
})
