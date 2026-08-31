export type ComponentExportKind = "component" | "hook" | "helper"
export type EvidenceKind = "canonical-source" | "inherited-interface" | "runtime-test" | "token-contract"

export type StructuredPropType =
  | { kind: "boolean" }
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "enum"; values: string[] }
  | { kind: "typescript"; typeText: string }

export type Evidence = { kind: EvidenceKind; source: string }
export type EvidenceRef = { evidenceRefs: string[] }
export type LocalPropContract = EvidenceRef & { name: string; required: boolean; type: StructuredPropType; typeText?: string; default?: string | number | boolean | null }
export type SlotContract = EvidenceRef & { propName: string; default: boolean; replacesHost: boolean; childCardinality: { min: number; max: number }; forwardsProps: boolean; childRequires: string[]; refForwarding: "supported" | "required" | "unresolved" }
export type CompositionContract = { requires: string[]; provides: string[]; hardConstraints: string[] }
export type StateChannel = EvidenceRef & { name: string; propName: string }
export type ConditionalApiCase = EvidenceRef & { propName: string; equals: string | boolean; effects: string[] }
export type EventContract = EvidenceRef & { propName: string }
export type TokenDependency = EvidenceRef & { tokenId: string; when?: { propName: string; equals: string | boolean }; viaDerivedRule?: { id: string; multiplier: number } }
export type RenderingFact = { defaultHost: EvidenceRef & { kind: "intrinsic" | "component"; name: string }; dataAttributes: Array<EvidenceRef & { name: string; value?: string; sourceProp?: string }>; portals: EvidenceRef & { value: boolean }; automaticStructure: Array<EvidenceRef & { exportName: string }> }
export type AccessibilityFact = EvidenceRef & { feature: string; owner: "native" | "author" | "component"; mechanism: string }
export type ComponentDefinition = { localProps: LocalPropContract[]; inherits: string[]; slots: SlotContract[]; composition: CompositionContract; stateChannels: StateChannel[]; conditionalApi: ConditionalApiCase[]; events: EventContract[]; tokenDependencies: TokenDependency[]; rendering: RenderingFact; accessibility: AccessibilityFact[] }
export type PublicExportContract = EvidenceRef & { name: string; kind: ComponentExportKind; authorableJsx: boolean; component?: ComponentDefinition }
export type UnresolvedFact = EvidenceRef & { topic: string; scope: string; reason: string; evidenceAttempted: string[] }
export type ComponentFamilyContract = { schemaVersion: 1; id: string; source: { canonicalPath: string; canonicalBlobSha: string; implementationKind: string; upstreamPath?: string; upstreamBlobSha?: string }; evidence: Record<string, Evidence>; exports: PublicExportContract[]; unresolved: UnresolvedFact[] }
export type InheritedInterfaceProp = EvidenceRef & { name: string; required: boolean; type: StructuredPropType; typeText: string }
export type InheritedInterfaceContract = { schemaVersion: 1; id: string; source: { kind: "react-intrinsic" | "package-declaration"; package: string; version: string; declarationPath: string; declarationSha256: string; symbol: string }; evidence: Record<string, Evidence>; props: InheritedInterfaceProp[]; unresolved: UnresolvedFact[] }
export type ComponentContractSet = { schemaVersion: 1; id: string; status: "candidate" | "approved"; designSystemId: string; sourceBaselineCommit: string; tokenContractId: string; familyCount: number; familyFiles: string[]; interfaceFiles: string[] }
export type ComponentInvariantAuthority = { interfaceIds: Set<string>; interfacePropNames: Map<string, Set<string>>; tokenIds: Set<string>; derivedTokenRuleIds: Set<string>; sourceIdentity?: { canonicalPath: string; canonicalBlobSha: string } }
