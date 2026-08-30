import type { TokenContract, TokenDefinition } from "./types"

const knownSourceIds = new Set(["canonical-theme", "tailwind-theme"])

function findReferenceCycle(tokens: TokenDefinition[], kind: "alias" | "derived"): string[] | undefined {
  const dependencies = new Map<string, string[]>()

  for (const token of tokens) {
    if (kind === "alias" && token.value.kind === "alias") {
      dependencies.set(token.id, [token.value.tokenId])
    }
    if (kind === "derived" && token.value.kind === "derived") {
      dependencies.set(token.id, token.value.dependencies)
    }
  }

  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function visit(tokenId: string): string[] | undefined {
    if (active.has(tokenId)) {
      const cycleStart = path.indexOf(tokenId)
      return [...path.slice(cycleStart), tokenId]
    }
    if (visited.has(tokenId)) return undefined

    visited.add(tokenId)
    active.add(tokenId)
    path.push(tokenId)
    for (const dependency of dependencies.get(tokenId) ?? []) {
      if (dependencies.has(dependency)) {
        const cycle = visit(dependency)
        if (cycle) return cycle
      }
    }
    path.pop()
    active.delete(tokenId)
    return undefined
  }

  for (const tokenId of dependencies.keys()) {
    const cycle = visit(tokenId)
    if (cycle) return cycle
  }

  return undefined
}

export function validateTokenContractInvariants(contract: TokenContract): string[] {
  const errors: string[] = []
  const tokenIds = new Set<string>()
  const duplicateIds = new Set<string>()

  for (const token of contract.tokens) {
    if (tokenIds.has(token.id)) duplicateIds.add(token.id)
    tokenIds.add(token.id)
  }
  for (const id of [...duplicateIds].sort()) {
    errors.push(`Duplicate token ID: ${id}.`)
  }

  for (const token of contract.tokens) {
    if (!knownSourceIds.has(token.sourceId)) {
      errors.push(`Token ${token.id} has unknown sourceId ${token.sourceId}.`)
    }
    if (!contract.coverage.contracted.includes(token.category)) {
      errors.push(`Token ${token.id} has category ${token.category} outside coverage.contracted.`)
    }
    if (token.category === "color") {
      if (token.value.kind !== "modes") {
        errors.push(`Color token ${token.id} must use a modes value.`)
      } else {
        if (!("light" in token.value.values)) errors.push(`Color token ${token.id} is missing a light mode value.`)
        if (!("dark" in token.value.values)) errors.push(`Color token ${token.id} is missing a dark mode value.`)
      }
    }
    if (token.value.kind === "alias" && !tokenIds.has(token.value.tokenId)) {
      errors.push(`Alias token ${token.id} targets missing token ${token.value.tokenId}.`)
    }
    if (token.value.kind === "derived") {
      for (const dependency of token.value.dependencies) {
        if (!tokenIds.has(dependency)) {
          errors.push(`Derived token ${token.id} depends on missing token ${dependency}.`)
        }
      }
    }
  }

  const canonicalVariables = new Map<string, string>()
  for (const token of contract.tokens) {
    if (token.sourceId !== "canonical-theme") continue
    const priorTokenId = canonicalVariables.get(token.binding.cssVariable)
    if (priorTokenId) {
      errors.push(`Canonical CSS variable ${token.binding.cssVariable} is bound by both ${priorTokenId} and ${token.id}.`)
    } else {
      canonicalVariables.set(token.binding.cssVariable, token.id)
    }
  }

  const aliasCycle = findReferenceCycle(contract.tokens, "alias")
  if (aliasCycle) errors.push(`Alias cycle: ${aliasCycle.join(" -> ")}.`)

  const derivedCycle = findReferenceCycle(contract.tokens, "derived")
  if (derivedCycle) errors.push(`Derived-reference cycle: ${derivedCycle.join(" -> ")}.`)

  for (const rule of contract.derivedRules) {
    if (!tokenIds.has(rule.baseTokenId)) {
      errors.push(`Derived rule ${rule.id} references missing base token ${rule.baseTokenId}.`)
    }
  }

  return errors
}

export function assertTokenContractInvariants(contract: TokenContract): void {
  const errors = validateTokenContractInvariants(contract)
  if (errors.length > 0) throw new Error(errors.join("\n"))
}
