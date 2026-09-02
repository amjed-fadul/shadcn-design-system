import { isStructuredPropTypeAssignable } from "../contracts/components/invariants"
import type { StructuredPropType } from "../contracts/components/types"
import type {
  AuthoredNode,
  AuthoredUi,
  AuthoredValue,
  ExecutableApiShape,
  ExecutableComponent,
  ExecutableContract,
  ExecutableEvent,
  ExecutableExport,
  ExecutableProp,
  JsonValue,
  SourceLocation,
} from "./types"
import type { ExpectedFact, ReceivedValue, ValidationError, ValidationResult, ValidationTarget } from "./errors"

type Match = "valid" | "invalid" | "unresolved"

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function qualified(familyId: string, exportName: string) {
  return `${familyId}\u0000${exportName}`
}

function propTarget(node: Extract<AuthoredNode, { kind: "component" }>, propName: string): ValidationTarget {
  return { kind: "prop", nodeId: node.id, propName, location: { ...node.location, path: `${node.location.path}.${propName}` } }
}

function nodeTarget(node: AuthoredNode): ValidationTarget {
  return { kind: "node", nodeId: node.id, location: node.location }
}

function tokenTarget(tokenId: string, location: SourceLocation): ValidationTarget {
  return { kind: "token", tokenId, location }
}

function receivedValue(value: AuthoredValue): ReceivedValue {
  return value.kind === "literal" ? value.value : value
}

function error(code: ValidationError["code"], message: string, target: ValidationTarget, expected?: ExpectedFact, received?: ReceivedValue): ValidationError {
  return { code, message, target, ...(expected ? { expected } : {}), ...(received !== undefined ? { received } : {}) }
}

function matchStructuredValue(value: JsonValue, expected: StructuredPropType): Match {
  if (expected.kind === "boolean") return typeof value === "boolean" ? "valid" : "invalid"
  if (expected.kind === "string") return typeof value === "string" ? "valid" : "invalid"
  if (expected.kind === "number") return typeof value === "number" ? "valid" : "invalid"
  if (expected.kind === "enum") return typeof value === "string" && expected.values.includes(value) ? "valid" : "invalid"
  if (expected.kind === "literal") return value === expected.value ? "valid" : "invalid"
  if (expected.kind === "array") {
    if (!Array.isArray(value)) return "invalid"
    let unresolved = false
    for (const item of value) {
      const itemResult = matchStructuredValue(item, expected.item)
      if (itemResult === "valid") continue
      if (itemResult === "unresolved") unresolved = true
      else return "invalid"
    }
    return unresolved ? "unresolved" : "valid"
  }
  if (expected.kind === "union") {
    let unresolved = false
    for (const member of expected.members) {
      const memberResult = matchStructuredValue(value, member)
      if (memberResult === "valid") return "valid"
      if (memberResult === "unresolved") unresolved = true
    }
    return unresolved ? "unresolved" : "invalid"
  }
  return "unresolved"
}

function matchAuthoredValue(value: AuthoredValue, expected: StructuredPropType): Match {
  if (value.kind === "expression" || value.kind === "callback") return "unresolved"
  return matchStructuredValue(value.value, expected)
}

function isCheckableType(type: StructuredPropType): boolean {
  if (type.kind === "typescript") return false
  if (type.kind === "array") return isCheckableType(type.item)
  if (type.kind === "union") return type.members.every(isCheckableType)
  return true
}

function validateEvent(node: Extract<AuthoredNode, { kind: "component" }>, event: ExecutableEvent, authored: AuthoredValue, errors: ValidationError[]) {
  const target = propTarget(node, event.propName)
  if (authored.kind !== "callback") {
    errors.push(error("INVALID_PROP_VALUE", `Event prop ${node.exportName}.${event.propName} requires a callback value.`, target, { kind: "event", payload: event.payload }, receivedValue(authored)))
    return
  }
  if (!event.payload || !authored.parameterType || !isCheckableType(event.payload) || !isCheckableType(authored.parameterType)) {
    errors.push(error("UNRESOLVED_FACT", `The callback parameter type for ${node.exportName}.${event.propName} cannot be established from the authored input.`, target, { kind: "event", payload: event.payload }, receivedValue(authored)))
    return
  }
  if (!isStructuredPropTypeAssignable(event.payload, authored.parameterType) || !isStructuredPropTypeAssignable(authored.parameterType, event.payload)) {
    errors.push(error("INVALID_PROP_VALUE", `Event prop ${node.exportName}.${event.propName} has an incompatible callback parameter type.`, target, { kind: "event", payload: event.payload }, receivedValue(authored)))
  }
}

function expectedForType(type: StructuredPropType): ExpectedFact {
  if (type.kind === "enum") return { kind: "enum", values: type.values }
  return { kind: "type", type }
}

type BranchFact = Readonly<{
  propName: string
  values: readonly (string | number | boolean)[]
}>

type BranchSensitiveFacts = Readonly<{
  props: ReadonlyMap<string, BranchFact>
  events: ReadonlyMap<string, BranchFact>
  stateProps: ReadonlyMap<string, BranchFact>
}>

type BranchResolution = Readonly<{
  shape?: ExecutableApiShape
  fullySelected: boolean
  unresolvedDiscriminators: ReadonlySet<string>
  sensitive: BranchSensitiveFacts
}>

function baseProp(component: ExecutableComponent, name: string): ExecutableProp | undefined {
  return component.props.find((prop) => prop.name === name)
}

function baseEvent(component: ExecutableComponent, name: string): ExecutableEvent | undefined {
  return component.events.find((event) => event.propName === name)
}

function propFactKey(prop: ExecutableProp) {
  return prop.availability === "available"
    ? JSON.stringify({ availability: prop.availability, required: prop.required, type: prop.type })
    : JSON.stringify({ availability: prop.availability })
}

function eventFactKey(event: ExecutableEvent) {
  return JSON.stringify({ required: event.required, payload: event.payload })
}

function addBranchFact(target: Map<string, BranchFact>, name: string, propName: string, values: readonly (string | number | boolean)[]) {
  if (!target.has(name)) target.set(name, { propName, values })
}

function branchSensitiveFacts(component: ExecutableComponent): BranchSensitiveFacts {
  const props = new Map<string, BranchFact>()
  const events = new Map<string, BranchFact>()
  const stateProps = new Map<string, BranchFact>()

  for (const conditional of component.conditionalApi) {
    const values = component.conditionalApi
      .filter((candidate) => candidate.when.propName === conditional.when.propName)
      .map((candidate) => candidate.when.equals)
    for (const prop of conditional.shape.props) {
      const base = baseProp(component, prop.name)
      if (!base || propFactKey(base) !== propFactKey(prop)) addBranchFact(props, prop.name, conditional.when.propName, values)
    }
    for (const event of conditional.shape.events) {
      const base = baseEvent(component, event.propName)
      if (!base || eventFactKey(base) !== eventFactKey(event)) addBranchFact(events, event.propName, conditional.when.propName, values)
    }
    for (const state of conditional.shape.stateChannels) {
      for (const propName of [state.controlledProp, state.defaultProp, state.changeEventProp]) {
        if (propName) addBranchFact(stateProps, propName, conditional.when.propName, values)
      }
    }
  }

  return { props, events, stateProps }
}

function unresolvedBranchFact(node: Extract<AuthoredNode, { kind: "component" }>, propName: string, authored: AuthoredValue, fact: BranchFact, errors: ValidationError[]) {
  errors.push(error(
    "UNRESOLVED_FACT",
    `Cannot validate ${node.exportName}.${propName} until conditional API branch ${fact.propName} is selected.`,
    propTarget(node, propName),
    { kind: "conditional-branch", propName: fact.propName, values: fact.values },
    receivedValue(authored),
  ))
}

function branchFor(component: ExecutableComponent, node: Extract<AuthoredNode, { kind: "component" }>, errors: ValidationError[]): BranchResolution {
  let selected: ExecutableApiShape | undefined
  let fullySelected = true
  const unresolvedDiscriminators = new Set<string>()
  const casesByProp = new Map<string, typeof component.conditionalApi>()
  for (const conditional of component.conditionalApi) casesByProp.set(conditional.when.propName, [...(casesByProp.get(conditional.when.propName) ?? []), conditional])

  for (const [propName, cases] of casesByProp) {
    const authored = node.props[propName]
    const values = cases.map((entry) => entry.when.equals)
    if (!authored) {
      fullySelected = false
      unresolvedDiscriminators.add(propName)
      continue
    }
    if (authored.kind !== "literal") {
      fullySelected = false
      unresolvedDiscriminators.add(propName)
      errors.push(error("UNRESOLVED_FACT", `Cannot select conditional API branch from unresolved prop ${propName}.`, propTarget(node, propName), { kind: "conditional-branch", propName, values }, receivedValue(authored)))
      continue
    }
    const match = cases.find((entry) => entry.when.equals === authored.value)
    if (!match) {
      fullySelected = false
      unresolvedDiscriminators.add(propName)
      errors.push(error("CONDITIONAL_API_VIOLATION", `No factual API branch exists for ${propName}=${String(authored.value)}.`, propTarget(node, propName), { kind: "conditional-branch", propName, values }, receivedValue(authored)))
      continue
    }
    if (selected && selected !== match.shape) errors.push(error("CONDITIONAL_API_VIOLATION", `Multiple conditional API branches were selected for ${node.exportName}.`, propTarget(node, propName), { kind: "conditional-branch", propName, values }, receivedValue(authored)))
    selected = match.shape
  }
  return { shape: selected, fullySelected, unresolvedDiscriminators, sensitive: branchSensitiveFacts(component) }
}

function validateProps(node: Extract<AuthoredNode, { kind: "component" }>, component: ExecutableComponent, branch: BranchResolution, errors: ValidationError[]) {
  const selected = branch.fullySelected ? branch.shape : undefined
  const props = new Map(component.props.map((prop) => [prop.name, prop]))
  for (const prop of selected?.props ?? []) props.set(prop.name, prop)
  const events = new Map((selected?.events ?? component.events).map((event) => [event.propName, event]))

  for (const [propName, authored] of Object.entries(node.props)) {
    if (!branch.fullySelected) {
      const branchFact = branch.sensitive.props.get(propName) ?? branch.sensitive.events.get(propName) ?? branch.sensitive.stateProps.get(propName)
      if (branchFact) {
        unresolvedBranchFact(node, propName, authored, branchFact, errors)
        continue
      }
      if (branch.unresolvedDiscriminators.has(propName)) continue
    }
    const event = events.get(propName)
    if (event) {
      validateEvent(node, event, authored, errors)
      continue
    }
    const prop = props.get(propName)
    if (!prop) {
      errors.push(error("INVALID_PROP", `Prop ${propName} is not part of the factual ${node.exportName} API.`, propTarget(node, propName), { kind: "known-prop" }, receivedValue(authored)))
      continue
    }
    if (prop.availability === "unavailable") {
      errors.push(error("CONDITIONAL_API_VIOLATION", `Prop ${propName} is unavailable for the selected ${node.exportName} API branch.`, propTarget(node, propName), { kind: "unavailable-prop" }, receivedValue(authored)))
      continue
    }
    const result = matchAuthoredValue(authored, prop.type)
    if (result === "unresolved") {
      errors.push(error("UNRESOLVED_FACT", `The value of ${node.exportName}.${propName} cannot be established from the authored input.`, propTarget(node, propName), { kind: "resolved-value", type: prop.type }, receivedValue(authored)))
    } else if (result === "invalid") {
      errors.push(error("INVALID_PROP_VALUE", `Prop ${node.exportName}.${propName} does not accept the authored value.`, propTarget(node, propName), expectedForType(prop.type), receivedValue(authored)))
    }
  }

  for (const prop of props.values()) {
    if (prop.availability === "available" && prop.required && !(prop.name in node.props)) {
      errors.push(error("INVALID_PROP", `Required prop ${node.exportName}.${prop.name} is missing.`, nodeTarget(node), { kind: "required-prop", propName: prop.name, type: prop.type }))
    }
  }
}

function validateSlot(node: Extract<AuthoredNode, { kind: "component" }>, component: ExecutableComponent, errors: ValidationError[]) {
  for (const slot of component.slots) {
    const value = node.props[slot.propName]
    if (value && value.kind !== "literal") {
      errors.push(error(
        "UNRESOLVED_FACT",
        `Cannot determine whether Slot prop ${slot.propName} is enabled from the authored input.`,
        propTarget(node, slot.propName),
        { kind: "resolved-value", type: { kind: "boolean" } },
        receivedValue(value),
      ))
      continue
    }
    const enabled = value?.kind === "literal" ? value.value === true : slot.default
    if (!enabled) continue
    const count = node.children.length
    const childShape = { kind: "slot-child" as const, min: slot.childCardinality.min, max: slot.childCardinality.max }
    if (count < slot.childCardinality.min || count > slot.childCardinality.max) {
      errors.push(error("SLOT_VIOLATION", `Slot prop ${slot.propName} requires between ${slot.childCardinality.min} and ${slot.childCardinality.max} child element(s).`, { kind: "children", nodeId: node.id, location: node.location }, childShape, count))
      continue
    }
    if (count === 1 && node.children[0].kind === "text") {
      errors.push(error("SLOT_VIOLATION", `Slot prop ${slot.propName} requires a child element, not text.`, { kind: "children", nodeId: node.id, location: node.location }, childShape, node.children[0].value))
    }
  }
}

function validateExport(node: Extract<AuthoredNode, { kind: "component" }>, contract: ExecutableContract, errors: ValidationError[]): ExecutableExport | undefined {
  const entry = contract.exports[qualified(node.familyId, node.exportName)]
  if (!entry) {
    errors.push(error("UNKNOWN_EXPORT", `Export ${node.familyId}.${node.exportName} is not in the executable contract.`, nodeTarget(node)))
    return undefined
  }
  if (!entry.authorableJsx || entry.kind !== "component" || !entry.component) {
    errors.push(error("NON_AUTHORABLE_EXPORT", `Export ${node.familyId}.${node.exportName} is not JSX-authorable.`, nodeTarget(node), { kind: "authorable-export" }))
    return entry
  }
  return entry
}

function validateNode(node: AuthoredNode, contract: ExecutableContract, capabilities: ReadonlySet<string>, errors: ValidationError[]) {
  if (node.kind !== "component") {
    for (const child of node.kind === "text" ? [] : node.children) validateNode(child, contract, capabilities, errors)
    return
  }

  const entry = validateExport(node, contract, errors)
  if (!entry?.component) {
    for (const child of node.children) validateNode(child, contract, capabilities, errors)
    return
  }
  for (const unresolved of entry.unresolved) {
    errors.push(error("UNRESOLVED_FACT", `Factual contract for ${node.familyId}.${node.exportName} is unresolved: ${unresolved.topic}.`, nodeTarget(node)))
  }
  const component = entry.component
  for (const capability of component.composition.requires) {
    if (!capabilities.has(capability)) errors.push(error("CAPABILITY_VIOLATION", `Component ${node.familyId}.${node.exportName} requires capability ${capability} from an ancestor.`, nodeTarget(node), { kind: "capability", capability }))
  }
  for (const constraint of component.composition.hardConstraints) {
    errors.push(error(
      "UNSUPPORTED_HARD_CONSTRAINT",
      `Hard constraint ${constraint} on ${node.familyId}.${node.exportName} has no executable validator semantics.`,
      nodeTarget(node),
      { kind: "unsupported-hard-constraint", constraint },
      constraint,
    ))
  }

  const branch = branchFor(component, node, errors)
  validateProps(node, component, branch, errors)
  validateSlot(node, component, errors)

  const childCapabilities = new Set(capabilities)
  for (const capability of component.composition.provides) childCapabilities.add(capability)
  for (const child of node.children) validateNode(child, contract, childCapabilities, errors)
}

export function validateAuthoredUi(input: AuthoredUi, contract: ExecutableContract): ValidationResult {
  const errors: ValidationError[] = []
  validateNode(input.root, contract, new Set(), errors)
  for (const token of input.tokenUses ?? []) {
    if (!contract.tokenIds.includes(token.tokenId)) {
      errors.push(error("INVALID_TOKEN", `Token ${token.tokenId} is not in the approved token vocabulary.`, tokenTarget(token.tokenId, token.location), { kind: "token" }, token.tokenId))
    }
  }
  errors.sort((left, right) => compareText(left.target.location.path, right.target.location.path) || compareText(left.code, right.code) || compareText(left.message, right.message))
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) })
}

export type { ValidationError, ValidationResult } from "./errors"
