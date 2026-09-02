export type KnowledgeSubject = {
  kind: "component" | "pattern"
  id: string
}

export type KnowledgeReferenceKind = "official-documentation" | "official-standard" | "canonical-source"

export type KnowledgeReference = {
  id: string
  kind: KnowledgeReferenceKind
  title: string
  locator: string
  locatorHint: string
  accessedOn: string
  sourceRevision?: string
  contentHash?: string
}

export type KnowledgeReferenceSet = {
  schemaVersion: 1
  references: KnowledgeReference[]
}

export type GuidanceStatus = "available" | "unresolved"

export type GuidanceTopic =
  | "purpose"
  | "whatItIs"
  | "whenToUse"
  | "whenNotToUse"
  | "howToUse"
  | "options"
  | "writing"
  | "useInstead"
  | "related"

export type GuidanceClaim = {
  statement: string
  basis:
    | { kind: "source-derived"; referenceIds: string[] }
    | { kind: "ds-owner-authored"; authoredBy: string; revision: string; date: string }
}

export type RelatedGuidance = {
  target: KnowledgeSubject
  guidance: GuidanceClaim
}

export type PatternRole = {
  subject: KnowledgeSubject
  role: string
  guidance?: GuidanceClaim
}

export type GuidanceFields = {
  guidanceStatus: Partial<Record<GuidanceTopic, GuidanceStatus>>
  whatItIs?: GuidanceClaim
  whenToUse?: GuidanceClaim[]
  whenNotToUse?: GuidanceClaim[]
  howToUse?: GuidanceClaim[]
  options?: GuidanceClaim[]
  writing?: GuidanceClaim[]
  useInstead?: RelatedGuidance[]
  related?: RelatedGuidance[]
}

export type ComponentKnowledge = {
  schemaVersion: 1
  id: string
  subject: { kind: "component"; id: string }
} & GuidanceFields

export type PatternKnowledge = {
  schemaVersion: 1
  id: string
  subject: { kind: "pattern"; id: string }
  guidanceStatus: Partial<Record<GuidanceTopic, GuidanceStatus>>
  purpose?: GuidanceClaim
  whatItIs?: GuidanceClaim
  whenToUse?: GuidanceClaim[]
  whenNotToUse?: GuidanceClaim[]
  howToUse?: GuidanceClaim[]
  options?: GuidanceClaim[]
  writing?: GuidanceClaim[]
  useInstead?: RelatedGuidance[]
  related?: RelatedGuidance[]
  roles?: PatternRole[]
}

export type KnowledgeArtifact = ComponentKnowledge | PatternKnowledge

export type KnowledgeSet = {
  schemaVersion: 1
  id: string
  referenceFile: string
  componentFiles: string[]
  patternFiles: string[]
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

export type LoadedKnowledge = DeepReadonly<{
  set: KnowledgeSet
  references: KnowledgeReferenceSet
  components: ComponentKnowledge[]
  patterns: PatternKnowledge[]
}>
