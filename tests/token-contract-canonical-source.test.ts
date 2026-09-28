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
    expect(contract.id).toBe("shadcn-radix-token-contract-002")
    expect(contract.status).toBe("candidate")
    expect(contract.baselineSnapshotId).toBe("shadcn-radix-bootstrap-000")
    expect(contract.sourceBaselineCommit).toBe("e04ee6822a0b49e227970e787940db96730c9222")
    expect(contract.modes).toEqual(["light", "dark"])
    const canonicalTokens = contract.tokens.filter((candidate) => candidate.sourceId === "canonical-theme")
    expect(canonicalTokens).toHaveLength(41)
    expect(canonicalTokens.filter((candidate) => candidate.category === "color")).toHaveLength(31)
    expect(canonicalTokens.filter((candidate) => candidate.category === "radius")).toHaveLength(8)
    expect(canonicalTokens.filter((candidate) => candidate.category === "font-family")).toHaveLength(2)
    expect(new Set(canonicalTokens.map((candidate) => candidate.category))).toEqual(new Set(["color", "radius", "font-family"]))
    expect(new Set(canonicalTokens.map((candidate) => candidate.id)).size).toBe(41)
  })

  test("reconciles all semantic colors, modes, and Tailwind aliases with canonical CSS", () => {
    const contract = readContract()
    const light = properties(":root")
    const dark = properties(".dark")
    const theme = properties("@theme inline")

    expect(expectedColors).toHaveLength(31)
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
      ["sm", "calc(var(--radius) * 0.6)"],
      ["md", "calc(var(--radius) * 0.8)"],
      ["lg", "var(--radius)"],
      ["xl", "calc(var(--radius) * 1.4)"],
      ["2xl", "calc(var(--radius) * 1.8)"],
      ["3xl", "calc(var(--radius) * 2.2)"],
      ["4xl", "calc(var(--radius) * 2.6)"],
    ])
    for (const [name, expression] of derived) {
      const candidate = token(contract, `radius.${name}`)
      expect(candidate.binding).toEqual({ cssVariable: `--radius-${name}` })
      expect(candidate.value).toEqual({ kind: "derived", expression, dependencies: ["radius.base"] })
      expect(theme.get(`--radius-${name}`)).toBe(expression)
    }
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
