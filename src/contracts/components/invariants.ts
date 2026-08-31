import type { ComponentContractSet, ComponentDefinition, ComponentFamilyContract, ComponentInvariantAuthority, InheritedInterfaceContract } from "./types"

function hasEvidence(errors: string[], refs: string[], evidence: Record<string, unknown>, label: string) {
  if (refs.length === 0) errors.push(`${label} is missing evidence references.`)
  for (const ref of refs) if (!(ref in evidence)) errors.push(`${label} references missing evidence: ${ref}.`)
}

function validateRenderingTree(errors: string[], family: ComponentFamilyContract, componentName: string, rendering: ComponentDefinition["rendering"], authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Set<string>, localProps: ComponentDefinition["localProps"]) {
  const ids = new Set<string>()
  for (const node of rendering.nodes) {
    if (ids.has(node.id)) errors.push(`Component ${componentName} has duplicate render-node ID: ${node.id}.`)
    ids.add(node.id)
    hasEvidence(errors, node.evidenceRefs, family.evidence, `Render node ${componentName}.${node.id}`)
    for (const attr of node.dataAttributes) hasEvidence(errors, attr.evidenceRefs, family.evidence, `Render attribute ${componentName}.${node.id}.${attr.name}`)
    if (node.host.kind === "component-export" && !exportEntries.has(node.host.exportName)) errors.push(`Component ${componentName} render host references unknown export: ${node.host.exportName}.`)
    if (node.host.kind === "component-export" && exportEntries.has(node.host.exportName) && (exportEntries.get(node.host.exportName)!.kind !== "component" || !exportEntries.get(node.host.exportName)!.authorableJsx)) errors.push(`Component ${componentName} render host references non-JSX-authorable export: ${node.host.exportName}.`)
    if (node.host.kind === "inherited-interface" && !authority.interfaceIds.has(node.host.interfaceId)) errors.push(`Component ${componentName} render host references unknown interface: ${node.host.interfaceId}.`)
  }
  const root = rendering.nodes.find((node) => node.id === rendering.rootNodeId)
  const target = rendering.nodes.find((node) => node.id === rendering.publicPropsTargetNodeId)
  if (!root) errors.push(`Component ${componentName} rendering root node is missing: ${rendering.rootNodeId}.`)
  if (!target) errors.push(`Component ${componentName} rendering public-props target node is missing: ${rendering.publicPropsTargetNodeId}.`)
  if (target && !target.receivesPublicProps) errors.push(`Component ${componentName} rendering public-props target must receive public props.`)
  const receiving = rendering.nodes.filter((node) => node.receivesPublicProps)
  if (receiving.length !== 1) errors.push(`Component ${componentName} rendering must have exactly one public-props target.`)
  if (receiving.length === 1 && receiving[0].id !== rendering.publicPropsTargetNodeId) errors.push(`Component ${componentName} has a public-props node other than its target.`)
  const edges = new Map(rendering.nodes.map((node) => [node.id, node.children]))
  for (const node of rendering.nodes) for (const child of node.children) {
    hasEvidence(errors, child.evidenceRefs, family.evidence, `Render child ${componentName}.${node.id}->${child.nodeId}`)
    if (!ids.has(child.nodeId)) errors.push(`Component ${componentName} render node ${node.id} references unknown child: ${child.nodeId}.`)
    if (child.when) {
      if (!props.has(child.when.propName)) errors.push(`Component ${componentName} render child condition references unknown prop: ${child.when.propName}.`)
      const localProp = localProps.find((prop) => prop.name === child.when!.propName)
      if (localProp?.type.kind === "boolean" && typeof child.when.equals !== "boolean") errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has boolean prop ${child.when.propName} but equals is not boolean.`)
      if (localProp?.type.kind === "enum" && (typeof child.when.equals !== "string" || !localProp.type.values.includes(child.when.equals))) errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has enum prop ${child.when.propName} without value: ${String(child.when.equals)}.`)
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (id: string) => { if (visiting.has(id)) { errors.push(`Component ${componentName} rendering contains a cycle at node: ${id}.`); return }; if (visited.has(id)) return; visiting.add(id); for (const child of edges.get(id) ?? []) visit(child.nodeId); visiting.delete(id); visited.add(id) }
  if (root) visit(root.id)
  if (visited.size !== rendering.nodes.length) errors.push(`Component ${componentName} rendering contains disconnected nodes.`)
  const portalNodeIds = new Set<string>()
  for (const boundary of rendering.portalBoundaries) {
    if (portalNodeIds.has(boundary.nodeId)) errors.push(`Component ${componentName} has duplicate portal boundary for render node: ${boundary.nodeId}.`)
    portalNodeIds.add(boundary.nodeId)
    hasEvidence(errors, boundary.evidenceRefs, family.evidence, `Portal boundary ${componentName}.${boundary.nodeId}`)
    if (!ids.has(boundary.nodeId)) errors.push(`Component ${componentName} portal boundary references unknown render node: ${boundary.nodeId}.`)
    else if (!visited.has(boundary.nodeId)) errors.push(`Component ${componentName} portal boundary references unreachable render node: ${boundary.nodeId}.`)
  }
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
    const defaultNames = new Set<string>()
    for (const inheritedDefault of component.inheritedPropDefaults) {
      if (defaultNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} has duplicate inherited prop default: ${inheritedDefault.propName}.`)
      defaultNames.add(inheritedDefault.propName)
      hasEvidence(errors, inheritedDefault.evidenceRefs, family.evidence, `Inherited prop default ${entry.name}.${inheritedDefault.propName}`)
      if (!inheritedNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} inherited prop default references unknown inherited prop: ${inheritedDefault.propName}.`)
      if (localNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} inherited prop default collides with local prop: ${inheritedDefault.propName}.`)
    }
    const props = new Set([...localNames, ...inheritedNames])
    for (const state of component.stateChannels) { hasEvidence(errors, state.evidenceRefs, family.evidence, `State channel ${entry.name}.${state.name}`); if (!props.has(state.propName)) errors.push(`Component ${entry.name} state channel ${state.name} references unknown prop: ${state.propName}.`) }
    for (const event of component.events) { hasEvidence(errors, event.evidenceRefs, family.evidence, `Event ${entry.name}.${event.propName}`); if (!props.has(event.propName)) errors.push(`Component ${entry.name} event references unknown prop: ${event.propName}.`) }
    for (const token of component.tokenDependencies) { hasEvidence(errors, token.evidenceRefs, family.evidence, `Token dependency ${entry.name}.${token.tokenId}`); if (!authority.tokenIds.has(token.tokenId)) errors.push(`Component ${entry.name} references unknown token: ${token.tokenId}.`); if (token.viaDerivedRule && !authority.derivedTokenRuleIds.has(token.viaDerivedRule.id)) errors.push(`Component ${entry.name} references unknown derived token rule: ${token.viaDerivedRule.id}.`) }
    for (const conditional of component.conditionalApi) hasEvidence(errors, conditional.evidenceRefs, family.evidence, `Conditional API ${entry.name}.${conditional.propName}`)
    validateRenderingTree(errors, family, entry.name, component.rendering, authority, new Map(family.exports.map(({ name, kind, authorableJsx }) => [name, { kind, authorableJsx }])), props, component.localProps)
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
