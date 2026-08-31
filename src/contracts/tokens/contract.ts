import tokenContractJson from "../../../contracts/tokens/token-contract.json"

import { assertTokenContractInvariants } from "./invariants"
import type { TokenContract } from "./types"

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue)
    }
    Object.freeze(value)
  }

  return value
}

const tokenContract = tokenContractJson as TokenContract

assertTokenContractInvariants(tokenContract)
deepFreeze(tokenContract)

export function getTokenContract(): Readonly<TokenContract> {
  return tokenContract
}
