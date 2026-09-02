export {
  createKnowledgeLoader,
  KnowledgeLoadError,
} from "./loader"
export type {
  KnowledgeArtifactSource,
  KnowledgeLoadErrorCode,
  KnowledgeLoaderOptions,
} from "./loader"
export {
  createKnowledgeQuery,
  KnowledgeQueryError,
} from "./query"
export type {
  KnowledgeQuery,
  KnowledgeQueryErrorCode,
} from "./query"
export type {
  ComponentKnowledge,
  DeepReadonly,
  GuidanceClaim,
  GuidanceFields,
  GuidanceStatus,
  GuidanceTopic,
  KnowledgeArtifact,
  KnowledgeReference,
  KnowledgeReferenceKind,
  KnowledgeReferenceSet,
  KnowledgeSet,
  KnowledgeSubject,
  LoadedKnowledge,
  PatternKnowledge,
  PatternRole,
  RelatedGuidance,
} from "./types"
export { loadKnowledge } from "./canonical-loader"
export {
  getComponentKnowledge,
  getPatternKnowledge,
  listComponentKnowledge,
  listPatternKnowledge,
} from "./canonical-query"
