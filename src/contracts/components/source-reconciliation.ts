import type { ComponentFamilyContract, SourceExpressionIdentity, UnresolvedFact } from "./types"

export type SourceUnresolvedFinding = SourceExpressionIdentity & { reason: string }
export type SourceEvidenceResult = { topic: string; scope: string; unresolved: readonly SourceUnresolvedFinding[] }

/** Source-owned facts are supplied by a configured source adapter. */
export type SourceOwnedSlotFact = {
  propName: string
  replacesHost: boolean
  forwardsProps: boolean
  childCardinality: { min: number; max: number }
  /** Source-specific exception requirements, when the cardinality has one. */
  childRequires?: string[]
}

/** Turns source-analyzer disagreement into a stable production rejection. */
export function reconcileSourceFacts(label: string, contracted: unknown, source: unknown): string[] {
  return JSON.stringify(contracted) === JSON.stringify(source) ? [] : [`${label} does not match source evidence.`]
}

/** Preserves source-analyzer failures as a contract rejection rather than a test-only assertion. */
export function reconcileSourceAnalyzerErrors(label: string, errors: readonly string[]): string[] {
  return errors.length === 0 ? [] : [`${label} source reconciliation failed: ${errors.join(" ")}`]
}

/**
 * Refuses to treat an artifact as complete when source analysis recorded
 * evidence that the artifact does not explicitly carry as unresolved.
 */
export function reconcileSourceEvidenceCompleteness(family: ComponentFamilyContract, analyses: readonly SourceEvidenceResult[]): string[] {
  const key = (topic: string, scope: string, reason: string, source: SourceExpressionIdentity | undefined) => source
    ? JSON.stringify({ topic, scope, reason, sourcePath: source.sourcePath, start: source.start, end: source.end, expressionKind: source.expressionKind, sourceText: source.sourceText })
    : undefined
  const expected = new Map<string, number>()
  for (const analysis of analyses) for (const finding of analysis.unresolved) {
    const findingKey = key(analysis.topic, analysis.scope, finding.reason, finding)
    expected.set(findingKey!, (expected.get(findingKey!) ?? 0) + 1)
  }
  const actual = new Map<string, number>()
  const unbound: UnresolvedFact[] = []
  for (const fact of family.unresolved) {
    const factKey = key(fact.topic, fact.scope, fact.reason, fact.source)
    if (!factKey) unbound.push(fact)
    else actual.set(factKey, (actual.get(factKey) ?? 0) + 1)
  }
  const errors: string[] = []
  for (const [findingKey, count] of expected) {
    const observed = actual.get(findingKey) ?? 0
    if (observed < count) errors.push(`Family ${family.id} omits unresolved source evidence for ${JSON.parse(findingKey).scope}.`)
    if (observed > count) errors.push(`Family ${family.id} duplicates unresolved source evidence for ${JSON.parse(findingKey).scope}.`)
  }
  for (const findingKey of actual.keys()) if (!expected.has(findingKey)) errors.push(`Family ${family.id} contains unresolved fact with no matching source evidence.`)
  for (const _fact of unbound) errors.push(`Family ${family.id} contains unresolved fact with no source expression identity.`)
  return errors
}

/** Reconciles source-owned delegated-host facts supplied by a source adapter. */
export function reconcileSourceOwnedSlotCardinality(family: ComponentFamilyContract, exportName: string, sourceFacts: readonly SourceOwnedSlotFact[], sourceOwnedPropNames: readonly string[] = []): string[] {
  const component = family.exports.find((entry) => entry.name === exportName)?.component
  if (!component) return [`Family ${family.id} does not contain component export ${exportName}.`]
  const errors: string[] = []
  for (const propName of sourceOwnedPropNames) {
    if (component.slots.some((slot) => slot.propName === propName) && !sourceFacts.some((fact) => fact.propName === propName)) errors.push(`Component ${exportName} source-owned slot is not present in source: ${propName}.`)
  }
  for (const fact of sourceFacts) {
    const slot = component.slots.find((candidate) => candidate.propName === fact.propName)
    if (!slot) {
      errors.push(`Component ${exportName} is missing source-owned slot: ${fact.propName}.`)
      continue
    }
    if (slot.replacesHost !== fact.replacesHost) errors.push(`Slot ${exportName}.${fact.propName} must retain source-owned replacement-host semantics.`)
    if (slot.forwardsProps !== fact.forwardsProps) errors.push(`Slot ${exportName}.${fact.propName} must retain source-owned prop-forwarding semantics.`)
    if (slot.childCardinality.min !== fact.childCardinality.min || slot.childCardinality.max !== fact.childCardinality.max) {
      errors.push(`Slot ${exportName}.${fact.propName} must retain source-owned child cardinality ${fact.childCardinality.min}..${fact.childCardinality.max}.`)
    }
    if (fact.childRequires && JSON.stringify(slot.childRequires) !== JSON.stringify(fact.childRequires)) {
      errors.push(`Slot ${exportName}.${fact.propName} must retain source-owned child requirements.`)
    }
  }
  return errors
}
