import { resolveConditionalApiShape } from "../contracts/components/invariants"
import type {
  ComponentDefinition,
  ComponentFamilyContract,
  EventContract,
  InheritedInterfaceContract,
  PublicExportContract,
  StateChannel,
} from "../contracts/components/types"
import {
  type ExecutableApiShape,
  type ExecutableComponent,
  type ExecutableConditionalApi,
  type ExecutableContract,
  type ExecutableContractSource,
  type ExecutableEvent,
  type ExecutableExport,
  type ExecutableTokenContractAuthority,
  type ExecutableProp,
  ExecutableContractProjectionError,
} from "./types"

type InterfaceAuthority = {
  interfaceIds: Set<string>
  interfacePropNames: Map<string, Set<string>>
  interfaceContracts: Map<string, InheritedInterfaceContract>
  tokenIds: Set<string>
  derivedTokenRuleIds: Set<string>
  capabilityIds: Set<string>
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object") return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  for (const key of Reflect.ownKeys(object)) deepFreeze((object as Record<PropertyKey, unknown>)[key], seen)
  return Object.freeze(value)
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function qualifiedExport(familyId: string, exportName: string) {
  return `${familyId}\u0000${exportName}`
}

function inheritedContracts(component: ComponentDefinition, authority: InterfaceAuthority) {
  return component.inherits.map((interfaceId) => {
    const contract = authority.interfaceContracts.get(interfaceId)
    if (!contract) throw new ExecutableContractProjectionError("EXECUTABLE_PROJECTION_UNRESOLVED", `Missing inherited interface authority: ${interfaceId}.`)
    return contract
  })
}

function propWithOrigin(prop: { name: string; required: boolean; type: ComponentDefinition["localProps"][number]["type"]; default?: string | number | boolean | null }, origin: ExecutableProp["origin"]): ExecutableProp {
  return {
    name: prop.name,
    availability: "available" as const,
    required: prop.required,
    type: prop.type,
    origin,
    ...(Object.prototype.hasOwnProperty.call(prop, "default") ? { default: prop.default } : {}),
  }
}

function effectiveProps(component: ComponentDefinition, authority: InterfaceAuthority): readonly ExecutableProp[] {
  const props: ExecutableProp[] = []
  const inheritedDefaults = new Map(component.inheritedPropDefaults.map((entry) => [entry.propName, entry.value]))
  const names = new Set<string>()
  for (const prop of component.localProps) {
    if (!names.has(prop.name)) props.push(propWithOrigin(prop, "local"))
    names.add(prop.name)
  }
  for (const contract of inheritedContracts(component, authority)) {
    for (const prop of contract.props) {
      if (!names.has(prop.name)) props.push(propWithOrigin(prop, "inherited"))
      names.add(prop.name)
    }
  }
  return Object.freeze(props.map((prop) => prop.availability === "available" && inheritedDefaults.has(prop.name) && !Object.prototype.hasOwnProperty.call(prop, "default")
    ? { ...prop, default: inheritedDefaults.get(prop.name)! }
    : prop))
}

function projectEvent(event: EventContract | NonNullable<InheritedInterfaceContract["events"]>[number], origin: ExecutableEvent["origin"]): ExecutableEvent {
  return {
    propName: event.propName,
    required: "required" in event ? event.required : false,
    ...(event.payload ? { payload: event.payload } : {}),
    origin,
  }
}

function effectiveEvents(component: ComponentDefinition, authority: InterfaceAuthority): readonly ExecutableEvent[] {
  const events = new Map<string, ExecutableEvent>()
  for (const event of component.events) events.set(event.propName, projectEvent(event, "local"))
  for (const contract of inheritedContracts(component, authority)) {
    for (const event of contract.events ?? []) if (!events.has(event.propName)) events.set(event.propName, projectEvent(event, "inherited"))
  }
  return Object.freeze([...events.values()].sort((left, right) => compareText(left.propName, right.propName)))
}

function conditionalSelections(component: ComponentDefinition, authority: InterfaceAuthority) {
  const cases = new Map<string, { propName: string; equals: string | number | boolean }>()
  for (const contract of inheritedContracts(component, authority)) {
    for (const entry of contract.conditionalApi ?? []) cases.set(`${entry.when.propName}:${JSON.stringify(entry.when.equals)}`, entry.when)
  }
  for (const entry of component.conditionalApi) cases.set(`${entry.when.propName}:${JSON.stringify(entry.when.equals)}`, entry.when)
  return [...cases.values()].sort((left, right) => compareText(left.propName, right.propName) || compareText(JSON.stringify(left.equals), JSON.stringify(right.equals)))
}

function branchStateChannels(component: ComponentDefinition, authority: InterfaceAuthority, selection: { propName: string; equals: string | number | boolean }): readonly StateChannel[] {
  const channels: StateChannel[] = []
  for (const contract of inheritedContracts(component, authority)) {
    for (const entry of contract.conditionalApi ?? []) if (entry.when.propName === selection.propName && entry.when.equals === selection.equals) channels.push(...entry.stateChannels)
  }
  for (const entry of component.conditionalApi) if (entry.when.propName === selection.propName && entry.when.equals === selection.equals) channels.push(...entry.stateChannels)
  return Object.freeze(channels)
}

function branchProps(shape: ReturnType<typeof resolveConditionalApiShape>): readonly ExecutableProp[] {
  return Object.freeze(shape.props.map((prop) => prop.availability === "available"
    ? { name: prop.name, availability: "available" as const, required: prop.required, type: prop.type, origin: "conditional" as const }
    : { name: prop.name, availability: "unavailable" as const, origin: "conditional" as const }))
}

function branchShape(component: ComponentDefinition, authority: InterfaceAuthority, selection: { propName: string; equals: string | number | boolean }): ExecutableApiShape {
  const shape = resolveConditionalApiShape(component, selection, authority)
  return {
    props: branchProps(shape),
    events: Object.freeze(shape.events.map((event) => projectEvent(event, component.events.some((candidate) => candidate.propName === event.propName) ? "local" : "inherited"))),
    stateChannels: branchStateChannels(component, authority, selection),
  }
}

function familyUnresolved(family: ComponentFamilyContract, component: ComponentDefinition, authority: InterfaceAuthority) {
  return Object.freeze([
    ...family.unresolved,
    ...inheritedContracts(component, authority).flatMap((contract) => contract.unresolved),
  ])
}

function projectComponent(family: ComponentFamilyContract, entry: PublicExportContract, authority: InterfaceAuthority): ExecutableComponent {
  const component = entry.component!
  const conditionalApi: ExecutableConditionalApi[] = conditionalSelections(component, authority).map((when) => ({ when, shape: branchShape(component, authority, when) }))
  return {
    props: effectiveProps(component, authority),
    events: effectiveEvents(component, authority),
    stateChannels: Object.freeze([...component.stateChannels]),
    conditionalApi: Object.freeze(conditionalApi),
    slots: Object.freeze([...component.slots]),
    composition: component.composition,
    tokenDependencies: Object.freeze([...component.tokenDependencies]),
    unresolved: familyUnresolved(family, component, authority),
  }
}

function authorityFor(components: ExecutableContractSource["componentContracts"], tokenContract: ExecutableTokenContractAuthority): InterfaceAuthority {
  // The production loader deliberately exposes deep-readonly contracts. The
  // Phase 3 resolver is read-only in practice but predates that public type;
  // this cast keeps the compatibility boundary local without mutating facts.
  const interfaceContracts = new Map<string, InheritedInterfaceContract>(components.interfaces.map((contract) => [contract.id, contract as unknown as InheritedInterfaceContract]))
  const capabilityIds = new Set<string>()
  for (const family of components.families) {
    for (const entry of family.exports) {
      for (const capability of [ ...(entry.component?.composition.requires ?? []), ...(entry.component?.composition.provides ?? []) ]) capabilityIds.add(capability)
    }
  }
  return {
    interfaceIds: new Set(interfaceContracts.keys()),
    interfacePropNames: new Map([...interfaceContracts.entries()].map(([id, contract]) => [id, new Set(contract.props.map((prop) => prop.name))])),
    interfaceContracts,
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
    capabilityIds,
  }
}

function projectExport(family: ComponentFamilyContract, entry: PublicExportContract, authority: InterfaceAuthority): ExecutableExport {
  const component = entry.kind === "component" && entry.component ? projectComponent(family, entry, authority) : undefined
  return {
    familyId: family.id,
    name: entry.name,
    kind: entry.kind,
    authorableJsx: entry.authorableJsx,
    ...(component ? { component } : {}),
    unresolved: component?.unresolved ?? Object.freeze([...family.unresolved]),
  }
}

export function projectExecutableContract(source: ExecutableContractSource): ExecutableContract {
  const { componentContracts, tokenContract } = source
  const contractSet = componentContracts.contractSet
  if (contractSet.status !== "approved") throw new ExecutableContractProjectionError("EXECUTABLE_CONTRACT_NOT_APPROVED", `Executable projection requires an approved component contract set: ${contractSet.id}.`)
  if (tokenContract.status !== "approved") throw new ExecutableContractProjectionError("EXECUTABLE_TOKEN_CONTRACT_NOT_APPROVED", `Executable projection requires an approved token contract: ${tokenContract.id}.`)
  if (contractSet.tokenContractId !== tokenContract.id) throw new ExecutableContractProjectionError("EXECUTABLE_TOKEN_CONTRACT_MISMATCH", `Component contract set references ${contractSet.tokenContractId}, received ${tokenContract.id}.`)

  const authority = authorityFor(componentContracts, tokenContract)
  const exports: Record<string, ExecutableExport> = {}
  for (const family of [...componentContracts.families].sort((left, right) => compareText(left.id, right.id))) {
    const mutableFamily = family as unknown as ComponentFamilyContract
    for (const entry of [...family.exports].sort((left, right) => compareText(left.name, right.name))) {
      exports[qualifiedExport(family.id, entry.name)] = projectExport(mutableFamily, entry as unknown as PublicExportContract, authority)
    }
  }

  const capabilities = [...authority.capabilityIds].sort(compareText)
  const result: ExecutableContract = {
    schemaVersion: 1,
    componentContractSetId: contractSet.id,
    componentContractStatus: contractSet.status,
    tokenContractId: tokenContract.id,
    sourceBaselineCommit: contractSet.sourceBaselineCommit,
    tokenSourceBaselineCommit: tokenContract.sourceBaselineCommit,
    exports,
    tokenIds: [...new Set(tokenContract.tokens.map((token) => token.id))].sort(compareText),
    derivedTokenRules: [...new Map(tokenContract.derivedRules.map((rule) => [rule.id, {
      id: rule.id,
      baseTokenId: rule.baseTokenId,
      parameter: {
        name: rule.parameter.name,
        type: rule.parameter.type,
        ...(rule.parameter.minimum !== undefined ? { minimum: rule.parameter.minimum } : {}),
      },
    }])).values()].sort((left, right) => compareText(left.id, right.id)),
    derivedTokenRuleIds: [...new Set(tokenContract.derivedRules.map((rule) => rule.id))].sort(compareText),
    capabilityIds: capabilities,
  }
  // Clone before freezing so an executable release owns its immutable graph
  // instead of freezing the loaded Phase 3 source by shared reference.
  return deepFreeze(structuredClone(result))
}

export function executableExportKey(familyId: string, exportName: string) {
  return qualifiedExport(familyId, exportName)
}
