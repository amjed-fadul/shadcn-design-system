import type { TokenCategory, TokenContract } from "./types"

export const TOKEN_CATEGORY_ORDER = [
  "color",
  "radius",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
  "spacing",
  "shadow",
] as const

export type TokenIndex = {
  schemaVersion: 1
  contractId: "shadcn-radix-token-contract-002"
  baselineSnapshotId: "shadcn-radix-bootstrap-000"
  tokenCount: number
  modes: ["light", "dark"]
  categories: Array<{
    id: TokenCategory
    tokenIds: string[]
  }>
}

export function buildTokenIndex(contract: TokenContract): TokenIndex {
  return {
    schemaVersion: 1,
    contractId: contract.id,
    baselineSnapshotId: contract.baselineSnapshotId,
    tokenCount: contract.tokens.length,
    modes: [...contract.modes] as ["light", "dark"],
    categories: TOKEN_CATEGORY_ORDER
      .filter((category) => contract.coverage.contracted.includes(category))
      .map((category) => ({
        id: category,
        tokenIds: contract.tokens
          .filter((token) => token.category === category)
          .map((token) => token.id)
          .sort(),
      })),
  }
}
