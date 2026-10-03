import { readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import {
  assertTokenContractInvariants,
  validateTokenContractInvariants,
} from "../src/contracts/tokens/invariants"
import type { TokenContract, TokenDefinition } from "../src/contracts/tokens/types"
import {
  extractCssBlock,
  normalizeCssValue,
  parseCustomProperties,
} from "./helpers/css-custom-properties"
import schema from "../contracts/tokens/token-contract.schema.json"

const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
const expectedColors = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const

function readContract(): TokenContract {
  return JSON.parse(readFileSync(new URL("../contracts/tokens/token-contract.json", import.meta.url), "utf8")) as TokenContract
}

function properties(marker: string): Map<string, string> {
  return parseCustomProperties(extractCssBlock(cssSource, marker))
}

function token(contract: TokenContract, id: string): TokenDefinition {
  const definition = contract.tokens.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing token in test fixture: ${id}`)
  return definition
}

describe("CSS custom-property helper", () => {
  test("matches nested blocks by brace depth", () => {
    expect(extractCssBlock("@theme inline { --outer: one; @media (x) { --inner: two; } }", "@theme inline")).toContain("--inner: two;")
    expect(extractCssBlock(".dark { color: red; } .other { color: blue; }", ".dark")).toContain("color: red;")
  })

  test("throws clearly for a missing block", () => {
    expect(() => extractCssBlock(":root { --value: one; }", ".dark")).toThrow("CSS block marker not found")
  })

  test("parses multiline custom-property values and ignores regular declarations", () => {
    const block = `color: red;\n--multiline: calc(\n  var(--base) * 0.6\n);\n--quoted: "a  value";`
    expect(parseCustomProperties(block)).toEqual(new Map([
      ["--multiline", "calc( var(--base) * 0.6 )"],
      ["--quoted", '"a  value"'],
    ]))
  })

  test("normalizes insignificant whitespace without evaluating values", () => {
    expect(normalizeCssValue("  calc( var(--radius) * 0.6 )  ")).toBe("calc( var(--radius) * 0.6 )")
    expect(normalizeCssValue("oklch(1 0 0)")).toBe("oklch(1 0 0)")
  })
})

describe("canonical token contract", () => {
  test("matches the contract identity and exact category shape", () => {
    const contract = readContract()
    expect(contract.schemaVersion).toBe(1)
    expect(contract.id).toBe("shadcn-radix-token-contract-003")
    expect(contract.status).toBe("approved")
    expect(contract.baselineSnapshotId).toBe("shadcn-radix-bootstrap-000")
    expect(contract.sourceBaselineCommit).toBe("c662cbd9f18bc714b6d0e82ae1dfd8f27ff2e489")
    expect(contract.modes).toEqual(["light", "dark"])
    const canonicalTokens = contract.tokens.filter((candidate) => candidate.sourceId === "canonical-theme")
    expect(canonicalTokens).toHaveLength(49)
    expect(canonicalTokens.filter((candidate) => candidate.category === "color")).toHaveLength(37)
    expect(canonicalTokens.filter((candidate) => candidate.category === "radius")).toHaveLength(9)
    expect(canonicalTokens.filter((candidate) => candidate.category === "font-family")).toHaveLength(2)
    expect(canonicalTokens.filter((candidate) => candidate.category === "line-height")).toHaveLength(1)
    expect(new Set(canonicalTokens.map((candidate) => candidate.category))).toEqual(new Set(["color", "radius", "font-family", "line-height"]))
    expect(new Set(canonicalTokens.map((candidate) => candidate.id)).size).toBe(49)
  })

  test("reconciles all semantic colors, modes, and Tailwind aliases with canonical CSS", () => {
    const contract = readContract()
    const light = properties(":root")
    const dark = properties(".dark")
    const theme = properties("@theme inline")

    expect(expectedColors).toHaveLength(37)
    expect(expectedColors.every((name) => light.has(`--${name}`))).toBe(true)
    expect(expectedColors.every((name) => dark.has(`--${name}`))).toBe(true)
    expect(expectedColors.every((name) => theme.has(`--color-${name}`))).toBe(true)

    const colorTokens = contract.tokens.filter((candidate) => candidate.category === "color")
    expect(colorTokens.map((candidate) => candidate.id)).toEqual(expectedColors.map((name) => `color.${name}`))
    for (const name of expectedColors) {
      const candidate = token(contract, `color.${name}`)
      expect(candidate.binding).toEqual({
        cssVariable: `--${name}`,
        tailwindThemeVariable: `--color-${name}`,
        tailwindExpression: `var(--${name})`,
      })
      expect(candidate.value).toEqual({
        kind: "modes",
        values: { light: light.get(`--${name}`), dark: dark.get(`--${name}`) },
      })
      expect(theme.get(`--color-${name}`)).toBe(`var(--${name})`)
    }
  })

  test("does not introduce inferred primitive-palette relationships", () => {
    const contractText = readFileSync(new URL("../contracts/tokens/token-contract.json", import.meta.url), "utf8")
    const contract = readContract()
    const primitivePattern = /(?:^|[.\-/])(neutral|zinc|slate|gray|stone)(?:[-.]|$)/i
    for (const candidate of contract.tokens) {
      expect(candidate.id).not.toMatch(primitivePattern)
      expect(JSON.stringify(candidate.binding)).not.toMatch(primitivePattern)
      expect(JSON.stringify(candidate.value)).not.toMatch(primitivePattern)
    }
    expect(contractText).not.toMatch(/color\.(?:neutral|zinc|slate|gray|stone)-/i)
  })

  test("reconciles the canonical radius model and exact base dependency", () => {
    const contract = readContract()
    const root = properties(":root")
    const theme = properties("@theme inline")
    expect(token(contract, "radius.base")).toEqual({
      id: "radius.base",
      category: "radius",
      sourceId: "canonical-theme",
      binding: { cssVariable: "--radius" },
      value: { kind: "literal", value: root.get("--radius") },
    })
    const derived = new Map([
      ["sm", "calc(var(--radius) - 0.25rem)"],
      ["md", "calc(var(--radius) - 0.125rem)"],
      ["lg", "var(--radius)"],
      ["xl", "calc(var(--radius) + 0.25rem)"],
      ["2xl", "calc(var(--radius) + 0.5rem)"],
      ["3xl", "calc(var(--radius) + 0.75rem)"],
      ["4xl", "calc(var(--radius) + 1rem)"],
    ])
    for (const [name, expression] of derived) {
      const candidate = token(contract, `radius.${name}`)
      expect(candidate.binding).toEqual({ cssVariable: `--radius-${name}` })
      expect(candidate.value).toEqual({ kind: "derived", expression, dependencies: ["radius.base"] })
      expect(theme.get(`--radius-${name}`)).toBe(expression)
    }
    // Release 011: the pill radius equals Tailwind's static rounded-full value.
    expect(token(contract, "radius.full")).toEqual({
      id: "radius.full",
      category: "radius",
      sourceId: "canonical-theme",
      binding: { cssVariable: "--radius-full" },
      value: { kind: "literal", value: theme.get("--radius-full") },
    })
    expect(theme.get("--radius-full")).toBe("calc(infinity * 1px)")
  })

  test("reconciles the canonical display line-height", () => {
    const contract = readContract()
    const theme = properties("@theme inline")
    expect(token(contract, "line-height.display")).toEqual({
      id: "line-height.display",
      category: "line-height",
      sourceId: "canonical-theme",
      binding: { cssVariable: "--leading-display" },
      value: { kind: "literal", value: theme.get("--leading-display") },
    })
    expect(theme.get("--leading-display")).toBe("1.1")
  })

  test("reconciles Geist font and explicit heading alias", () => {
    const contract = readContract()
    const theme = properties("@theme inline")
    expect(token(contract, "font.sans")).toEqual({
      id: "font.sans",
      category: "font-family",
      sourceId: "canonical-theme",
      binding: { cssVariable: "--font-sans" },
      value: { kind: "literal", value: theme.get("--font-sans") },
    })
    expect(theme.get("--font-sans")).toBe('"Geist Variable", sans-serif')
    expect(theme.get("--font-heading")).toBe("var(--font-sans)")
    expect(token(contract, "font.heading")).toEqual({
      id: "font.heading",
      category: "font-family",
      sourceId: "canonical-theme",
      binding: { cssVariable: "--font-heading" },
      value: { kind: "alias", tokenId: "font.sans" },
    })
  })

  test("passes the real schema and semantic invariants", () => {
    const contract = readContract()
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    expect(ajv.compile(schema)(contract)).toBe(true)
    expect(validateTokenContractInvariants(contract)).toEqual([])
    expect(() => assertTokenContractInvariants(contract)).not.toThrow()
  })
})
