import type { ComponentContractSet, ComponentFamilyContract, ComponentInvariantAuthority, InheritedInterfaceContract } from "./types"

function hasEvidence(errors: string[], refs: string[], evidence: Record<string, unknown>, label: string) {
  if (refs.length === 0) errors.push(`${label} is missing evidence references.`)
  for (const ref of refs) if (!(ref in evidence)) errors.push(`${label} references missing evidence: ${ref}.`)
}

export function validateComponentFamilyInvariants(family: ComponentFamilyContract, authority: ComponentInvariantAuthority): string[] {
  const errors: string[] = []
  const names = new Set(family.exports.map((entry) => entry.name))
  const seenNames = new Set<string>()
  for (const entry of family.exports) {
    if (seenNames.has(entry.name)) errors.push(`Duplicate export name: ${entry.name}.`)
    seenNames.add(entry.name)
    hasEvidence(errors, entry.evidenceRefs, family.evidence, `Export ${entry.name}`)
    if (entry.kind === "component" && !entry.authorableJsx) errors.push(`Component export ${entry.name} must be JSX-authorable.`)
    if (entry.kind !== "component" && entry.authorableJsx) errors.push(`${entry.kind === "hook" ? "Hook" : "Helper"} export ${entry.name} must not be JSX-authorable.`)
    if (entry.kind === "component" && !entry.component) errors.push(`Component export ${entry.name} is missing a component definition.`)
    if (entry.kind !== "component" && entry.component) errors.push(`${entry.kind === "hook" ? "Hook" : "Helper"} export ${entry.name} must not carry a component definition.`)
    if (!entry.component) continue
    const component = entry.component
    const localNames = new Set<string>()
    for (const prop of component.localProps) {
      if (localNames.has(prop.name)) errors.push(`Component ${entry.name} has duplicate local prop: ${prop.name}.`)
      localNames.add(prop.name); hasEvidence(errors, prop.evidenceRefs, family.evidence, `Local prop ${entry.name}.${prop.name}`)
    }
    const inheritedNames = new Set<string>()
    for (const inherits of component.inherits) {
      if (!authority.interfaceIds.has(inherits)) errors.push(`Component ${entry.name} inherits unknown interface: ${inherits}.`)
      for (const propName of authority.interfacePropNames.get(inherits) ?? []) inheritedNames.add(propName)
    }
    for (const propName of localNames) if (inheritedNames.has(propName)) errors.push(`Component ${entry.name} local prop collides with inherited prop: ${propName}.`)
    const props = new Set([...localNames, ...inheritedNames])
    for (const state of component.stateChannels) { hasEvidence(errors, state.evidenceRefs, family.evidence, `State channel ${entry.name}.${state.name}`); if (!props.has(state.propName)) errors.push(`Component ${entry.name} state channel ${state.name} references unknown prop: ${state.propName}.`) }
    for (const event of component.events) { hasEvidence(errors, event.evidenceRefs, family.evidence, `Event ${entry.name}.${event.propName}`); if (!props.has(event.propName)) errors.push(`Component ${entry.name} event references unknown prop: ${event.propName}.`) }
    for (const token of component.tokenDependencies) { hasEvidence(errors, token.evidenceRefs, family.evidence, `Token dependency ${entry.name}.${token.tokenId}`); if (!authority.tokenIds.has(token.tokenId)) errors.push(`Component ${entry.name} references unknown token: ${token.tokenId}.`); if (token.viaDerivedRule && !authority.derivedTokenRuleIds.has(token.viaDerivedRule.id)) errors.push(`Component ${entry.name} references unknown derived token rule: ${token.viaDerivedRule.id}.`) }
    for (const conditional of component.conditionalApi) hasEvidence(errors, conditional.evidenceRefs, family.evidence, `Conditional API ${entry.name}.${conditional.propName}`)
    for (const automatic of component.rendering.automaticStructure) { hasEvidence(errors, automatic.evidenceRefs, family.evidence, `Automatic structure ${entry.name}.${automatic.exportName}`); if (!names.has(automatic.exportName)) errors.push(`Component ${entry.name} automatic structure references unknown export: ${automatic.exportName}.`) }
    hasEvidence(errors, component.rendering.defaultHost.evidenceRefs, family.evidence, `Rendering default host ${entry.name}`)
    hasEvidence(errors, component.rendering.portals.evidenceRefs, family.evidence, `Rendering portals ${entry.name}`)
    for (const slot of component.slots) { hasEvidence(errors, slot.evidenceRefs, family.evidence, `Slot ${entry.name}.${slot.propName}`); if (slot.childCardinality.max < slot.childCardinality.min) errors.push(`Slot ${entry.name}.${slot.propName} has max ${slot.childCardinality.max} below min ${slot.childCardinality.min}.`) }
    for (const fact of component.accessibility) hasEvidence(errors, fact.evidenceRefs, family.evidence, `Accessibility ${entry.name}.${fact.feature}`)
  }
  for (const unresolved of family.unresolved) hasEvidence(errors, unresolved.evidenceRefs, family.evidence, `Unresolved fact ${unresolved.topic}`)
  if (authority.sourceIdentity && family.source.canonicalPath !== authority.sourceIdentity.canonicalPath) errors.push("Family source canonicalPath does not match approved source identity.")
  if (authority.sourceIdentity && family.source.canonicalBlobSha !== authority.sourceIdentity.canonicalBlobSha) errors.push("Family source canonicalBlobSha does not match approved source identity.")
  return errors
}

export function assertComponentFamilyInvariants(family: ComponentFamilyContract, authority: ComponentInvariantAuthority): void { const errors = validateComponentFamilyInvariants(family, authority); if (errors.length) throw new Error(errors.join("\n")) }
export function validateInheritedInterfaceInvariants(contract: InheritedInterfaceContract): string[] { const errors: string[] = []; const names = new Set<string>(); for (const prop of contract.props) { if (names.has(prop.name)) errors.push(`Duplicate inherited prop: ${prop.name}.`); names.add(prop.name); hasEvidence(errors, prop.evidenceRefs, contract.evidence, `Inherited prop ${prop.name}`) } return errors }
export function assertInheritedInterfaceInvariants(contract: InheritedInterfaceContract): void { const errors = validateInheritedInterfaceInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
export function validateComponentContractSetInvariants(contract: ComponentContractSet): string[] { return contract.familyCount < contract.familyFiles.length ? ["Contract set familyFiles exceeds familyCount."] : [] }
export function assertComponentContractSetInvariants(contract: ComponentContractSet): void { const errors = validateComponentContractSetInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
