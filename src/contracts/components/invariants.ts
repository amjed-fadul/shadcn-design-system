import { isRenderingTree } from "./types"
import type { ComponentContractSet, ComponentDefinition, ComponentFamilyContract, ComponentInvariantAuthority, ConditionalApiCondition, ContextFact, EffectiveComponentApiShape, EffectivePublicProp, EventContract, InheritedInterfaceContract, RenderAttributeValue, RenderCondition, RenderingTree, RenderFlowGuard, RenderFlowGuardSource, StructuredPropType, TokenConditionAtom } from "./types"

type PublicPropFact = { name: string; availability: "available" | "unavailable"; required?: boolean; type?: StructuredPropType }

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function tokenConditionSubject({ equals: _equals, ...identity }: TokenConditionAtom): string {
  return stableSerialize(identity)
}

function validateTokenConditionAtomPath(errors: string[], componentName: string, tokenId: string, atom: TokenConditionAtom): void {
  if (!("subject" in atom)) return
  const path = atom.path as Array<{ kind?: unknown; name?: unknown }> | undefined
  if (!Array.isArray(path) || path.length === 0) {
    errors.push(`Component ${componentName} token ${tokenId} condition has an empty relation path.`)
    return
  }
  const names: number[] = []
  for (const [index, segment] of path.entries()) {
    if (typeof segment !== "object" || segment === null || !["self", "has", "in", "group", "peer"].includes(String(segment.kind))) {
      errors.push(`Component ${componentName} token ${tokenId} condition has an invalid relation path segment.`)
      continue
    }
    if ("name" in segment) {
      names.push(index)
      if (segment.kind !== "group" && segment.kind !== "peer") errors.push(`Component ${componentName} token ${tokenId} condition has an invalid named ${String(segment.kind)} relation path segment.`)
      if (typeof segment.name !== "string" || !/^[A-Za-z0-9_-]+$/.test(segment.name)) errors.push(`Component ${componentName} token ${tokenId} condition has an invalid relation path name: ${String(segment.name)}.`)
    }
  }
  if (path.some((segment) => segment.kind === "self") && (path.length !== 1 || path[0]?.kind !== "self")) errors.push(`Component ${componentName} token ${tokenId} condition has self in a compound relation path.`)
  if (names.length > 1) errors.push(`Component ${componentName} token ${tokenId} condition has multiple named relation path segments.`)
  const firstNameable = path.findIndex((segment) => segment.kind === "group" || segment.kind === "peer")
  if (names.length === 1 && names[0] !== firstNameable) errors.push(`Component ${componentName} token ${tokenId} condition relation path name must target its first group or peer segment.`)
}

function validateTokenCondition(errors: string[], componentName: string, tokenId: string, when: ComponentDefinition["tokenDependencies"][number]["when"]): void {
  if (!when) return
  const atoms = "all" in when ? when.all as TokenConditionAtom[] : [when as TokenConditionAtom]
  for (const atom of atoms) validateTokenConditionAtomPath(errors, componentName, tokenId, atom)
  if (!("all" in when)) return
  if (atoms.length < 2) errors.push(`Component ${componentName} token ${tokenId} conjunction must contain at least two conditions.`)
  if (atoms.some((atom, index) => atoms.findIndex((candidate) => stableSerialize(candidate) === stableSerialize(atom)) !== index)) {
    errors.push(`Component ${componentName} token ${tokenId} condition contains duplicate predicates.`)
  }
  if (atoms.some((atom, index) => atoms.slice(index + 1).some((candidate) => tokenConditionSubject(candidate) === tokenConditionSubject(atom) && candidate.equals !== atom.equals))) {
    errors.push(`Component ${componentName} token ${tokenId} condition contains contradictory predicates.`)
  }
}

export function isStructuredPropTypeAssignable(source: StructuredPropType, target: StructuredPropType): boolean {
  if (source.kind === "union") return source.members.every((member) => isStructuredPropTypeAssignable(member, target))
  if (target.kind === "union") {
    if (target.members.some((member) => isStructuredPropTypeAssignable(source, member))) return true
    return source.kind === "boolean" && target.members.some((member) => member.kind === "literal" && member.value === true) && target.members.some((member) => member.kind === "literal" && member.value === false)
  }
  if (target.kind === "typescript") return source.kind === "typescript" && source.typeText === target.typeText
  if (source.kind === "typescript") return false
  if (target.kind === "array") return source.kind === "array" && isStructuredPropTypeAssignable(source.item, target.item)
  if (source.kind === "array") return false
  if (target.kind === "literal") return source.kind === "literal" && source.value === target.value
  if (source.kind === "literal") {
    if (target.kind === "enum") return typeof source.value === "string" && target.values.includes(source.value)
    return target.kind === typeof source.value
  }
  if (target.kind === "enum") return source.kind === "enum" && source.values.every((value) => target.values.includes(value))
  if (source.kind === "enum") return target.kind === "string"
  return source.kind === target.kind
}

function areStructuredPropTypesCompatible(left: StructuredPropType, right: StructuredPropType): boolean {
  return isStructuredPropTypeAssignable(left, right) || isStructuredPropTypeAssignable(right, left)
}

function strictlyNarrowsStructuredPropType(source: StructuredPropType, target: StructuredPropType): boolean {
  return isStructuredPropTypeAssignable(source, target) && !isStructuredPropTypeAssignable(target, source)
}

function hasEvidence(errors: string[], refs: string[], evidence: Record<string, unknown>, label: string) {
  if (refs.length === 0) errors.push(`${label} is missing evidence references.`)
  for (const ref of refs) if (!(ref in evidence)) errors.push(`${label} references missing evidence: ${ref}.`)
}

function inheritedContracts(component: ComponentDefinition, authority: ComponentInvariantAuthority): InheritedInterfaceContract[] {
  return component.inherits.map((interfaceId) => {
    const contract = authority.interfaceContracts.get(interfaceId)
    if (!contract) throw new Error(`Inherited interface is missing a resolved authoritative contract: ${interfaceId}.`)
    return contract
  })
}

function basePublicProps(component: ComponentDefinition, authority: ComponentInvariantAuthority): Map<string, PublicPropFact> {
  const props = new Map<string, PublicPropFact>()
  for (const prop of component.localProps) props.set(prop.name, { name: prop.name, availability: "available", required: prop.required, type: prop.type })
  for (const contract of inheritedContracts(component, authority)) for (const prop of contract.props) if (!props.has(prop.name)) props.set(prop.name, { name: prop.name, availability: "available", required: prop.required, type: prop.type })
  return props
}

function sameConditionalApiCondition(left: ConditionalApiCondition, right: ConditionalApiCondition): boolean {
  return left.propName === right.propName && ("equals" in left && "equals" in right ? left.equals === right.equals : "presence" in left && "presence" in right && left.presence === right.presence)
}

function conditionalApiConditionKey(condition: ConditionalApiCondition): string {
  return `${condition.propName}:${"equals" in condition ? `equals=${JSON.stringify(condition.equals)}` : `presence=${condition.presence}`}`
}

function conditionalApiConditionLabel(condition: ConditionalApiCondition): string {
  return "equals" in condition ? `${condition.propName}=${String(condition.equals)}` : `${condition.propName} ${condition.presence}`
}

function resolveConditionalApiShapeAtStage(component: ComponentDefinition, selection: ConditionalApiCondition, authority: ComponentInvariantAuthority, includeWrapperRefinements: boolean): EffectiveComponentApiShape {
  const interfaceCases = inheritedContracts(component, authority).flatMap((contract) => {
    const cases = (contract.conditionalApi ?? []).filter((candidate) => sameConditionalApiCondition(candidate.when, selection))
    if (cases.length > 1) throw new Error(`Expected at most one inherited conditional API case for ${conditionalApiConditionLabel(selection)}.`)
    return cases
  })
  const componentCases = component.conditionalApi.filter((candidate) => sameConditionalApiCondition(candidate.when, selection))
  if (componentCases.length > 1) throw new Error(`Expected at most one component conditional API case for ${conditionalApiConditionLabel(selection)}.`)
  if (interfaceCases.length + componentCases.length === 0) throw new Error(`Expected a conditional API case for ${conditionalApiConditionLabel(selection)}.`)
  const baseCases = interfaceCases.length > 0 ? interfaceCases : componentCases
  const wrapperCases = includeWrapperRefinements && interfaceCases.length > 0 ? componentCases : []
  const props = new Map<string, EffectivePublicProp>()
  for (const prop of basePublicProps(component, authority).values()) {
    if (prop.availability === "available" && prop.required !== undefined && prop.type) props.set(prop.name, { name: prop.name, availability: "available", required: prop.required, type: prop.type })
    else props.set(prop.name, { name: prop.name, availability: "unavailable" })
  }
  for (const refinement of [...baseCases, ...wrapperCases].flatMap((candidate) => candidate.propRefinements)) {
    if (refinement.availability === "unavailable") props.set(refinement.propName, { name: refinement.propName, availability: "unavailable" })
    else props.set(refinement.propName, { name: refinement.propName, availability: "available", required: refinement.required, type: refinement.type })
  }
  const events = new Map<string, EventContract>([...component.events, ...inheritedContracts(component, authority).flatMap((contract) => contract.events ?? []).map((event) => ({ propName: event.propName, payload: event.payload, evidenceRefs: event.evidenceRefs }))].map((event) => [event.propName, event]))
  for (const refinement of [...baseCases, ...wrapperCases].flatMap((candidate) => candidate.eventRefinements)) {
    const event = events.get(refinement.eventPropName)
    if (event) events.set(refinement.eventPropName, { ...event, payload: refinement.payload })
  }
  return { props: [...props.values()], events: [...events.values()] }
}

/** Resolves only factual branch shape; it does not validate authored runtime props. */
export function resolveConditionalApiShape(component: ComponentDefinition, selection: ConditionalApiCondition, authority: ComponentInvariantAuthority): EffectiveComponentApiShape {
  return resolveConditionalApiShapeAtStage(component, selection, authority, true)
}

function isPublicRenderCondition(condition: RenderCondition): condition is Extract<RenderCondition, { propName: string }> { return "propName" in condition }

function atomicRenderConditions(condition: RenderCondition): Array<Exclude<RenderCondition, { all: RenderCondition[] }>> {
  return "all" in condition ? condition.all.flatMap(atomicRenderConditions) : [condition]
}

type AtomicRenderCondition = ReturnType<typeof atomicRenderConditions>[number]

function renderConditionSubject(condition: AtomicRenderCondition): string {
  return "propName" in condition ? `prop:${condition.propName}` : `state:${condition.name}`
}

function renderConditionAtomsContradict(left: AtomicRenderCondition, right: AtomicRenderCondition): boolean {
  if (renderConditionSubject(left) !== renderConditionSubject(right)) return false
  if ("equals" in left && "equals" in right) return left.equals !== right.equals
  if ("truthiness" in left && "truthiness" in right) return left.truthiness !== right.truthiness
  if ("nullishness" in left && "nullishness" in right) return left.nullishness !== right.nullishness
  if ("nullishness" in left || "nullishness" in right) {
    const nullish = "nullishness" in left ? left : right as Extract<AtomicRenderCondition, { nullishness: string }>
    const other = nullish === left ? right : left
    if (nullish.nullishness === "non-nullish") return false
    return "equals" in other || "truthiness" in other && other.truthiness === "truthy"
  }
  const truthiness = "truthiness" in left ? left : right as Extract<AtomicRenderCondition, { truthiness: string }>
  const equals = truthiness === left ? right : left
  return "equals" in equals && Boolean(equals.equals) !== (truthiness.truthiness === "truthy")
}

function validateRenderCondition(errors: string[], componentName: string, scope: string, condition: RenderCondition, props: Map<string, PublicPropFact>) {
  const atoms = atomicRenderConditions(condition)
  if (atoms.some((atom, index) => atoms.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(atom)) !== index)) {
    errors.push(`Component ${componentName} ${scope} condition contains duplicate predicates.`)
  }
  if (atoms.some((atom, index) => atoms.slice(index + 1).some((candidate) => renderConditionAtomsContradict(atom, candidate)))) {
    errors.push(`Component ${componentName} ${scope} condition contains contradictory predicates.`)
  }
  for (const atom of atoms) {
    if (!isPublicRenderCondition(atom)) continue
    const prop = props.get(atom.propName)
    if (!prop || prop.availability !== "available") {
      errors.push(`Component ${componentName} ${scope} condition references unknown prop: ${atom.propName}.`)
      continue
    }
    if ("truthiness" in atom || "nullishness" in atom) continue
    if (!prop.type || !isStructuredPropTypeAssignable({ kind: "literal", value: atom.equals }, prop.type)) {
      errors.push(`Component ${componentName} ${scope} condition has incompatible literal for prop ${atom.propName}: ${String(atom.equals)}.`)
    }
  }
}

function validateAttributeValue(errors: string[], componentName: string, scope: string, value: RenderAttributeValue, props: Map<string, PublicPropFact>, contexts: Map<string, ContextFact>, depth = 0): void {
  if (depth > 16) { errors.push(`Component ${componentName} ${scope} has an excessively nested value.`); return }
  if (value.source === "literal") return
  if (value.source === "prop") {
    if (props.get(value.name)?.availability !== "available") errors.push(`Component ${componentName} ${scope} references unknown prop: ${value.name}.`)
    return
  }
  if (value.source === "context-field") {
    const context = contexts.get(value.contextId)
    if (!context) errors.push(`Component ${componentName} ${scope} references unknown context: ${value.contextId}.`)
    else if (!context.defaultFields.some((field) => field.name === value.field)) errors.push(`Component ${componentName} ${scope} references unknown context field: ${value.contextId}.${value.field}.`)
    return
  }
  if (value.source === "nullish-coalesce") {
    validateAttributeValue(errors, componentName, scope, value.first, props, contexts, depth + 1)
    validateAttributeValue(errors, componentName, scope, value.fallback, props, contexts, depth + 1)
    return
  }
  errors.push(`Component ${componentName} ${scope} has an unsupported value source.`)
}

function readsContext(value: RenderAttributeValue, contextId: string): boolean {
  if (value.source === "context-field") return value.contextId === contextId
  return value.source === "nullish-coalesce" && (readsContext(value.first, contextId) || readsContext(value.fallback, contextId))
}

function referencedContexts(value: RenderAttributeValue): string[] {
  if (value.source === "context-field") return [value.contextId]
  return value.source === "nullish-coalesce" ? [...referencedContexts(value.first), ...referencedContexts(value.fallback)] : []
}

function validateContextFacts(errors: string[], family: ComponentFamilyContract, componentName: string, component: ComponentDefinition, props: Map<string, PublicPropFact>): Map<string, ContextFact> {
  const contexts = new Map<string, ContextFact>()
  const seen = new Set<string>()
  for (const context of component.context ?? []) if (!contexts.has(context.id)) contexts.set(context.id, context)
  for (const context of component.context ?? []) {
    hasEvidence(errors, context.evidenceRefs, family.evidence, `Context ${componentName}.${context.id}`)
    if (!context.id || seen.has(context.id)) errors.push(`Component ${componentName} has duplicate or empty context ID: ${context.id}.`)
    seen.add(context.id)
    if (Boolean(context.provider) === Boolean(context.providerExportName)) errors.push(`Component ${componentName} context ${context.id} needs exactly one provider or provider export reference.`)
    const names = new Set<string>()
    if (!context.defaultFields.length) errors.push(`Component ${componentName} context ${context.id} has no default fields.`)
    for (const field of context.defaultFields) {
      if (!field.name || names.has(field.name)) errors.push(`Component ${componentName} context ${context.id} has duplicate or empty default field: ${field.name}.`)
      names.add(field.name)
    }
    if (context.provider) {
      const providerNames = new Set<string>()
      if (!context.provider.fields.length) errors.push(`Component ${componentName} context ${context.id} has no provider fields.`)
      for (const field of context.provider.fields) {
        if (providerNames.has(field.name)) errors.push(`Component ${componentName} context ${context.id} has duplicate provider field: ${field.name}.`)
        providerNames.add(field.name)
        if (!names.has(field.name)) errors.push(`Component ${componentName} context ${context.id} provides unknown field: ${field.name}.`)
        if (readsContext(field.value, context.id)) errors.push(`Component ${componentName} context ${context.id}.${field.name} reads its own provider value.`)
        validateAttributeValue(errors, componentName, `context ${context.id}.${field.name}`, field.value, props, contexts)
      }
      for (const name of names) if (!providerNames.has(name)) errors.push(`Component ${componentName} context ${context.id} omits provider field: ${name}.`)
      const trees = isRenderingTree(component.rendering) ? [component.rendering] : component.rendering.alternatives.map((branch) => branch.rendering)
      if (!trees.every((tree) => tree.nodes.some((node) => node.id === context.provider!.nodeId))) errors.push(`Component ${componentName} context ${context.id} references unknown provider node: ${context.provider.nodeId}.`)
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) { errors.push(`Component ${componentName} context values contain a cycle at ${id}.`); return }
    if (visited.has(id)) return
    visiting.add(id)
    for (const field of contexts.get(id)?.provider?.fields ?? []) for (const dependency of referencedContexts(field.value)) if (contexts.has(dependency)) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of contexts.keys()) visit(id)
  return contexts
}

function validateRenderingTree(errors: string[], family: ComponentFamilyContract, componentName: string, rendering: RenderingTree, authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Map<string, PublicPropFact>, localProps: ComponentDefinition["localProps"], flowCollectionIds: Set<string> = new Set(), contexts: Map<string, ContextFact> = new Map()) {
  const ids = new Set<string>()
  for (const node of rendering.nodes) {
    if (ids.has(node.id)) errors.push(`Component ${componentName} has duplicate render-node ID: ${node.id}.`)
    ids.add(node.id)
    hasEvidence(errors, node.evidenceRefs, family.evidence, `Render node ${componentName}.${node.id}`)
    const attributeNames = new Set<string>()
    for (const attr of node.dataAttributes) {
      hasEvidence(errors, attr.evidenceRefs, family.evidence, `Render attribute ${componentName}.${node.id}.${attr.name}`)
      if (!attr.name.startsWith("data-") || attributeNames.has(attr.name)) errors.push(`Component ${componentName} render node ${node.id} has unknown or duplicate data attribute: ${attr.name}.`)
      attributeNames.add(attr.name)
      if (attr.source === "derived-condition") validateRenderCondition(errors, componentName, `render attribute ${node.id}.${attr.name}`, attr.condition, props)
      if (attr.source === "prop" && !props.has(attr.prop)) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} references unknown prop: ${attr.prop}.`)
      if (attr.source === "conditional-value") {
        validateRenderCondition(errors, componentName, `render attribute ${node.id}.${attr.name}`, attr.condition, props)
        for (const value of [attr.whenTrue, attr.whenFalse]) if (value.source === "prop" && !props.has(value.name)) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} references unknown prop value: ${value.name}.`)
      }
      if (attr.source === "ordered-writes") {
        if (!attr.writes.length || !attr.writes.some((write) => write.kind === "value")) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} needs a value write.`)
        for (const [index, write] of attr.writes.entries()) {
          if (write.kind === "value") validateAttributeValue(errors, componentName, `render attribute ${node.id}.${attr.name} write ${index}`, write.value, props, contexts)
          else if (write.kind === "public-props-spread") {
            if (!node.receivesPublicProps || rendering.publicPropsTargetNodeId !== node.id) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} has a public-props write on a non-target node.`)
          } else errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} has an unsupported write.`)
        }
      }
    }
    for (const spread of node.derivedSpreads ?? []) {
      hasEvidence(errors, spread.evidenceRefs, family.evidence, `Derived render spread ${componentName}.${node.id}.${spread.name}`)
      if (spread.source === "prop" && !props.has(spread.name)) errors.push(`Component ${componentName} derived render spread ${node.id} references unknown prop: ${spread.name}.`)
    }
    if (node.host.kind === "component-export" && !exportEntries.has(node.host.exportName)) errors.push(`Component ${componentName} render host references unknown export: ${node.host.exportName}.`)
    if (node.host.kind === "component-export" && exportEntries.has(node.host.exportName) && (exportEntries.get(node.host.exportName)!.kind !== "component" || !exportEntries.get(node.host.exportName)!.authorableJsx)) errors.push(`Component ${componentName} render host references non-JSX-authorable export: ${node.host.exportName}.`)
    if (node.host.kind === "cross-family-export") {
      const qualifiedExport = `${node.host.familyId}.${node.host.exportName}`
      if (!authority.componentExportIds?.has(qualifiedExport)) errors.push(`Component ${componentName} render host references unknown cross-family component export: ${qualifiedExport}.`)
      if (node.host.familyId === family.id) errors.push(`Component ${componentName} cross-family render host must reference a different family: ${qualifiedExport}.`)
    }
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
    if (child.repeat) {
      hasEvidence(errors, child.repeat.evidenceRefs, family.evidence, `Render repetition ${componentName}.${node.id}->${child.nodeId}`)
      if (!flowCollectionIds.has(child.repeat.collectionId)) errors.push(`Component ${componentName} render repetition references unknown collection: ${child.repeat.collectionId}.`)
      if (child.repeat.count === "matching-items" && !child.repeat.itemWhen) errors.push(`Component ${componentName} render repetition ${node.id}->${child.nodeId} requires an item filter for matching-items.`)
      if (child.repeat.count === "collection-length" && child.repeat.itemWhen) errors.push(`Component ${componentName} render repetition ${node.id}->${child.nodeId} cannot filter collection-length.`)
      if (child.repeat.itemWhen && (child.repeat.itemWhen.op !== "truthy" || !child.repeat.itemWhen.itemProperty || typeof child.repeat.itemWhen.optionalItem !== "boolean")) errors.push(`Component ${componentName} render repetition ${node.id}->${child.nodeId} has an unsupported item filter.`)
    }
    if (child.when) {
      validateRenderCondition(errors, componentName, `render child ${node.id}->${child.nodeId}`, child.when, props)
      for (const condition of atomicRenderConditions(child.when)) {
        if (isPublicRenderCondition(condition)) {
          if (!props.has(condition.propName)) errors.push(`Component ${componentName} render child condition references unknown prop: ${condition.propName}.`)
          const localProp = localProps.find((prop) => prop.name === condition.propName)
          if ("equals" in condition && localProp?.type.kind === "boolean" && typeof condition.equals !== "boolean") errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has boolean prop ${condition.propName} but equals is not boolean.`)
          if ("equals" in condition && localProp?.type.kind === "enum" && (typeof condition.equals !== "string" || !localProp.type.values.includes(condition.equals))) errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has enum prop ${condition.propName} without value: ${String(condition.equals)}.`)
        }
      }
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

function validateRenderFlowGuardSource(errors: string[], componentName: string, scope: string, source: RenderFlowGuardSource, props: Map<string, PublicPropFact>, collectionIds: Set<string>): void {
  if (source.kind === "prop") {
    if (!props.has(source.propName) || props.get(source.propName)?.availability !== "available") errors.push(`Component ${componentName} ${scope} references unknown prop: ${source.propName}.`)
    return
  }
  if (!collectionIds.has(source.collectionId)) errors.push(`Component ${componentName} ${scope} references unknown collection: ${source.collectionId}.`)
  if (source.kind === "collection-item-property" && (!source.itemProperty || source.index !== 0 || typeof source.optionalItem !== "boolean")) errors.push(`Component ${componentName} ${scope} has an unsupported collection item-property reference.`)
}

type RenderFlowGuardAtom = Exclude<RenderFlowGuard, { all: unknown }>

function renderFlowGuardAtoms(guard: RenderFlowGuard): RenderFlowGuardAtom[] {
  return "all" in guard ? guard.all.flatMap(renderFlowGuardAtoms) : [guard]
}

function renderFlowGuardAtomKey(atom: RenderFlowGuardAtom): string {
  return stableSerialize(atom)
}

function renderFlowGuardSubject(atom: RenderFlowGuardAtom): string {
  return stableSerialize(atom.source)
}

function validateRenderFlowGuardLogic(errors: string[], componentName: string, scope: string, guard: RenderFlowGuard): boolean {
  const atoms = renderFlowGuardAtoms(guard)
  const seen = new Set<string>()
  let contradictory = false
  for (const atom of atoms) {
    const key = renderFlowGuardAtomKey(atom)
    if (seen.has(key)) errors.push(`Component ${componentName} ${scope} contains a duplicate predicate.`)
    seen.add(key)
  }
  for (let leftIndex = 0; leftIndex < atoms.length; leftIndex += 1) {
    const left = atoms[leftIndex]
    for (const right of atoms.slice(leftIndex + 1)) {
      if (renderFlowGuardSubject(left) !== renderFlowGuardSubject(right)) continue
      const oppositeTruthiness = (left.op === "truthy" && right.op === "falsy") || (left.op === "falsy" && right.op === "truthy")
      const arrayCannotBeFalsy = left.op === "array" && right.op === "falsy" || right.op === "array" && left.op === "falsy"
      const incompatibleLengths = left.op === "length-eq" && right.op === "length-eq" && left.value !== right.value
      const equalityExcludesGreater = left.op === "length-eq" && right.op === "length-gt" && left.value <= right.value || right.op === "length-eq" && left.op === "length-gt" && right.value <= left.value
      const positiveLengthAndEmpty = left.op === "empty" && (right.op === "length-gt" || right.op === "length-eq" && right.value > 0) || right.op === "empty" && (left.op === "length-gt" || left.op === "length-eq" && left.value > 0)
      if (oppositeTruthiness || arrayCannotBeFalsy || incompatibleLengths || equalityExcludesGreater || positiveLengthAndEmpty) {
        errors.push(`Component ${componentName} ${scope} contains contradictory predicates.`)
        contradictory = true
        break
      }
    }
  }
  return contradictory
}

function renderFlowAtomImplies(previous: RenderFlowGuardAtom, current: RenderFlowGuardAtom): boolean {
  if (renderFlowGuardAtomKey(previous) === renderFlowGuardAtomKey(current)) return true
  if (renderFlowGuardSubject(previous) !== renderFlowGuardSubject(current)) return false
  if (previous.op === "array" && current.op === "truthy") return true
  if (previous.op === "length-gt" && current.op === "length-gt") return previous.value >= current.value
  if (previous.op === "length-eq" && current.op === "length-gt") return previous.value > current.value
  if (previous.op === "length-eq" && current.op === "empty" && previous.value === 0 && previous.source.kind === "collection") return true
  return false
}

function renderFlowGuardImplies(previous: RenderFlowGuard, current: RenderFlowGuard): boolean {
  const previousAtoms = renderFlowGuardAtoms(previous)
  const currentAtoms = renderFlowGuardAtoms(current)
  return previousAtoms.every((previousAtom) => currentAtoms.some((currentAtom) => renderFlowAtomImplies(currentAtom, previousAtom)))
}

function validateRenderFlowGuard(errors: string[], componentName: string, scope: string, guard: RenderFlowGuard, props: Map<string, PublicPropFact>, collectionIds: Set<string>): void {
  if ("all" in guard) {
    if (guard.all.length < 2) errors.push(`Component ${componentName} ${scope} conjunction must contain at least two conditions.`)
    for (const member of guard.all) validateRenderFlowGuard(errors, componentName, scope, member, props, collectionIds)
    return
  }
  if (!("source" in guard) || !["truthy", "falsy", "array", "empty", "length-eq", "length-gt"].includes(guard.op)) {
    errors.push(`Component ${componentName} ${scope} uses an unsupported rendering-flow operator.`)
    return
  }
  const sourceKind = guard.source.kind
  const sourceCompatible = guard.op === "truthy" || guard.op === "falsy" || guard.op === "array" && sourceKind === "prop" || guard.op === "empty" && (sourceKind === "prop" || sourceKind === "collection") || (guard.op === "length-eq" || guard.op === "length-gt") && (sourceKind === "prop" || sourceKind === "collection")
  if (!sourceCompatible) errors.push(`Component ${componentName} ${scope} uses an unsupported source for rendering-flow operator ${guard.op}.`)
  if (guard.op === "empty" && (typeof guard.optionalSource !== "boolean" || (sourceKind !== "prop" && guard.optionalSource))) errors.push(`Component ${componentName} ${scope} has invalid empty-source optionality.`)
  if ((guard.op === "length-eq" || guard.op === "length-gt") && (!Number.isInteger(guard.value) || guard.value < 0)) errors.push(`Component ${componentName} ${scope} has an invalid rendering-flow length value.`)
  validateRenderFlowGuardSource(errors, componentName, scope, guard.source, props, collectionIds)
}

function validateRenderingFlow(errors: string[], family: ComponentFamilyContract, componentName: string, flow: NonNullable<ComponentDefinition["renderingFlow"]>, authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Map<string, PublicPropFact>, localProps: ComponentDefinition["localProps"], contexts: Map<string, ContextFact>): void {
  const collectionIds = new Set<string>()
  for (const collection of flow.collections) {
    if (collectionIds.has(collection.id)) errors.push(`Component ${componentName} has duplicate rendering-flow collection ID: ${collection.id}.`)
    if (!collection.id) errors.push(`Component ${componentName} rendering-flow collection has an empty ID.`)
    hasEvidence(errors, collection.evidenceRefs, family.evidence, `Rendering-flow collection ${componentName}.${collection.id}`)
    if (collection.choices.length === 0) errors.push(`Component ${componentName} rendering-flow collection ${collection.id} has no choices.`)
    let fallbackCount = 0
    const priorChoiceGuards: RenderFlowGuard[] = []
    for (const [index, choice] of collection.choices.entries()) {
      hasEvidence(errors, choice.evidenceRefs, family.evidence, `Rendering-flow collection choice ${componentName}.${collection.id}.${index}`)
      if (!choice.when) {
        fallbackCount += 1
        if (index !== collection.choices.length - 1) errors.push(`Component ${componentName} rendering-flow collection ${collection.id} has an unguarded choice before the final choice.`)
      }
      if (choice.when) {
        validateRenderFlowGuard(errors, componentName, `collection ${collection.id} choice ${index} guard`, choice.when, props, collectionIds)
        const contradictory = validateRenderFlowGuardLogic(errors, componentName, `collection ${collection.id} choice ${index} guard`, choice.when)
        if (priorChoiceGuards.some((previous) => renderFlowGuardImplies(previous, choice.when))) errors.push(`Component ${componentName} rendering-flow collection ${collection.id} choice ${index} is unreachable because an earlier guard already matches.`)
        if (!contradictory) priorChoiceGuards.push(choice.when)
      }
      if (!props.has(choice.source.propName) || props.get(choice.source.propName)?.availability !== "available") errors.push(`Component ${componentName} rendering-flow collection ${collection.id} references unknown prop: ${choice.source.propName}.`)
    }
    if (fallbackCount !== 1) errors.push(`Component ${componentName} rendering-flow collection ${collection.id} must have exactly one unguarded fallback choice.`)
    if (collection.uniqueBy) {
      hasEvidence(errors, collection.uniqueBy.evidenceRefs, family.evidence, `Rendering-flow deduplication ${componentName}.${collection.id}`)
      if (!collection.uniqueBy.itemProperty || typeof collection.uniqueBy.optionalItem !== "boolean" || collection.uniqueBy.retention !== "last-value-first-key-order") errors.push(`Component ${componentName} rendering-flow collection ${collection.id} has unsupported deduplication semantics.`)
    }
    collectionIds.add(collection.id)
  }
  if (flow.branches.length === 0) errors.push(`Component ${componentName} rendering-flow has no branches.`)
  const priorGuards: RenderFlowGuard[] = []
  let otherwiseCount = 0
  for (const [index, branch] of flow.branches.entries()) {
    hasEvidence(errors, branch.evidenceRefs, family.evidence, `Rendering-flow branch ${componentName}.${index}`)
    if ("otherwise" in branch) {
      otherwiseCount += 1
      if (index !== flow.branches.length - 1) errors.push(`Component ${componentName} rendering-flow otherwise branch must be last.`)
    } else {
      validateRenderFlowGuard(errors, componentName, `rendering-flow branch ${index} guard`, branch.when, props, collectionIds)
      const contradictory = validateRenderFlowGuardLogic(errors, componentName, `rendering-flow branch ${index} guard`, branch.when)
      if (priorGuards.some((previous) => renderFlowGuardImplies(previous, branch.when))) errors.push(`Component ${componentName} rendering-flow branch ${index} is unreachable because an earlier guard already matches.`)
      if (!contradictory) priorGuards.push(branch.when)
    }
    if (branch.outcome.kind === "rendered") {
      validateRenderingTree(errors, family, `${componentName} branch ${index}`, branch.outcome.tree, authority, exportEntries, props, localProps, collectionIds, contexts)
      const content = branch.outcome.content
      if (content?.source === "prop" && (!props.has(content.propName) || props.get(content.propName)?.availability !== "available")) errors.push(`Component ${componentName} rendering-flow branch ${index} references unknown content prop: ${content.propName}.`)
      if (content?.source === "collection-item-property" && (!collectionIds.has(content.collectionId) || !content.itemProperty || content.index !== 0 || typeof content.optionalItem !== "boolean")) errors.push(`Component ${componentName} rendering-flow branch ${index} has an invalid collection content reference.`)
    } else if (branch.outcome.kind !== "absent") errors.push(`Component ${componentName} rendering-flow branch ${index} has an unsupported outcome.`)
  }
  if (otherwiseCount > 1) errors.push(`Component ${componentName} rendering-flow has multiple otherwise branches.`)
}

function validateRendering(errors: string[], family: ComponentFamilyContract, componentName: string, rendering: ComponentDefinition["rendering"], authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Map<string, PublicPropFact>, localProps: ComponentDefinition["localProps"], flowCollectionIds: Set<string> = new Set(), contexts: Map<string, ContextFact> = new Map()) {
  if (isRenderingTree(rendering)) {
    validateRenderingTree(errors, family, componentName, rendering, authority, exportEntries, props, localProps, flowCollectionIds, contexts)
    return
  }
  let otherwiseCount = 0
  for (const [index, alternative] of rendering.alternatives.entries()) {
    hasEvidence(errors, alternative.evidenceRefs, family.evidence, `Render alternative ${componentName}.${index}`)
    if ("otherwise" in alternative) otherwiseCount += 1
    else validateRenderCondition(errors, componentName, `render alternative ${index}`, alternative.when, props)
    validateRenderingTree(errors, family, `${componentName} alternative ${index}`, alternative.rendering, authority, exportEntries, props, localProps, flowCollectionIds, contexts)
  }
  if (otherwiseCount > 1) errors.push(`Component ${componentName} has multiple otherwise render alternatives.`)
  if (rendering.alternatives.some((alternative, index) => "otherwise" in alternative && index !== rendering.alternatives!.length - 1)) errors.push(`Component ${componentName} has an otherwise render alternative before the final branch.`)
}

function validateStateChannels(errors: string[], family: ComponentFamilyContract, componentName: string, channels: ComponentDefinition["stateChannels"], props: Map<string, PublicPropFact>, events: Map<string, EventContract>) {
  const names = new Set<string>()
  for (const state of channels) {
    hasEvidence(errors, state.evidenceRefs, family.evidence, `State channel ${componentName}.${state.name}`)
    if (names.has(state.name)) errors.push(`Component ${componentName} has duplicate state channel: ${state.name}.`)
    names.add(state.name)
    const valueRole = (role: "controlled" | "default", propName: string | undefined) => {
      if (!propName) return undefined
      if (events.has(propName)) errors.push(`State channel ${componentName}.${state.name} ${role} role references an event instead of a value prop: ${propName}.`)
      else if (!props.has(propName) || props.get(propName)!.availability !== "available") errors.push(`State channel ${componentName}.${state.name} references unknown ${role} prop: ${propName}.`)
      return props.get(propName)
    }
    const controlled = valueRole("controlled", state.controlledProp)
    const defaultValue = valueRole("default", state.defaultProp)
    if (state.controlledProp && state.defaultProp && state.controlledProp === state.defaultProp) errors.push(`State channel ${componentName}.${state.name} reuses a prop for controlled and default roles: ${state.controlledProp}.`)
    if (state.changeEventProp) {
      if (!events.has(state.changeEventProp) && props.has(state.changeEventProp)) errors.push(`State channel ${componentName}.${state.name} change role references a value prop instead of an event: ${state.changeEventProp}.`)
      else if (!events.has(state.changeEventProp)) errors.push(`State channel ${componentName}.${state.name} references unknown change event: ${state.changeEventProp}.`)
      else {
        const changeEvent = events.get(state.changeEventProp)!
        const stateValueTypes = [controlled?.type, defaultValue?.type].filter((type): type is StructuredPropType => Boolean(type))
        if (stateValueTypes.length > 0 && (!changeEvent.payload || stateValueTypes.some((type) => !isStructuredPropTypeAssignable(changeEvent.payload!, type)))) {
          errors.push(`State channel ${componentName}.${state.name} has incompatible change event payload.`)
        }
      }
    }
    if (controlled?.type && defaultValue?.type && !areStructuredPropTypesCompatible(controlled.type, defaultValue.type)) errors.push(`State channel ${componentName}.${state.name} has incompatible controlled and default value types.`)
  }
}

function validateConditionalApi(errors: string[], family: ComponentFamilyContract, componentName: string, component: ComponentDefinition, baseProps: Map<string, PublicPropFact>, baseEvents: Map<string, EventContract>, authority: ComponentInvariantAuthority) {
  const cases = new Set<string>()
  for (const conditional of component.conditionalApi) {
    hasEvidence(errors, conditional.evidenceRefs, family.evidence, `Conditional API ${componentName}.${conditional.when.propName}`)
    const discriminator = baseProps.get(conditional.when.propName)
    if (!discriminator) errors.push(`Conditional API ${componentName} references unknown discriminant prop: ${conditional.when.propName}.`)
    else if ("equals" in conditional.when && (!discriminator.type || !isStructuredPropTypeAssignable({ kind: "literal", value: conditional.when.equals }, discriminator.type))) errors.push(`Conditional API ${componentName}.${conditional.when.propName} has enum prop without value: ${String(conditional.when.equals)}.`)
    else if ("presence" in conditional.when && discriminator.required) errors.push(`Conditional API ${componentName}.${conditional.when.propName} cannot use presence discrimination on a required prop.`)
    const caseKey = conditionalApiConditionKey(conditional.when)
    if (cases.has(caseKey)) errors.push(`Component ${componentName} has conflicting conditional API case for ${conditionalApiConditionLabel(conditional.when)}.`)
    cases.add(caseKey)

    const inheritedBranchExists = inheritedContracts(component, authority).some((contract) => (contract.conditionalApi ?? []).some((candidate) => sameConditionalApiCondition(candidate.when, conditional.when)))
    const inheritedBranch = inheritedBranchExists ? resolveConditionalApiShapeAtStage(component, conditional.when, authority, false) : undefined
    const effectiveBaseProps: Map<string, EffectivePublicProp> = inheritedBranch
      ? new Map(inheritedBranch.props.map((prop) => [prop.name, prop]))
      : new Map([...baseProps.values()].map((prop) => [prop.name, prop.availability === "available" && prop.required !== undefined && prop.type ? { name: prop.name, availability: "available" as const, required: prop.required, type: prop.type } : { name: prop.name, availability: "unavailable" as const }]))
    const effectiveBaseEvents = inheritedBranch ? new Map(inheritedBranch.events.map((event) => [event.propName, event])) : baseEvents

    const propNames = new Set<string>()
    for (const refinement of conditional.propRefinements) {
      if (propNames.has(refinement.propName)) errors.push(`Conditional API ${componentName}.${conditional.when.propName} has duplicate prop refinement: ${refinement.propName}.`)
      propNames.add(refinement.propName)
      hasEvidence(errors, refinement.evidenceRefs, family.evidence, `Conditional API prop refinement ${componentName}.${refinement.propName}`)
      const base = effectiveBaseProps.get(refinement.propName)
      if (!base) { errors.push(`Conditional API ${componentName}.${conditional.when.propName} refines unknown prop: ${refinement.propName}.`); continue }
      if (refinement.availability === "unavailable") {
        if (base.availability === "available" && base.required) errors.push(`Conditional API ${componentName}.${conditional.when.propName} cannot make required prop unavailable: ${refinement.propName}.`)
      } else {
        if (base.availability === "unavailable") errors.push(`Conditional API ${componentName}.${conditional.when.propName} cannot make selected-branch-unavailable prop available: ${refinement.propName}.`)
        else {
          if (!strictlyNarrowsStructuredPropType(refinement.type, base.type) && !(refinement.required && !base.required && isStructuredPropTypeAssignable(refinement.type, base.type))) errors.push(`Conditional API ${componentName}.${conditional.when.propName} refines prop ${refinement.propName} with a type that does not narrow its ${inheritedBranch ? "selected branch" : "base type"}.`)
          if (base.required && !refinement.required) errors.push(`Conditional API ${componentName}.${conditional.when.propName} makes required prop optional: ${refinement.propName}.`)
        }
      }
    }

    const eventNames = new Set<string>()
    for (const refinement of conditional.eventRefinements) {
      if (eventNames.has(refinement.eventPropName)) errors.push(`Conditional API ${componentName}.${conditional.when.propName} has duplicate event refinement: ${refinement.eventPropName}.`)
      eventNames.add(refinement.eventPropName)
      hasEvidence(errors, refinement.evidenceRefs, family.evidence, `Conditional API event refinement ${componentName}.${refinement.eventPropName}`)
      const base = effectiveBaseEvents.get(refinement.eventPropName)
      if (!base) errors.push(`Conditional API ${componentName}.${conditional.when.propName} refines unknown event: ${refinement.eventPropName}.`)
      else if (!base.payload || !strictlyNarrowsStructuredPropType(refinement.payload, base.payload)) errors.push(`Conditional API ${componentName}.${conditional.when.propName} refines event ${refinement.eventPropName} with a payload that does not narrow its ${inheritedBranch ? "selected branch" : "base payload"}.`)
    }

    if (component.conditionalApi.filter((candidate) => sameConditionalApiCondition(candidate.when, conditional.when)).length === 1) {
      const effective = resolveConditionalApiShape(component, conditional.when, authority)
      validateStateChannels(errors, family, componentName, conditional.stateChannels, new Map(effective.props.map((prop) => [prop.name, prop])), new Map(effective.events.map((event) => [event.propName, event])))
    }
  }
  for (const propName of new Set(component.conditionalApi.filter((conditional) => "presence" in conditional.when).map((conditional) => conditional.when.propName))) {
    const presenceCases = component.conditionalApi.filter((conditional) => conditional.when.propName === propName && "presence" in conditional.when)
    if (presenceCases.filter((conditional) => "presence" in conditional.when && conditional.when.presence === "present").length !== 1 || presenceCases.filter((conditional) => "presence" in conditional.when && conditional.when.presence === "absent").length !== 1) {
      errors.push(`Component ${componentName} presence discriminator ${propName} must define exactly one present and one absent case.`)
    }
  }
}

export function validateComponentFamilyInvariants(family: ComponentFamilyContract, authority: ComponentInvariantAuthority): string[] {
  const errors: string[] = []
  // Runtime callers may bypass TypeScript; absence is deliberately fail-closed
  // so composition facts never self-authorize.
  const capabilityIds = authority.capabilityIds ?? new Set<string>()
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
      localNames.add(prop.name)
      hasEvidence(errors, prop.evidenceRefs, family.evidence, `Local prop ${entry.name}.${prop.name}`)
    }
    const inheritedNames = new Set<string>()
    let hasMissingInheritedContract = false
    for (const inherits of component.inherits) {
      if (!authority.interfaceIds.has(inherits)) errors.push(`Component ${entry.name} inherits unknown interface: ${inherits}.`)
      const contract = authority.interfaceContracts.get(inherits)
      if (!contract) {
        errors.push(`Component ${entry.name} inherits interface without a resolved authoritative contract: ${inherits}.`)
        hasMissingInheritedContract = true
      } else {
        for (const prop of contract.props) inheritedNames.add(prop.name)
        for (const propName of authority.interfacePropNames.get(inherits) ?? []) inheritedNames.add(propName)
      }
    }
    if (hasMissingInheritedContract) continue
    for (const propName of localNames) if (inheritedNames.has(propName)) errors.push(`Component ${entry.name} local prop collides with inherited prop: ${propName}.`)
    const defaultNames = new Set<string>()
    for (const inheritedDefault of component.inheritedPropDefaults) {
      if (defaultNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} has duplicate inherited prop default: ${inheritedDefault.propName}.`)
      defaultNames.add(inheritedDefault.propName)
      hasEvidence(errors, inheritedDefault.evidenceRefs, family.evidence, `Inherited prop default ${entry.name}.${inheritedDefault.propName}`)
      if (!inheritedNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} inherited prop default references unknown inherited prop: ${inheritedDefault.propName}.`)
      if (localNames.has(inheritedDefault.propName)) errors.push(`Component ${entry.name} inherited prop default collides with local prop: ${inheritedDefault.propName}.`)
    }
    const props = basePublicProps(component, authority)
    const events = new Map<string, EventContract>()
    const registerEvent = (event: EventContract, mustBePublicProp: boolean) => {
      if (mustBePublicProp) hasEvidence(errors, event.evidenceRefs, family.evidence, `Event ${entry.name}.${event.propName}`)
      if (mustBePublicProp && !props.has(event.propName)) errors.push(`Component ${entry.name} event references unknown prop: ${event.propName}.`)
      if (events.has(event.propName)) errors.push(`Component ${entry.name} has duplicate event: ${event.propName}.`)
      events.set(event.propName, event)
    }
    for (const event of component.events) registerEvent(event, true)
    for (const event of inheritedContracts(component, authority).flatMap((contract) => contract.events ?? []).map((event) => ({ propName: event.propName, payload: event.payload, evidenceRefs: event.evidenceRefs }))) {
      registerEvent(event, false)
    }
    validateStateChannels(errors, family, entry.name, component.stateChannels, props, events)
    for (const [relation, label] of [["requires", "required capability"], ["hardConstraints", "hard constraint"]] as const) {
      const seenCapabilities = new Set<string>()
      for (const capability of component.composition[relation]) {
        if (seenCapabilities.has(capability)) errors.push(`Component ${entry.name} has duplicate ${label} capability: ${capability}.`)
        seenCapabilities.add(capability)
        if (!capabilityIds.has(capability)) errors.push(`Component ${entry.name} ${label} references unknown capability: ${capability}.`)
      }
    }
    const providedCapabilities = new Set<string>()
    for (const capability of component.composition.provides) {
      if (providedCapabilities.has(capability)) errors.push(`Component ${entry.name} has duplicate provided capability: ${capability}.`)
      providedCapabilities.add(capability)
      if (!capabilityIds.has(capability)) errors.push(`Component ${entry.name} provides unknown capability: ${capability}.`)
    }
    const tokenDependencyKeys = new Set<string>()
    for (const token of component.tokenDependencies) {
      hasEvidence(errors, token.evidenceRefs, family.evidence, `Token dependency ${entry.name}.${token.tokenId}`)
      validateTokenCondition(errors, entry.name, token.tokenId, token.when)
      if (token.sourceContext) {
        const applicabilityIsValid = Array.isArray(token.sourceContext.applicability) && token.sourceContext.applicability.every((modifier) => typeof modifier === "string" && modifier.length > 0)
        const targetIsValid = token.sourceContext.target === undefined || (token.sourceContext.target.kind === "pseudo-element" && (token.sourceContext.target.name === "after" || token.sourceContext.target.name === "before"))
        if (!applicabilityIsValid) errors.push(`Component ${entry.name} token dependency ${token.tokenId} has invalid source context applicability.`)
        if (!targetIsValid) errors.push(`Component ${entry.name} token dependency ${token.tokenId} has invalid source context target.`)
        if (applicabilityIsValid && token.sourceContext.applicability.length === 0 && token.sourceContext.target === undefined) errors.push(`Component ${entry.name} token dependency ${token.tokenId} has empty source context.`)
      }
      const key = stableSerialize({ tokenId: token.tokenId, ...(token.when ? { when: token.when } : {}), ...(token.sourceContext ? { sourceContext: token.sourceContext } : {}), ...(token.viaDerivedRule ? { viaDerivedRule: token.viaDerivedRule } : {}) })
      if (tokenDependencyKeys.has(key)) errors.push(`Component ${entry.name} has duplicate token dependency: ${token.tokenId}.`)
      tokenDependencyKeys.add(key)
      if (!authority.tokenIds.has(token.tokenId)) errors.push(`Component ${entry.name} references unknown token: ${token.tokenId}.`)
      if (token.viaDerivedRule && !authority.derivedTokenRuleIds.has(token.viaDerivedRule.id)) errors.push(`Component ${entry.name} references unknown derived token rule: ${token.viaDerivedRule.id}.`)
    }
    validateConditionalApi(errors, family, entry.name, component, props, events, authority)
    const renderExports = new Map(family.exports.map(({ name, kind, authorableJsx }) => [name, { kind, authorableJsx }]))
    const flowCollectionIds = new Set(component.renderingFlow?.collections.map((collection) => collection.id) ?? [])
    const contexts = validateContextFacts(errors, family, entry.name, component, props)
    validateRendering(errors, family, entry.name, component.rendering, authority, renderExports, props, component.localProps, flowCollectionIds, contexts)
    if (component.renderingFlow) validateRenderingFlow(errors, family, entry.name, component.renderingFlow, authority, renderExports, props, component.localProps, contexts)
    const slotNames = new Set<string>()
    for (const slot of component.slots) {
      if (slotNames.has(slot.propName)) errors.push(`Component ${entry.name} has duplicate Slot fact for prop: ${slot.propName}.`)
      slotNames.add(slot.propName)
      hasEvidence(errors, slot.evidenceRefs, family.evidence, `Slot ${entry.name}.${slot.propName}`)
      const prop = props.get(slot.propName)
      if (!prop || prop.availability !== "available") errors.push(`Component ${entry.name} slot references unknown public prop: ${slot.propName}.`)
      if (slot.childCardinality.max < slot.childCardinality.min) errors.push(`Slot ${entry.name}.${slot.propName} has max ${slot.childCardinality.max} below min ${slot.childCardinality.min}.`)
    }
    for (const fact of component.accessibility) hasEvidence(errors, fact.evidenceRefs, family.evidence, `Accessibility ${entry.name}.${fact.feature}`)
  }
  for (const entry of family.exports) for (const context of entry.component?.context ?? []) {
    if (!context.providerExportName) continue
    const providerEntry = family.exports.find((candidate) => candidate.name === context.providerExportName)
    const provider = providerEntry?.component?.context?.find((candidate) => candidate.id === context.id && candidate.provider)
    if (!provider) errors.push(`Component ${entry.name} context ${context.id} references unknown provider export: ${context.providerExportName}.`)
    else if (stableSerialize(context.defaultFields) !== stableSerialize(provider.defaultFields)) errors.push(`Component ${entry.name} context ${context.id} has defaults different from provider ${context.providerExportName}.`)
  }
  for (const unresolved of family.unresolved) hasEvidence(errors, unresolved.evidenceRefs, family.evidence, `Unresolved fact ${unresolved.topic}`)
  if (authority.sourceIdentity && family.source.canonicalPath !== authority.sourceIdentity.canonicalPath) errors.push("Family source canonicalPath does not match approved source identity.")
  if (authority.sourceIdentity && family.source.canonicalBlobSha !== authority.sourceIdentity.canonicalBlobSha) errors.push("Family source canonicalBlobSha does not match approved source identity.")
  return errors
}

export function assertComponentFamilyInvariants(family: ComponentFamilyContract, authority: ComponentInvariantAuthority): void { const errors = validateComponentFamilyInvariants(family, authority); if (errors.length) throw new Error(errors.join("\n")) }
export function validateInheritedInterfaceInvariants(contract: InheritedInterfaceContract): string[] {
  const errors: string[] = []; const names = new Set<string>(); const props = new Map<string, PublicPropFact>(); const events = new Map<string, EventContract>()
  for (const prop of contract.props) {
    if (names.has(prop.name)) errors.push(`Duplicate inherited prop: ${prop.name}.`)
    names.add(prop.name); props.set(prop.name, { name: prop.name, availability: "available", required: prop.required, type: prop.type })
    hasEvidence(errors, prop.evidenceRefs, contract.evidence, `Inherited prop ${prop.name}`)
  }
  for (const event of contract.events ?? []) {
    if (names.has(event.propName) || events.has(event.propName)) errors.push(`Duplicate inherited event: ${event.propName}.`)
    events.set(event.propName, { propName: event.propName, payload: event.payload, evidenceRefs: event.evidenceRefs })
    hasEvidence(errors, event.evidenceRefs, contract.evidence, `Inherited event ${event.propName}`)
  }
  const cases = new Set<string>()
  for (const conditional of contract.conditionalApi ?? []) {
    hasEvidence(errors, conditional.evidenceRefs, contract.evidence, `Inherited interface ${contract.id}.${conditional.when.propName}`)
    const discriminator = props.get(conditional.when.propName)
    if ("equals" in conditional.when && (!discriminator?.type || !isStructuredPropTypeAssignable({ kind: "literal", value: conditional.when.equals }, discriminator.type))) errors.push(`Inherited interface ${contract.id} has invalid discriminator ${conditional.when.propName}=${String(conditional.when.equals)}.`)
    else if ("presence" in conditional.when && discriminator?.required) errors.push(`Inherited interface ${contract.id} cannot use presence discrimination on required prop ${conditional.when.propName}.`)
    const caseKey = conditionalApiConditionKey(conditional.when)
    if (cases.has(caseKey)) errors.push(`Inherited interface ${contract.id} has conflicting conditional API case for ${conditionalApiConditionLabel(conditional.when)}.`)
    cases.add(caseKey)
    for (const refinement of conditional.propRefinements) {
      const base = props.get(refinement.propName); hasEvidence(errors, refinement.evidenceRefs, contract.evidence, `Inherited interface prop refinement ${contract.id}.${refinement.propName}`)
      if (!base) errors.push(`Inherited interface ${contract.id}.${conditional.when.propName} refines unknown prop: ${refinement.propName}.`)
      else if (refinement.availability === "unavailable" && base.required) errors.push(`Inherited interface ${contract.id}.${conditional.when.propName} cannot make required prop unavailable: ${refinement.propName}.`)
      else if (refinement.availability === "available" && (!base.type || (!strictlyNarrowsStructuredPropType(refinement.type, base.type) && !(refinement.required && !base.required && isStructuredPropTypeAssignable(refinement.type, base.type))))) errors.push(`Inherited interface ${contract.id}.${conditional.when.propName} refines prop ${refinement.propName} with a type that does not narrow its base type.`)
    }
    for (const refinement of conditional.eventRefinements) {
      const base = events.get(refinement.eventPropName); hasEvidence(errors, refinement.evidenceRefs, contract.evidence, `Inherited interface event refinement ${contract.id}.${refinement.eventPropName}`)
      if (!base) errors.push(`Inherited interface ${contract.id}.${conditional.when.propName} refines unknown event: ${refinement.eventPropName}.`)
      else if (!base.payload || !strictlyNarrowsStructuredPropType(refinement.payload, base.payload)) errors.push(`Inherited interface ${contract.id}.${conditional.when.propName} refines event ${refinement.eventPropName} with a payload that does not narrow its base payload.`)
    }
  }
  for (const propName of new Set((contract.conditionalApi ?? []).filter((conditional) => "presence" in conditional.when).map((conditional) => conditional.when.propName))) {
    const presenceCases = (contract.conditionalApi ?? []).filter((conditional) => conditional.when.propName === propName && "presence" in conditional.when)
    if (presenceCases.filter((conditional) => "presence" in conditional.when && conditional.when.presence === "present").length !== 1 || presenceCases.filter((conditional) => "presence" in conditional.when && conditional.when.presence === "absent").length !== 1) {
      errors.push(`Inherited interface ${contract.id} presence discriminator ${propName} must define exactly one present and one absent case.`)
    }
  }
  return errors
}
export function assertInheritedInterfaceInvariants(contract: InheritedInterfaceContract): void { const errors = validateInheritedInterfaceInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
export function validateComponentContractSetInvariants(contract: ComponentContractSet): string[] { return contract.familyCount !== contract.familyFiles.length ? ["Contract set familyCount must equal familyFiles length."] : [] }
export function assertComponentContractSetInvariants(contract: ComponentContractSet): void { const errors = validateComponentContractSetInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
