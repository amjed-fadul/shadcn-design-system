export type ComponentExportKind = "component" | "hook" | "helper"
export type EvidenceKind = "canonical-source" | "inherited-interface" | "runtime-test" | "token-contract"
type AtLeastTwo<T> = [T, T, ...T[]]
type AtLeastOne<T> = [T, ...T[]]

export type StructuredPropType =
  | { kind: "boolean" }
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "enum"; values: string[] }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "array"; item: StructuredPropType }
  | { kind: "union"; members: AtLeastTwo<StructuredPropType> }
  | { kind: "typescript"; typeText: string }

export type Evidence = { kind: EvidenceKind; source: string }
export type EvidenceRef = { evidenceRefs: string[] }
export type LocalPropContract = EvidenceRef & { name: string; required: boolean; type: StructuredPropType; typeText?: string; default?: string | number | boolean | null }
export type SlotContract = EvidenceRef & { propName: string; default: boolean; replacesHost: boolean; childCardinality: { min: number; max: number }; forwardsProps: boolean; childRequires: string[]; refForwarding: "supported" | "required" | "unresolved" }
export type CompositionContract = { requires: string[]; provides: string[]; hardConstraints: string[] }
export type StateChannel = EvidenceRef & { name: string; controlledProp?: string; defaultProp?: string; changeEventProp?: string } & ({ controlledProp: string } | { defaultProp: string } | { changeEventProp: string })
export type ConditionalPropRefinement = EvidenceRef & ({ propName: string; availability: "available"; required: boolean; type: StructuredPropType } | { propName: string; availability: "unavailable" })
export type ConditionalEventRefinement = EvidenceRef & { eventPropName: string; payload: StructuredPropType }
export type ConditionalApiCase = EvidenceRef & { when: { propName: string; equals: string | number | boolean }; propRefinements: ConditionalPropRefinement[]; eventRefinements: ConditionalEventRefinement[]; stateChannels: StateChannel[] }
export type EventContract = EvidenceRef & { propName: string; payload?: StructuredPropType }
export type TokenConditionRelationshipSegment =
  | { kind: "has" | "in"; name?: never }
  | { kind: "group" | "peer"; name?: string }
export type TokenConditionPathSegment = { kind: "self"; name?: never } | TokenConditionRelationshipSegment
export type TokenConditionPath = [{ kind: "self"; name?: never }] | AtLeastOne<TokenConditionRelationshipSegment>
export type TokenConditionAtom = (
  | { subject?: never; path?: never }
  | { subject: "data" | "aria"; path: TokenConditionPath }
) & { propName: string; equals: string | number | boolean; all?: never }
export type TokenCondition = TokenConditionAtom | { all: AtLeastTwo<TokenConditionAtom>; propName?: never; equals?: never }
export type TokenDependency = EvidenceRef & { tokenId: string; when?: TokenCondition; viaDerivedRule?: { id: string; multiplier: number } }
export type RenderHost =
  | { kind: "intrinsic"; tag: string }
  | { kind: "inherited-interface"; interfaceId: string }
  | { kind: "component-export"; exportName: string }
  | { kind: "cross-family-export"; familyId: string; exportName: string }
  | { kind: "fragment" }
  | { kind: "unresolved" }
export type RenderAtomicCondition =
  | { propName: string; equals: string | number | boolean }
  | { propName: string; truthiness: "truthy" | "falsy" }
  | { propName: string; nullishness: "nullish" | "non-nullish" }
  | { source: "state"; name: string; equals: string | number | boolean }
  | { source: "state"; name: string; truthiness: "truthy" | "falsy" }
  | { source: "state"; name: string; nullishness: "nullish" | "non-nullish" }
export type RenderCondition = RenderAtomicCondition | { all: AtLeastTwo<RenderCondition> }
export type RenderValue = { source: "literal"; value: string | number | boolean } | { source: "prop" | "state"; name: string }
export type RenderChildRef = EvidenceRef & { nodeId: string; when?: RenderCondition }
export type RenderDataAttribute = EvidenceRef & { name: string; value?: string; prop?: string; condition?: RenderCondition } & (
  | { source: "literal" }
  | { source: "prop"; prop: string }
  | { source: "primitive-state" }
  | { source: "derived-condition"; condition: RenderCondition }
  | { source: "conditional-value"; condition: RenderCondition; whenTrue: RenderValue; whenFalse: RenderValue }
)
export type DerivedRenderSpread = EvidenceRef & { source: "prop" | "state"; name: string }
export type RenderNode = { id: string; host: RenderHost; receivesPublicProps: boolean; dataAttributes: RenderDataAttribute[]; derivedSpreads?: DerivedRenderSpread[]; children: RenderChildRef[]; evidenceRefs: string[] }
export type PortalBoundary = EvidenceRef & { nodeId: string }
export type RenderingTree = { rootNodeId: string; publicPropsTargetNodeId: string; nodes: RenderNode[]; portalBoundaries: PortalBoundary[] }
export type RenderingAlternative = EvidenceRef & ({ when: RenderCondition; otherwise?: never } | { otherwise: true; when?: never }) & { rendering: RenderingTree }
export type RenderingFact = RenderingTree | { alternatives: RenderingAlternative[] }
export function isRenderingTree(rendering: RenderingFact): rendering is RenderingTree { return "nodes" in rendering }
export type InheritedPropDefault = EvidenceRef & { propName: string; value: string | number | boolean | null }
export type AccessibilityFact = EvidenceRef & { feature: string; owner: "native" | "author" | "component"; mechanism: string }
export type ComponentDefinition = { localProps: LocalPropContract[]; inherits: string[]; slots: SlotContract[]; inheritedPropDefaults: InheritedPropDefault[]; composition: CompositionContract; stateChannels: StateChannel[]; conditionalApi: ConditionalApiCase[]; events: EventContract[]; tokenDependencies: TokenDependency[]; rendering: RenderingFact; accessibility: AccessibilityFact[] }
export type EffectivePublicProp = { name: string; availability: "available"; required: boolean; type: StructuredPropType } | { name: string; availability: "unavailable" }
export type EffectiveComponentApiShape = { props: EffectivePublicProp[]; events: EventContract[] }
export type PublicExportContract = EvidenceRef & { name: string; kind: ComponentExportKind; authorableJsx: boolean; component?: ComponentDefinition }
export type SourceExpressionIdentity = { sourcePath: string; start: number; end: number; expressionKind: string; sourceText: string }
export type UnresolvedFact = EvidenceRef & { topic: string; scope: string; reason: string; source?: SourceExpressionIdentity; evidenceAttempted: string[] }
export type ComponentFamilyContract = { schemaVersion: 1; id: string; source: { canonicalPath: string; canonicalBlobSha: string; implementationKind: string; upstreamPath?: string; upstreamBlobSha?: string }; evidence: Record<string, Evidence>; exports: PublicExportContract[]; unresolved: UnresolvedFact[] }
export type InheritedInterfaceProp = EvidenceRef & { name: string; required: boolean; type: StructuredPropType; typeText: string }
export type InheritedInterfaceEvent = EvidenceRef & { propName: string; required: boolean; payload: StructuredPropType; payloadTypeText: string }
export type InheritedInterfaceContract = { schemaVersion: 1; id: string; source: { kind: "react-intrinsic" | "package-declaration"; package: string; version: string; declarationPath: string; declarationSha256: string; symbol: string }; evidence: Record<string, Evidence>; props: InheritedInterfaceProp[]; events?: InheritedInterfaceEvent[]; conditionalApi?: ConditionalApiCase[]; unresolved: UnresolvedFact[] }
export type ComponentContractSet = { schemaVersion: 1; id: string; status: "candidate" | "approved"; designSystemId: string; sourceBaselineCommit: string; tokenContractId: string; familyCount: number; familyFiles: string[]; interfaceFiles: string[] }
export type ComponentInvariantAuthority = { interfaceIds: Set<string>; interfacePropNames: Map<string, Set<string>>; interfaceContracts: Map<string, InheritedInterfaceContract>; tokenIds: Set<string>; derivedTokenRuleIds: Set<string>; capabilityIds: Set<string>; componentExportIds?: Set<string>; sourceIdentity?: { canonicalPath: string; canonicalBlobSha: string } }
