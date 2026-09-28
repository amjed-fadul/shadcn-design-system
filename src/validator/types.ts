import type { LoadedComponentContracts } from "../contracts/components/loader"
import type {
  ComponentContractSet,
  ComponentDefinition,
  ComponentFamilyContract,
  CompositionContract,
  ConditionalApiCondition,
  ConditionalApiCase,
  EventContract,
  RenderCondition,
  SlotContract,
  StateChannel,
  StructuredPropType,
  TokenDependency,
  UnresolvedFact,
} from "../contracts/components/types"
import type { TokenContract } from "../contracts/tokens/types"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type SourceLocation = Readonly<{
  path: string
  line?: number
  column?: number
}>

export type AuthoredValue =
  | Readonly<{ kind: "literal"; value: JsonValue }>
  | Readonly<{ kind: "callback"; signature?: string; parameterType?: StructuredPropType }>
  | Readonly<{ kind: "expression"; expression: string }>

export type AuthoredNode =
  | Readonly<{
      kind: "component"
      id: string
      familyId: string
      exportName: string
      props: Readonly<Record<string, AuthoredValue>>
      children: readonly AuthoredNode[]
      location: SourceLocation
    }>
  | Readonly<{
      kind: "intrinsic"
      id: string
      tag: string
      children: readonly AuthoredNode[]
      location: SourceLocation
    }>
  | Readonly<{
      kind: "text"
      id: string
      value: string
      location: SourceLocation
    }>

export type AuthoredTokenUse = Readonly<{
  tokenId: string
  viaDerivedRule?: Readonly<{ id: string; parameter: AuthoredValue }>
  nodeId?: string
  location: SourceLocation
}>

export type AuthoredUi = Readonly<{
  root: AuthoredNode
  tokenUses?: readonly AuthoredTokenUse[]
}>

export type ExecutableProp = Readonly<
  | {
      name: string
      availability: "available"
      required: boolean
      type: StructuredPropType
      origin: "local" | "inherited" | "conditional"
      default?: JsonPrimitive
    }
  | {
      name: string
      availability: "unavailable"
      origin: "conditional"
    }
>

export type ExecutableEvent = Readonly<{
  propName: string
  required: boolean
  payload?: StructuredPropType
  origin: "local" | "inherited"
}>

export type ExecutableDerivedTokenRule = Readonly<{
  id: string
  baseTokenId: string
  parameter: Readonly<{ name: string; type: string; minimum?: number }>
}>

export type ExecutableApiShape = Readonly<{
  props: readonly ExecutableProp[]
  events: readonly ExecutableEvent[]
  stateChannels: readonly StateChannel[]
}>

export type ExecutableConditionalApi = Readonly<{
  when: Readonly<ConditionalApiCondition>
  shape: ExecutableApiShape
}>

export type ExecutableComponent = Readonly<{
  props: readonly ExecutableProp[]
  events: readonly ExecutableEvent[]
  stateChannels: readonly StateChannel[]
  conditionalApi: readonly ExecutableConditionalApi[]
  slots: readonly SlotContract[]
  composition: CompositionContract
  tokenDependencies: readonly TokenDependency[]
  unresolved: readonly UnresolvedFact[]
}>

export type ExecutableExport = Readonly<{
  familyId: string
  name: string
  kind: "component" | "hook" | "helper"
  authorableJsx: boolean
  component?: ExecutableComponent
  unresolved: readonly UnresolvedFact[]
}>

export type ExecutableContract = Readonly<{
  schemaVersion: 1
  componentContractSetId: string
  componentContractStatus: ComponentContractSet["status"]
  tokenContractId: string
  sourceBaselineCommit: string
  tokenSourceBaselineCommit: string
  exports: Readonly<Record<string, ExecutableExport>>
  tokenIds: readonly string[]
  derivedTokenRules: readonly ExecutableDerivedTokenRule[]
  derivedTokenRuleIds: readonly string[]
  capabilityIds: readonly string[]
}>

export type ImplementationInput = Readonly<{ path: string; gitBlob: string | null; sha256: string }>
export type PackageIdentity = Readonly<{
  name: string
  version: string
  publicEntrypoints: Readonly<Record<string, string | Readonly<Record<string, string>>>>
}>

export type ExecutableReleasePayload = Readonly<{
  documentSchemaVersion: 1
  packageIdentity: PackageIdentity | null
  implementationInputs: readonly ImplementationInput[]
  releaseId: string
  projectionSchemaVersion: 1
  componentContractSetId: string
  tokenContractId: string
  sourceBaselines: Readonly<{
    componentContract: string
    tokenContract: string
  }>
  projection: ExecutableContract
}>

export type ExecutableRelease = Readonly<ExecutableReleasePayload & {
  sha256: string
}>

export type ExecutableContractSource = Readonly<{
  componentContracts: LoadedComponentContracts
  tokenContract: ExecutableTokenContractAuthority
}>

/** The narrow Phase 2 facts the projection consumes; it stays generic over DS token IDs. */
export type ExecutableTokenContractAuthority = Readonly<Pick<TokenContract, "sourceBaselineCommit"> & {
  id: string
  status: "candidate" | "approved"
  tokens: readonly Readonly<{ id: string }>[]
  derivedRules: readonly ExecutableDerivedTokenRule[]
}>

export type ProjectionErrorCode =
  | "EXECUTABLE_CONTRACT_NOT_APPROVED"
  | "EXECUTABLE_TOKEN_CONTRACT_NOT_APPROVED"
  | "EXECUTABLE_TOKEN_CONTRACT_MISMATCH"
  | "EXECUTABLE_PROJECTION_UNRESOLVED"

export class ExecutableContractProjectionError extends Error {
  constructor(readonly code: ProjectionErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.name = "ExecutableContractProjectionError"
  }
}

export type ContractComponentSource = Readonly<{
  family: ComponentFamilyContract
  component: ComponentDefinition
  exportName: string
}>

export type ProjectedRenderCondition = RenderCondition
export type ProjectedConditionalCase = ConditionalApiCase
