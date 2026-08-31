import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import type { TokenContract, TokenDefinition } from "../src/contracts/tokens/types"
import {
  extractCssBlock,
  normalizeCssValue,
  parseCustomProperties,
} from "./helpers/css-custom-properties"

const themePath = new URL("../node_modules/tailwindcss/theme.css", import.meta.url)
const packagePath = new URL("../package.json", import.meta.url)
const provenancePath = new URL("../provenance/token-contract-source.json", import.meta.url)
const contractPath = new URL("../contracts/tokens/token-contract.json", import.meta.url)

const names = {
  "font-size": ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"],
  "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
  "letter-spacing": ["tighter", "tight", "normal", "wide", "wider", "widest"],
  "line-height": ["tight", "snug", "normal", "relaxed", "loose"],
  shadow: ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"],
} as const

function readContract(): TokenContract {
  return JSON.parse(readFileSync(contractPath, "utf8")) as TokenContract
}

function findToken(contract: TokenContract, id: string): TokenDefinition {
  const token = contract.tokens.find((candidate) => candidate.id === id)
  if (!token) throw new Error(`Missing token: ${id}`)
  return token
}

function expectedIds(category: keyof typeof names): string[] {
  return names[category].map((name) => `${category}.${name}`)
}

describe("pinned Tailwind theme token source", () => {
  test("pins Tailwind 4.3.3 and the installed theme.css integrity", () => {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { dependencies: Record<string, string> }
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as { sources: { tailwindTheme: { version: string, themeCssSha256: string } } }
    const themeCss = readFileSync(themePath)

    expect(packageJson.dependencies.tailwindcss).toBe("4.3.3")
    expect(provenance.sources.tailwindTheme.version).toBe("4.3.3")
    expect(createHash("sha256").update(themeCss).digest("hex")).toBe(provenance.sources.tailwindTheme.themeCssSha256)
  })

  test("recognizes the pinned package's --spacing(number) theme function offline", () => {
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as {
      sources: { tailwindTheme: { spacingFunction: { path: string, sha256: string, marker: string } } }
    }
    const evidence = provenance.sources.tailwindTheme.spacingFunction
    const source = readFileSync(new URL(`../${evidence.path}`, import.meta.url))

    expect(createHash("sha256").update(source).digest("hex")).toBe(evidence.sha256)
    expect(source.toString("utf8")).toContain(evidence.marker)
    expect(evidence.marker).toBe("K=/^(--spacing)\\(/i")
  })

  test("reconciles every contracted Tailwind value to @theme default only", () => {
    const themeCss = readFileSync(themePath, "utf8")
    const properties = parseCustomProperties(extractCssBlock(themeCss, "@theme default"))
    const contract = readContract()

    const expectedByCategory: Record<keyof typeof names, string[]> = {
      "font-size": expectedIds("font-size"),
      "font-weight": expectedIds("font-weight"),
      "letter-spacing": expectedIds("letter-spacing"),
      "line-height": expectedIds("line-height"),
      shadow: expectedIds("shadow"),
    }
    for (const [category, ids] of Object.entries(expectedByCategory) as Array<[keyof typeof names, string[]]>) {
      expect(contract.tokens.filter((token) => token.category === category).map((token) => token.id)).toEqual(ids)
    }
    expect(contract.tokens.filter((token) => token.category === "spacing").map((token) => token.id)).toEqual(["spacing.unit"])

    for (const name of names["font-size"]) {
      const token = findToken(contract, `font-size.${name}`)
      const cssVariable = `--text-${name}`
      const lineHeightVariable = `${cssVariable}--line-height`
      expect(properties.has(cssVariable)).toBe(true)
      expect(properties.has(lineHeightVariable)).toBe(true)
      expect(token.sourceId).toBe("tailwind-theme")
      expect(token.binding).toEqual({ cssVariable, companionVariables: { lineHeight: lineHeightVariable } })
      expect(token.value).toEqual({
        kind: "typography-size",
        fontSize: properties.get(cssVariable),
        lineHeight: properties.get(lineHeightVariable),
      })
    }

    for (const [category, prefix] of [["font-weight", "--font-weight-"], ["letter-spacing", "--tracking-"], ["line-height", "--leading-"], ["shadow", "--shadow-"]] as const) {
      for (const name of names[category]) {
        const cssVariable = `${prefix}${name}`
        const token = findToken(contract, `${category}.${name}`)
        expect(properties.has(cssVariable)).toBe(true)
        expect(token.sourceId).toBe("tailwind-theme")
        expect(token.binding).toEqual({ cssVariable })
        expect(token.value).toEqual({ kind: "literal", value: properties.get(cssVariable) })
      }
    }

    const spacing = findToken(contract, "spacing.unit")
    expect(properties.has("--spacing")).toBe(true)
    expect(spacing.sourceId).toBe("tailwind-theme")
    expect(spacing.binding).toEqual({ cssVariable: "--spacing" })
    expect(spacing.value).toEqual({ kind: "literal", value: properties.get("--spacing") })
    expect(normalizeCssValue("calc(1.25 / 0.875)")).toBe(properties.get("--text-sm--line-height"))
  })
})
