import { describe, expect, test } from "vitest"

import {
  getTokenContract,
  isContractedToken,
  listTokenIds,
  listTokens,
  lookupToken,
} from "../src/contracts/tokens/query"
import { TOKEN_CATEGORY_ORDER } from "../src/contracts/tokens/index"
import type { TokenCategory } from "../src/contracts/tokens/types"

const validIdsByCategory: Record<TokenCategory, string> = {
  color: "color.background",
  radius: "radius.sm",
  "font-family": "font.heading",
  "font-size": "font-size.sm",
  "font-weight": "font-weight.medium",
  "letter-spacing": "letter-spacing.tight",
  "line-height": "line-height.normal",
  spacing: "spacing.unit",
  shadow: "shadow.md",
}

const expectedCategoryCounts: Record<TokenCategory, number> = {
  color: 31,
  radius: 8,
  "font-family": 2,
  "font-size": 13,
  "font-weight": 9,
  "letter-spacing": 6,
  "line-height": 5,
  spacing: 1,
  shadow: 7,
}

const invalidIds = [
  "background",
  "primary",
  "Color.Background",
  "COLOR.BACKGROUND",
  " color.background",
  "color.background ",
  "--background",
  "--color-background",
  "neutral-500",
  "color.neutral-500",
  "#fff",
  "#ffffff",
  "oklch(1 0 0)",
  "0.25rem",
  "spacing.4",
  "spacing.17",
  "spacing.multiplier",
  "radius.unknown",
  "font.sans-serif",
]

describe("token contract query boundary", () => {
  test("looks up an exact contracted token from every category", () => {
    for (const [category, tokenId] of Object.entries(validIdsByCategory)) {
      const result = lookupToken(tokenId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.token).toBe(getTokenContract().tokens.find((token) => token.id === tokenId))
        expect(result.token.category).toBe(category)
      }
    }
  })

  test("rejects every non-exact input and preserves its original failure ID", () => {
    for (const tokenId of invalidIds) {
      const result = lookupToken(tokenId)

      expect(result).toEqual({
        ok: false,
        code: "TOKEN_NOT_CONTRACTED",
        tokenId,
      })
    }
  })

  test("reports contracted status exactly consistently with lookup for all IDs", () => {
    const validIds = getTokenContract().tokens.map((token) => token.id)

    expect(validIds).toHaveLength(82)
    for (const tokenId of [...validIds, ...invalidIds]) {
      expect(isContractedToken(tokenId)).toBe(lookupToken(tokenId).ok)
    }
  })

  test("lists all tokens and IDs in canonical category and lexical ID order", () => {
    expect(listTokens()).toHaveLength(82)
    expect(listTokenIds()).toHaveLength(82)
    expect(listTokenIds()).toEqual(listTokens().map((token) => token.id))

    const expectedIds = TOKEN_CATEGORY_ORDER.flatMap((category) =>
      getTokenContract().tokens
        .filter((token) => token.category === category)
        .map((token) => token.id)
        .sort(),
    )
    expect(listTokenIds()).toEqual(expectedIds)

    for (const category of TOKEN_CATEGORY_ORDER) {
      expect(listTokens(category)).toHaveLength(expectedCategoryCounts[category])
      expect(listTokenIds(category)).toHaveLength(expectedCategoryCounts[category])
      expect(listTokenIds(category)).toEqual([...listTokenIds(category)].sort())
      expect(listTokens(category).every((token) => token.category === category)).toBe(true)
    }
  })

  test("deep-freezes the canonical contract and nested JSON structures", () => {
    const contract = getTokenContract()
    const colorToken = lookupToken("color.background")

    expect(getTokenContract()).toBe(contract)
    expect(Object.isFrozen(contract)).toBe(true)
    expect(Object.isFrozen(contract.tokens)).toBe(true)
    expect(Object.isFrozen(contract.coverage)).toBe(true)
    expect(Object.isFrozen(contract.coverage.contracted)).toBe(true)
    expect(Object.isFrozen(contract.derivedRules)).toBe(true)
    expect(Object.isFrozen(contract.derivedRules[0])).toBe(true)
    expect(Object.isFrozen(contract.derivedRules[0].parameter)).toBe(true)
    expect(colorToken.ok).toBe(true)
    if (colorToken.ok) {
      expect(Object.isFrozen(colorToken.token)).toBe(true)
      expect(Object.isFrozen(colorToken.token.binding)).toBe(true)
      expect(Object.isFrozen(colorToken.token.value)).toBe(true)
      if (colorToken.token.value.kind === "modes") {
        expect(Object.isFrozen(colorToken.token.value.values)).toBe(true)
      }
    }
  })

  test("does not permit returned lists or tokens to mutate canonical query state", () => {
    const tokenList = listTokens()
    const idList = listTokenIds()
    const originalFirstId = idList[0]
    const originalBackground = lookupToken("color.background")

    expect(Object.isFrozen(tokenList)).toBe(true)
    expect(Object.isFrozen(idList)).toBe(true)
    expect(() => (tokenList as unknown as { pop(): unknown }).pop()).toThrow()
    expect(() => (idList as unknown as { push(id: string): number }).push("not.a.token")).toThrow()
    if (originalBackground.ok) {
      expect(() => { (originalBackground.token as { id: string }).id = "mutated.id" }).toThrow()
    }

    expect(listTokenIds()[0]).toBe(originalFirstId)
    expect(lookupToken("color.background")).toEqual(originalBackground)
    expect(getTokenContract().tokens.some((token) => token.id === "mutated.id")).toBe(false)
  })

  test("does not permit a token returned from listTokens to mutate canonical query state", () => {
    const listedBackground = listTokens().find((token) => token.id === "color.background")

    expect(listedBackground).toBeDefined()
    expect(Object.isFrozen(listedBackground)).toBe(true)
    expect(() => { (listedBackground as { id: string }).id = "mutated.from-list" }).toThrow()

    const lookedUpBackground = lookupToken("color.background")
    expect(lookedUpBackground.ok).toBe(true)
    if (lookedUpBackground.ok) {
      expect(lookedUpBackground.token).toBe(listedBackground)
      expect(lookedUpBackground.token.id).toBe("color.background")
    }
    expect(listTokens().some((token) => token.id === "mutated.from-list")).toBe(false)
    expect(getTokenContract().tokens.some((token) => token.id === "mutated.from-list")).toBe(false)
  })
})
