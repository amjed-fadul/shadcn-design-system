import committedIndex from "../contracts/tokens/index.json"
import { describe, expect, test } from "vitest"

import { getTokenContract } from "../src/contracts/tokens/contract"
import {
  buildTokenIndex,
  TOKEN_CATEGORY_ORDER,
} from "../src/contracts/tokens/index"
import type { TokenCategory, TokenContract } from "../src/contracts/tokens/types"

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
} as const

describe("token contract index", () => {
  test("committed index exactly reconciles to the canonical contract", () => {
    expect(committedIndex).toEqual(buildTokenIndex(getTokenContract()))
  })

  test("contains the complete compact projection in canonical category order", () => {
    expect(committedIndex.tokenCount).toBe(82)
    expect(committedIndex.categories).toHaveLength(9)
    expect(committedIndex.categories.map((category) => category.id)).toEqual(TOKEN_CATEGORY_ORDER)

    for (const category of committedIndex.categories) {
      expect(category.tokenIds).toHaveLength(expectedCategoryCounts[category.id as TokenCategory])
      expect(category.tokenIds).toEqual([...category.tokenIds].sort())
    }

    const indexedIds = committedIndex.categories.flatMap((category) => category.tokenIds)
    expect(new Set(indexedIds)).toHaveLength(82)
    expect(indexedIds).not.toContain("spacing.multiplier")
    expect(new Set(indexedIds)).toEqual(new Set(getTokenContract().tokens.map((token) => token.id)))
  })

  test("keeps discovery data compact without token details", () => {
    const indexJson = JSON.stringify(committedIndex)

    for (const category of committedIndex.categories) {
      expect(Object.keys(category).sort()).toEqual(["id", "tokenIds"])
    }
    expect(indexJson).not.toContain("cssVariable")
    expect(indexJson).not.toContain("--background")
    expect(indexJson).not.toContain("oklch(")
  })

  test("builds the same index from a shuffled valid contract clone", () => {
    const shuffled = structuredClone(getTokenContract()) as TokenContract
    shuffled.tokens.reverse()

    expect(buildTokenIndex(shuffled)).toEqual(buildTokenIndex(getTokenContract()))
  })
})
