import { isRenderingTree } from "./types"
import type { ComponentContractSet, ComponentDefinition, ComponentFamilyContract, ComponentInvariantAuthority, EffectiveComponentApiShape, EffectivePublicProp, EventContract, InheritedInterfaceContract, RenderCondition, RenderingTree, StructuredPropType } from "./types"

type PublicPropFact = { name: string; availability: "available" | "unavailable"; required?: boolean; type?: StructuredPropType }

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

function resolveConditionalApiShapeAtStage(component: ComponentDefinition, selection: { propName: string; equals: string | number | boolean }, authority: ComponentInvariantAuthority, includeWrapperRefinements: boolean): EffectiveComponentApiShape {
  const interfaceCases = inheritedContracts(component, authority).flatMap((contract) => {
    const cases = (contract.conditionalApi ?? []).filter((candidate) => candidate.when.propName === selection.propName && candidate.when.equals === selection.equals)
    if (cases.length > 1) throw new Error(`Expected at most one inherited conditional API case for ${selection.propName}=${String(selection.equals)}.`)
    return cases
  })
  const componentCases = component.conditionalApi.filter((candidate) => candidate.when.propName === selection.propName && candidate.when.equals === selection.equals)
  if (componentCases.length > 1) throw new Error(`Expected at most one component conditional API case for ${selection.propName}=${String(selection.equals)}.`)
  if (interfaceCases.length + componentCases.length === 0) throw new Error(`Expected a conditional API case for ${selection.propName}=${String(selection.equals)}.`)
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
export function resolveConditionalApiShape(component: ComponentDefinition, selection: { propName: string; equals: string | number | boolean }, authority: ComponentInvariantAuthority): EffectiveComponentApiShape {
  return resolveConditionalApiShapeAtStage(component, selection, authority, true)
}

function isPublicRenderCondition(condition: RenderCondition): condition is Extract<RenderCondition, { propName: string }> { return "propName" in condition }

function validateRenderCondition(errors: string[], componentName: string, scope: string, condition: RenderCondition, props: Map<string, PublicPropFact>) {
  if (!isPublicRenderCondition(condition)) return
  const prop = props.get(condition.propName)
  if (!prop || prop.availability !== "available") {
    errors.push(`Component ${componentName} ${scope} condition references unknown prop: ${condition.propName}.`)
    return
  }
  if ("truthiness" in condition) return
  if (!prop.type || !isStructuredPropTypeAssignable({ kind: "literal", value: condition.equals }, prop.type)) {
    errors.push(`Component ${componentName} ${scope} condition has incompatible literal for prop ${condition.propName}: ${String(condition.equals)}.`)
  }
}

function validateRenderingTree(errors: string[], family: ComponentFamilyContract, componentName: string, rendering: RenderingTree, authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Map<string, PublicPropFact>, localProps: ComponentDefinition["localProps"]) {
  const ids = new Set<string>()
  for (const node of rendering.nodes) {
    if (ids.has(node.id)) errors.push(`Component ${componentName} has duplicate render-node ID: ${node.id}.`)
    ids.add(node.id)
    hasEvidence(errors, node.evidenceRefs, family.evidence, `Render node ${componentName}.${node.id}`)
    for (const attr of node.dataAttributes) {
      hasEvidence(errors, attr.evidenceRefs, family.evidence, `Render attribute ${componentName}.${node.id}.${attr.name}`)
      if (attr.source === "derived-condition") validateRenderCondition(errors, componentName, `render attribute ${node.id}.${attr.name}`, attr.condition, props)
      if (attr.source === "prop" && !props.has(attr.prop)) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} references unknown prop: ${attr.prop}.`)
      if (attr.source === "conditional-value") {
        validateRenderCondition(errors, componentName, `render attribute ${node.id}.${attr.name}`, attr.condition, props)
        for (const value of [attr.whenTrue, attr.whenFalse]) if (value.source === "prop" && !props.has(value.name)) errors.push(`Component ${componentName} render attribute ${node.id}.${attr.name} references unknown prop value: ${value.name}.`)
      }
    }
    for (const spread of node.derivedSpreads ?? []) {
      hasEvidence(errors, spread.evidenceRefs, family.evidence, `Derived render spread ${componentName}.${node.id}.${spread.name}`)
      if (spread.source === "prop" && !props.has(spread.name)) errors.push(`Component ${componentName} derived render spread ${node.id} references unknown prop: ${spread.name}.`)
    }
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
      if (isPublicRenderCondition(child.when)) {
        const condition = child.when
        if (!props.has(condition.propName)) errors.push(`Component ${componentName} render child condition references unknown prop: ${condition.propName}.`)
        const localProp = localProps.find((prop) => prop.name === condition.propName)
        if ("equals" in condition && localProp?.type.kind === "boolean" && typeof condition.equals !== "boolean") errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has boolean prop ${condition.propName} but equals is not boolean.`)
        if ("equals" in condition && localProp?.type.kind === "enum" && (typeof condition.equals !== "string" || !localProp.type.values.includes(condition.equals))) errors.push(`Component ${componentName} render child condition for ${node.id}->${child.nodeId} has enum prop ${condition.propName} without value: ${String(condition.equals)}.`)
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

function validateRendering(errors: string[], family: ComponentFamilyContract, componentName: string, rendering: ComponentDefinition["rendering"], authority: ComponentInvariantAuthority, exportEntries: Map<string, { kind: string; authorableJsx: boolean }>, props: Map<string, PublicPropFact>, localProps: ComponentDefinition["localProps"]) {
  if (isRenderingTree(rendering)) {
    validateRenderingTree(errors, family, componentName, rendering, authority, exportEntries, props, localProps)
    return
  }
  let otherwiseCount = 0
  for (const [index, alternative] of rendering.alternatives.entries()) {
    hasEvidence(errors, alternative.evidenceRefs, family.evidence, `Render alternative ${componentName}.${index}`)
    if ("otherwise" in alternative) otherwiseCount += 1
    else validateRenderCondition(errors, componentName, `render alternative ${index}`, alternative.when, props)
    validateRenderingTree(errors, family, `${componentName} alternative ${index}`, alternative.rendering, authority, exportEntries, props, localProps)
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
    else if (!discriminator.type || !isStructuredPropTypeAssignable({ kind: "literal", value: conditional.when.equals }, discriminator.type)) errors.push(`Conditional API ${componentName}.${conditional.when.propName} has enum prop without value: ${String(conditional.when.equals)}.`)
    const caseKey = `${conditional.when.propName}:${JSON.stringify(conditional.when.equals)}`
    if (cases.has(caseKey)) errors.push(`Component ${componentName} has conflicting conditional API case for ${conditional.when.propName}=${String(conditional.when.equals)}.`)
    cases.add(caseKey)

    const inheritedBranchExists = inheritedContracts(component, authority).some((contract) => (contract.conditionalApi ?? []).some((candidate) => candidate.when.propName === conditional.when.propName && candidate.when.equals === conditional.when.equals))
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

    if (component.conditionalApi.filter((candidate) => candidate.when.propName === conditional.when.propName && candidate.when.equals === conditional.when.equals).length === 1) {
      const effective = resolveConditionalApiShape(component, conditional.when, authority)
      validateStateChannels(errors, family, componentName, conditional.stateChannels, new Map(effective.props.map((prop) => [prop.name, prop])), new Map(effective.events.map((event) => [event.propName, event])))
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
      const key = JSON.stringify({ tokenId: token.tokenId, ...(token.when ? { when: token.when } : {}), ...(token.viaDerivedRule ? { viaDerivedRule: token.viaDerivedRule } : {}) })
      if (tokenDependencyKeys.has(key)) errors.push(`Component ${entry.name} has duplicate token dependency: ${token.tokenId}.`)
      tokenDependencyKeys.add(key)
      if (!authority.tokenIds.has(token.tokenId)) errors.push(`Component ${entry.name} references unknown token: ${token.tokenId}.`)
      if (token.viaDerivedRule && !authority.derivedTokenRuleIds.has(token.viaDerivedRule.id)) errors.push(`Component ${entry.name} references unknown derived token rule: ${token.viaDerivedRule.id}.`)
    }
    validateConditionalApi(errors, family, entry.name, component, props, events, authority)
    validateRendering(errors, family, entry.name, component.rendering, authority, new Map(family.exports.map(({ name, kind, authorableJsx }) => [name, { kind, authorableJsx }])), props, component.localProps)
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
    if (!discriminator?.type || !isStructuredPropTypeAssignable({ kind: "literal", value: conditional.when.equals }, discriminator.type)) errors.push(`Inherited interface ${contract.id} has invalid discriminator ${conditional.when.propName}=${String(conditional.when.equals)}.`)
    const caseKey = `${conditional.when.propName}:${JSON.stringify(conditional.when.equals)}`
    if (cases.has(caseKey)) errors.push(`Inherited interface ${contract.id} has conflicting conditional API case for ${conditional.when.propName}=${String(conditional.when.equals)}.`)
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
  return errors
}
export function assertInheritedInterfaceInvariants(contract: InheritedInterfaceContract): void { const errors = validateInheritedInterfaceInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
export function validateComponentContractSetInvariants(contract: ComponentContractSet): string[] { return contract.familyCount !== contract.familyFiles.length ? ["Contract set familyCount must equal familyFiles length."] : [] }
export function assertComponentContractSetInvariants(contract: ComponentContractSet): void { const errors = validateComponentContractSetInvariants(contract); if (errors.length) throw new Error(errors.join("\n")) }
