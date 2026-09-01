import Ajv2020, { type ValidateFunction } from "ajv/dist/2020"

import contractSetSchema from "../../../contracts/components/component-contract-set.schema.json"
import familySchema from "../../../contracts/components/component-family.schema.json"
import interfaceSchema from "../../../contracts/components/inherited-interface.schema.json"
import { validateComponentContractSetInvariants, validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "./invariants"
import { reconcileSourceAnalyzerErrors } from "./source-reconciliation"
import type { ComponentContractSet, ComponentFamilyContract, ComponentInvariantAuthority, InheritedInterfaceContract } from "./types"

const contractSetPath = "contracts/components/component-contract-set.json"
const indexPath = "contracts/components/index.json"

export type ComponentContractArtifactSource = {
  readJson(path: string): unknown
}

export type ComponentContractIndexFamily = {
  familyId: string
  components: string[]
  hooks: string[]
  helpers: string[]
}

export type ComponentContractIndex = {
  schemaVersion: 1
  contractSetId: string
  familyCount: number
  families: ComponentContractIndexFamily[]
}

export type ComponentContractSourceReconciliationContext = Readonly<{
  contractSet: ComponentContractSet
  families: readonly ComponentFamilyContract[]
  interfaces: readonly InheritedInterfaceContract[]
}>

export type ComponentContractSourceReconciler = (context: ComponentContractSourceReconciliationContext) => readonly string[]

export type ComponentContractLoaderOptions = Readonly<{
  source: ComponentContractArtifactSource
  contractSetPath?: string
  indexPath?: string
  tokenIds?: ReadonlySet<string>
  derivedTokenRuleIds?: ReadonlySet<string>
  capabilityIds?: ReadonlySet<string>
  sourceReconciler?: ComponentContractSourceReconciler
  contractSetReconciler?: (contractSet: ComponentContractSet) => readonly string[]
  sourceIdentityForFamily?: (familyId: string) => ComponentInvariantAuthority["sourceIdentity"] | undefined
  requireSourceIdentity?: boolean
}>

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export type LoadedComponentContracts = DeepReadonly<{
  contractSet: ComponentContractSet
  families: ComponentFamilyContract[]
  interfaces: InheritedInterfaceContract[]
}>

export type ComponentContractLoadErrorCode =
  | "COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND"
  | "COMPONENT_CONTRACT_ARTIFACT_INVALID"
  | "COMPONENT_CONTRACT_SCHEMA_INVALID"
  | "COMPONENT_CONTRACT_INDEX_DRIFT"

export class ComponentContractLoadError extends Error {
  constructor(
    readonly code: ComponentContractLoadErrorCode,
    message: string,
    readonly artifactPath?: string,
  ) {
    super(`[${code}] ${message}`)
    this.name = "ComponentContractLoadError"
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object") return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  for (const key of Reflect.ownKeys(object)) deepFreeze((object as Record<PropertyKey, unknown>)[key], seen)
  return Object.freeze(value)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, stableValue(child)]))
}

function readArtifact(source: ComponentContractArtifactSource, path: string): unknown {
  try {
    const value = source.readJson(path)
    if (value === undefined) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND", `Missing contract artifact: ${path}.`, path)
    return value
  } catch (error) {
    if (error instanceof ComponentContractLoadError) throw error
    throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_NOT_FOUND", `Unable to read contract artifact: ${path}. ${String(error)}`, path)
  }
}

function schemaDocument<T>(source: ComponentContractArtifactSource, path: string, validate: ValidateFunction<unknown>): T {
  const document = readArtifact(source, path)
  if (!validate(document)) throw new ComponentContractLoadError("COMPONENT_CONTRACT_SCHEMA_INVALID", `Schema validation failed for ${path}: ${JSON.stringify(validate.errors ?? [])}`, path)
  return document as T
}

function invariantDocumentErrors(document: ComponentContractSet | ComponentFamilyContract | InheritedInterfaceContract, authority?: ComponentInvariantAuthority): string[] {
  try {
    if ("familyFiles" in document) return validateComponentContractSetInvariants(document)
    if ("exports" in document) return validateComponentFamilyInvariants(document, authority!)
    return validateInheritedInterfaceInvariants(document)
  } catch (error) {
    return [String(error)]
  }
}

function rejectInvariantErrors(path: string, errors: string[]) {
  if (errors.length > 0) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `Invariant validation failed for ${path}: ${errors.join(" ")}`, path)
}

function requireUnique(values: string[], label: string, path: string) {
  if (new Set(values).size !== values.length) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `${label} contains duplicate entries.`, path)
}

function requireManifestPaths(paths: string[], directory: "families" | "interfaces", manifestPath: string) {
  const prefix = `contracts/components/${directory}/`
  for (const path of paths) {
    if (!path.startsWith(prefix) || !path.endsWith(".json") || path.includes("..")) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `Manifest contains an invalid ${directory.slice(0, -1)} path: ${path}.`, manifestPath)
  }
}

function expectedIndex(contractSet: ComponentContractSet, families: ComponentFamilyContract[]): ComponentContractIndex {
  return {
    schemaVersion: 1,
    contractSetId: contractSet.id,
    familyCount: families.length,
    families: families
      .map((family) => ({
        familyId: family.id,
        components: family.exports.filter((entry) => entry.kind === "component").map((entry) => entry.name).sort(),
        hooks: family.exports.filter((entry) => entry.kind === "hook").map((entry) => entry.name).sort(),
        helpers: family.exports.filter((entry) => entry.kind === "helper").map((entry) => entry.name).sort(),
      }))
      .sort((left, right) => left.familyId < right.familyId ? -1 : left.familyId > right.familyId ? 1 : 0),
  }
}

function authorityFor(interfaces: InheritedInterfaceContract[], capabilityIds: Set<string>, tokenIds: ReadonlySet<string>, derivedTokenRuleIds: ReadonlySet<string>, sourceIdentity?: ComponentInvariantAuthority["sourceIdentity"]): ComponentInvariantAuthority {
  return {
    interfaceIds: new Set(interfaces.map((contract) => contract.id)),
    interfacePropNames: new Map(interfaces.map((contract) => [contract.id, new Set(contract.props.map((prop) => prop.name))])),
    interfaceContracts: new Map(interfaces.map((contract) => [contract.id, contract])),
    tokenIds: new Set(tokenIds),
    derivedTokenRuleIds: new Set(derivedTokenRuleIds),
    capabilityIds,
    sourceIdentity,
  }
}

function loadContracts({
  source,
  contractSetPath: configuredContractSetPath = contractSetPath,
  indexPath: configuredIndexPath = indexPath,
  tokenIds = new Set<string>(),
  derivedTokenRuleIds = new Set<string>(),
  capabilityIds: configuredCapabilityIds,
  sourceReconciler,
  contractSetReconciler,
  sourceIdentityForFamily,
  requireSourceIdentity = false,
}: ComponentContractLoaderOptions): LoadedComponentContracts {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validateSet = ajv.compile(contractSetSchema)
  const validateFamily = ajv.compile(familySchema)
  const validateInterface = ajv.compile(interfaceSchema)
  const contractSet = schemaDocument<ComponentContractSet>(source, configuredContractSetPath, validateSet)

  if (contractSet.familyCount !== contractSet.familyFiles.length) {
    throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", "Contract set familyCount must equal familyFiles length.", configuredContractSetPath)
  }
  rejectInvariantErrors(configuredContractSetPath, invariantDocumentErrors(contractSet))
  if (contractSet.status !== "candidate") throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", "Only candidate component contracts may be loaded.", configuredContractSetPath)
  rejectInvariantErrors(configuredContractSetPath, [...(contractSetReconciler?.(contractSet) ?? [])])
  requireUnique(contractSet.familyFiles, "Family manifest", configuredContractSetPath)
  requireUnique(contractSet.interfaceFiles, "Inherited-interface manifest", configuredContractSetPath)
  requireManifestPaths(contractSet.familyFiles, "families", configuredContractSetPath)
  requireManifestPaths(contractSet.interfaceFiles, "interfaces", configuredContractSetPath)

  const interfaces = contractSet.interfaceFiles.map((path) => schemaDocument<InheritedInterfaceContract>(source, path, validateInterface))
  requireUnique(interfaces.map((contract) => contract.id), "Inherited-interface IDs", configuredContractSetPath)
  for (const [index, contract] of interfaces.entries()) rejectInvariantErrors(contractSet.interfaceFiles[index], invariantDocumentErrors(contract))

  const families = contractSet.familyFiles.map((path) => schemaDocument<ComponentFamilyContract>(source, path, validateFamily))
  requireUnique(families.map((family) => family.id), "Family IDs", configuredContractSetPath)
  const capabilityIds = new Set(configuredCapabilityIds ?? [])
  for (const [index, family] of families.entries()) {
    const expectedId = contractSet.familyFiles[index].split("/").at(-1)!.replace(/\.json$/, "")
    if (family.id !== expectedId) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `Family ID ${family.id} does not match its manifest path ${contractSet.familyFiles[index]}.`, contractSet.familyFiles[index])
  }
  for (const [index, family] of families.entries()) {
    const sourceIdentity = sourceIdentityForFamily?.(family.id)
    if (requireSourceIdentity && !sourceIdentity) throw new ComponentContractLoadError("COMPONENT_CONTRACT_ARTIFACT_INVALID", `Family has no configured source provenance: ${family.id}.`, contractSet.familyFiles[index])
    rejectInvariantErrors(contractSet.familyFiles[index], invariantDocumentErrors(family, authorityFor(interfaces, capabilityIds, tokenIds, derivedTokenRuleIds, sourceIdentity)))
  }

  const sourceErrors = sourceReconciler?.({ contractSet, families, interfaces }) ?? []
  rejectInvariantErrors(configuredContractSetPath, reconcileSourceAnalyzerErrors("Component contract", sourceErrors))

  const actualIndex = readArtifact(source, configuredIndexPath)
  const derivedIndex = expectedIndex(contractSet, families)
  if (JSON.stringify(stableValue(actualIndex)) !== JSON.stringify(stableValue(derivedIndex))) throw new ComponentContractLoadError("COMPONENT_CONTRACT_INDEX_DRIFT", "Derived component index does not match the loaded family contracts.", configuredIndexPath)

  return deepFreeze({ contractSet, families, interfaces }) as LoadedComponentContracts
}

/** Builds a design-system-neutral immutable loader; source ownership is configured at the boundary. */
export function createComponentContractLoader(options: ComponentContractLoaderOptions): () => LoadedComponentContracts {
  return () => loadContracts(options)
}
