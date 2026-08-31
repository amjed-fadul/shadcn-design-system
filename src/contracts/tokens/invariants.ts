import type { TokenContract, TokenDefinition } from "./types"

const knownSourceIds = new Set(["canonical-theme", "tailwind-theme"])
const primitiveColorNames = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky",
  "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "black", "white",
] as const
const primitiveColorPattern = new RegExp(
  `(?:--(?:color-)?|color\\.)(?:${primitiveColorNames.join("|")})(?:-|$)`,
  "i",
)
const excludedScopeNamespaces = [
  "border-width",
  "inset-shadow",
  "drop-shadow",
  "text-shadow",
  "breakpoint",
  "container",
  "blur",
  "animation",
  "canvas-product-token",
] as const

function excludedScopeNamespace(tokenId: string): string | undefined {
  if (primitiveColorNames.some((name) => tokenId === `color.${name}` || tokenId.startsWith(`color.${name}-`))) return "primitive-color"
  return excludedScopeNamespaces.find((namespace) =>
    tokenId === namespace
    || tokenId.startsWith(`${namespace}.`)
    || tokenId.endsWith(`.${namespace}`)
    || tokenId.includes(`.${namespace}.`),
  )
}

function findReferenceCycle(
  tokens: TokenDefinition[],
  kind: "alias" | "derived" | "reference",
): string[] | undefined {
  const dependencies = new Map<string, string[]>()
  const referenceKinds = new Map<string, "alias" | "derived">()

  for (const token of tokens) {
    if ((kind === "alias" || kind === "reference") && token.value.kind === "alias") {
      dependencies.set(token.id, [token.value.tokenId])
      referenceKinds.set(token.id, "alias")
    }
    if ((kind === "derived" || kind === "reference") && token.value.kind === "derived") {
      dependencies.set(token.id, token.value.dependencies)
      referenceKinds.set(token.id, "derived")
    }
  }

  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function visit(tokenId: string): string[] | undefined {
    if (active.has(tokenId)) {
      const cycleStart = path.indexOf(tokenId)
      const cycle = [...path.slice(cycleStart), tokenId]
      if (kind !== "reference") return cycle

      const cycleKinds = new Set(cycle.map((id) => referenceKinds.get(id)))
      return cycleKinds.has("alias") && cycleKinds.has("derived") ? cycle : undefined
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

  for (const entry of contract.coverage.representedElsewhere) {
    for (const tokenId of entry.tokenIds) {
      if (!tokenIds.has(tokenId)) {
        errors.push(`Coverage namespace ${entry.namespace} references missing token ${tokenId}.`)
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

  const mixedReferenceCycle = findReferenceCycle(contract.tokens, "reference")
  if (mixedReferenceCycle) {
    errors.push(`Derived-reference cycle: ${mixedReferenceCycle.join(" -> ")}.`)
  }

  for (const rule of contract.derivedRules) {
    if (!tokenIds.has(rule.baseTokenId)) {
      errors.push(`Derived rule ${rule.id} references missing base token ${rule.baseTokenId}.`)
    }
  }

  return errors
}

export function validatePhaseTwoTokenScope(contract: TokenContract): string[] {
  const errors: string[] = []

  for (const token of contract.tokens) {
    const excludedNamespace = excludedScopeNamespace(token.id)
    if (excludedNamespace) {
      errors.push(`Token ${token.id} uses excluded Phase 2 scope namespace ${excludedNamespace}.`)
    }
    if (token.id.startsWith("spacing.") && token.id !== "spacing.unit") {
      errors.push(`Token ${token.id} is outside the sole Phase 2 spacing.unit token scope.`)
    }
    if (primitiveColorPattern.test(JSON.stringify({ binding: token.binding, value: token.value }))) {
      errors.push(`Token ${token.id} introduces a primitive-color mapping.`)
    }
  }

  return errors
}

export function assertTokenContractInvariants(contract: TokenContract): void {
  const errors = [
    ...validateTokenContractInvariants(contract),
    ...validatePhaseTwoTokenScope(contract),
  ]
  if (errors.length > 0) throw new Error(errors.join("\n"))
}
