import { getTokenContract as getLoadedTokenContract } from "./contract"
import { TOKEN_CATEGORY_ORDER } from "./index"
import type { TokenCategory, TokenContract, TokenDefinition } from "./types"

export type TokenLookupSuccess = {
  ok: true
  token: TokenDefinition
}

export type TokenLookupFailure = {
  ok: false
  code: "TOKEN_NOT_CONTRACTED"
  tokenId: string
}

export type TokenLookupResult =
  | TokenLookupSuccess
  | TokenLookupFailure

const contract = getLoadedTokenContract()
const tokenById = new Map(contract.tokens.map((token) => [token.id, token]))
const tokensByCategory = new Map<TokenCategory, readonly TokenDefinition[]>(
  TOKEN_CATEGORY_ORDER.map((category) => [
    category,
    Object.freeze(
      contract.tokens
        .filter((token) => token.category === category)
        .slice()
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    ),
  ]),
)
const allTokens = Object.freeze(TOKEN_CATEGORY_ORDER.flatMap((category) => tokensByCategory.get(category) ?? []))

export function getTokenContract(): Readonly<TokenContract> {
  return contract
}

export function listTokens(category?: TokenCategory): readonly TokenDefinition[] {
  return Object.freeze([...(category === undefined ? allTokens : tokensByCategory.get(category) ?? [])])
}

export function listTokenIds(category?: TokenCategory): readonly string[] {
  return Object.freeze(listTokens(category).map((token) => token.id))
}

export function lookupToken(tokenId: string): TokenLookupResult {
  const token = tokenById.get(tokenId)

  return token === undefined
    ? { ok: false, code: "TOKEN_NOT_CONTRACTED", tokenId }
    : { ok: true, token }
}

export function isContractedToken(tokenId: string): boolean {
  return tokenById.has(tokenId)
}
