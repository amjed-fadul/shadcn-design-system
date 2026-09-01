import { loadComponentContracts } from "./loader"
import type { DeepReadonly, LoadedComponentContracts } from "./loader"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract, PublicExportContract, TokenDependency } from "./types"

export type ComponentContractQueryErrorCode =
  | "COMPONENT_FAMILY_NOT_CONTRACTED"
  | "COMPONENT_EXPORT_NOT_CONTRACTED"
  | "INHERITED_INTERFACE_NOT_CONTRACTED"
  | "COMPONENT_CAPABILITY_NOT_CONTRACTED"
  | "COMPONENT_TOKEN_NOT_CONTRACTED"

export class ComponentContractQueryError extends Error {
  constructor(readonly code: ComponentContractQueryErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.name = "ComponentContractQueryError"
  }
}

export type ComponentCapabilityMatch = Readonly<{
  familyId: string
  exportName: string
  relation: "requires" | "provides"
}>

export type ComponentTokenDependencyMatch = Readonly<{
  familyId: string
  exportName: string
  dependency: DeepReadonly<TokenDependency>
}>

type ExportReference = { familyId: string; exportName: string }
type QueryIndexes = {
  familiesById: Map<string, DeepReadonly<ComponentFamilyContract>>
  exportsByQualifiedName: Map<string, DeepReadonly<PublicExportContract>>
  exportsByName: Map<string, ExportReference[]>
  interfacesById: Map<string, DeepReadonly<InheritedInterfaceContract>>
  capabilities: Map<string, ComponentCapabilityMatch[]>
  tokens: Map<string, ComponentTokenDependencyMatch[]>
  families: DeepReadonly<ComponentFamilyContract>[]
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function qualified(familyId: string, exportName: string) {
  return `${familyId}\u0000${exportName}`
}

function freezeResult<T extends object>(value: T): T {
  return Object.freeze(value)
}

function freezeResults<T extends object>(values: T[]): readonly T[] {
  return Object.freeze(values.map(freezeResult))
}

function addUnique<T>(map: Map<string, T[]>, key: string, value: T, identity: (candidate: T) => string) {
  const values = map.get(key) ?? []
  const valueIdentity = identity(value)
  if (values.some((candidate) => identity(candidate) === valueIdentity)) throw new Error(`Duplicate index entry: ${key}.`)
  values.push(value)
  map.set(key, values)
}

function buildIndexes(loaded: LoadedComponentContracts): QueryIndexes {
  const indexes: QueryIndexes = {
    familiesById: new Map(),
    exportsByQualifiedName: new Map(),
    exportsByName: new Map(),
    interfacesById: new Map(),
    capabilities: new Map(),
    tokens: new Map(),
    families: [...loaded.families].sort((left, right) => compareText(left.id, right.id)),
  }

  for (const family of indexes.families) {
    if (indexes.familiesById.has(family.id)) throw new Error(`Duplicate family index entry: ${family.id}.`)
    indexes.familiesById.set(family.id, family)
    for (const entry of family.exports) {
      const qualifiedName = qualified(family.id, entry.name)
      if (indexes.exportsByQualifiedName.has(qualifiedName)) throw new Error(`Duplicate export index entry: ${family.id}.${entry.name}.`)
      indexes.exportsByQualifiedName.set(qualifiedName, entry)
      addUnique(indexes.exportsByName, entry.name, { familyId: family.id, exportName: entry.name }, (candidate) => qualified(candidate.familyId, candidate.exportName))

      for (const relation of ["requires", "provides"] as const) {
        for (const capability of entry.component?.composition[relation] ?? []) {
          addUnique(indexes.capabilities, capability, { familyId: family.id, exportName: entry.name, relation }, (candidate) => `${qualified(candidate.familyId, candidate.exportName)}\u0000${candidate.relation}`)
        }
      }

      for (const dependency of entry.component?.tokenDependencies ?? []) {
        addUnique(indexes.tokens, dependency.tokenId, { familyId: family.id, exportName: entry.name, dependency }, (candidate) => `${qualified(candidate.familyId, candidate.exportName)}\u0000${JSON.stringify(candidate.dependency)}`)
      }
    }
  }

  for (const contract of loaded.interfaces) {
    if (indexes.interfacesById.has(contract.id)) throw new Error(`Duplicate inherited-interface index entry: ${contract.id}.`)
    indexes.interfacesById.set(contract.id, contract)
  }
  for (const values of indexes.exportsByName.values()) values.sort((left, right) => compareText(left.familyId, right.familyId) || compareText(left.exportName, right.exportName))
  for (const values of indexes.capabilities.values()) values.sort((left, right) => compareText(left.familyId, right.familyId) || compareText(left.exportName, right.exportName) || compareText(left.relation, right.relation))
  for (const values of indexes.tokens.values()) values.sort((left, right) => compareText(left.familyId, right.familyId) || compareText(left.exportName, right.exportName) || compareText(JSON.stringify(left.dependency), JSON.stringify(right.dependency)))
  return indexes
}

const loaded = loadComponentContracts()
const indexes = buildIndexes(loaded)

export function getComponentContractSet(): DeepReadonly<ComponentContractSet> {
  return loaded.contractSet
}

export function listComponentFamilies(): readonly DeepReadonly<ComponentFamilyContract>[] {
  return Object.freeze([...indexes.families])
}

export function getComponentFamily(familyId: string): DeepReadonly<ComponentFamilyContract> {
  const family = indexes.familiesById.get(familyId)
  if (!family) throw new ComponentContractQueryError("COMPONENT_FAMILY_NOT_CONTRACTED", `Family is not contracted: ${familyId}.`)
  return family
}

export function lookupComponentExport(familyId: string, exportName: string): DeepReadonly<PublicExportContract> {
  getComponentFamily(familyId)
  const entry = indexes.exportsByQualifiedName.get(qualified(familyId, exportName))
  if (!entry) throw new ComponentContractQueryError("COMPONENT_EXPORT_NOT_CONTRACTED", `Export is not contracted: ${familyId}.${exportName}.`)
  return entry
}

export function getInheritedInterface(interfaceId: string): DeepReadonly<InheritedInterfaceContract> {
  const contract = indexes.interfacesById.get(interfaceId)
  if (!contract) throw new ComponentContractQueryError("INHERITED_INTERFACE_NOT_CONTRACTED", `Inherited interface is not contracted: ${interfaceId}.`)
  return contract
}

export function isAuthorableJsxExport(familyId: string, exportName: string) {
  const entry = lookupComponentExport(familyId, exportName)
  return entry.kind === "component" && entry.authorableJsx
}

export function queryComponentCapabilities(capability: string): readonly ComponentCapabilityMatch[] {
  const matches = indexes.capabilities.get(capability)
  if (!matches) throw new ComponentContractQueryError("COMPONENT_CAPABILITY_NOT_CONTRACTED", `Capability is not contracted: ${capability}.`)
  return freezeResults(matches.map((match) => ({ ...match })))
}

export function queryComponentTokenDependencies(tokenId: string): readonly ComponentTokenDependencyMatch[] {
  const matches = indexes.tokens.get(tokenId)
  if (!matches) throw new ComponentContractQueryError("COMPONENT_TOKEN_NOT_CONTRACTED", `Token has no contracted component dependencies: ${tokenId}.`)
  return freezeResults(matches.map((match) => ({ ...match })))
}
