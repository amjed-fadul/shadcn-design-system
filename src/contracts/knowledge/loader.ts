import Ajv2020, { type ValidateFunction } from "ajv/dist/2020"

import componentSchema from "../../../contracts/knowledge/component-knowledge.schema.json"
import referenceSetSchema from "../../../contracts/knowledge/knowledge-reference-set.schema.json"
import setSchema from "../../../contracts/knowledge/knowledge-set.schema.json"
import patternSchema from "../../../contracts/knowledge/pattern-knowledge.schema.json"
import type {
  ComponentKnowledge,
  GuidanceClaim,
  KnowledgeArtifact,
  KnowledgeReference,
  KnowledgeReferenceSet,
  KnowledgeSet,
  LoadedKnowledge,
  PatternKnowledge,
} from "./types"

const defaultSetPath = "contracts/knowledge/knowledge-set.json"
const sourceControlledReferenceKinds = new Set(["canonical-source"])
const guidanceTopics = ["purpose", "whatItIs", "whenToUse", "whenNotToUse", "howToUse", "options", "writing", "useInstead", "related"] as const

export type KnowledgeArtifactSource = {
  readJson(path: string): unknown
}

export type KnowledgeLoaderOptions = Readonly<{
  source: KnowledgeArtifactSource
  setPath?: string
}>

export type KnowledgeLoadErrorCode =
  | "KNOWLEDGE_ARTIFACT_NOT_FOUND"
  | "KNOWLEDGE_SCHEMA_INVALID"
  | "KNOWLEDGE_ARTIFACT_INVALID"
  | "KNOWLEDGE_REFERENCE_NOT_FOUND"

export class KnowledgeLoadError extends Error {
  constructor(
    readonly code: KnowledgeLoadErrorCode,
    message: string,
    readonly artifactPath?: string,
  ) {
    super("[" + code + "] " + message)
    this.name = "KnowledgeLoadError"
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

function readArtifact(source: KnowledgeArtifactSource, path: string): unknown {
  try {
    const value = source.readJson(path)
    if (value === undefined) throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_NOT_FOUND", "Missing knowledge artifact: " + path + ".", path)
    return value
  } catch (error) {
    if (error instanceof KnowledgeLoadError) throw error
    throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_NOT_FOUND", "Unable to read knowledge artifact: " + path + ". " + String(error), path)
  }
}

function schemaDocument<T>(source: KnowledgeArtifactSource, path: string, validate: ValidateFunction<unknown>): T {
  const document = readArtifact(source, path)
  if (!validate(document)) {
    throw new KnowledgeLoadError("KNOWLEDGE_SCHEMA_INVALID", "Schema validation failed for " + path + ": " + JSON.stringify(validate.errors ?? []), path)
  }
  return document as T
}

function requireUnique(values: string[], label: string, path: string) {
  if (new Set(values).size !== values.length) {
    throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", label + " contains duplicate entries.", path)
  }
}

function requireKnowledgePath(path: string, kind: "reference" | "component" | "pattern", manifestPath: string) {
  const prefix = kind === "reference"
    ? "contracts/knowledge/"
    : "contracts/knowledge/" + kind + "s/"
  if (!path.startsWith(prefix) || !path.endsWith(".json") || path.includes("..") || path.includes("\\")) {
    throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Manifest contains an invalid " + kind + " path: " + path + ".", manifestPath)
  }
}

function claimTopicValue(artifact: KnowledgeArtifact, topic: typeof guidanceTopics[number]): unknown {
  return (artifact as unknown as Record<string, unknown>)[topic]
}

function claimFromGuidance(artifact: KnowledgeArtifact): GuidanceClaim[] {
  const claims: GuidanceClaim[] = []
  for (const topic of guidanceTopics) {
    const value = claimTopicValue(artifact, topic)
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (topic === "useInstead" || topic === "related") claims.push((entry as { guidance: GuidanceClaim }).guidance)
        else claims.push(entry as GuidanceClaim)
      }
    } else if (value) {
      claims.push(value as GuidanceClaim)
    }
  }
  for (const role of (artifact as PatternKnowledge).roles ?? []) if (role.guidance) claims.push(role.guidance)
  return claims
}

function validateGuidanceStatuses(artifact: KnowledgeArtifact, path: string) {
  const status = artifact.guidanceStatus as Record<string, string>
  for (const topic of guidanceTopics) {
    const value = claimTopicValue(artifact, topic)
    const hasGuidance = Array.isArray(value) ? value.length > 0 : value !== undefined
    if (hasGuidance && status[topic] !== "available") {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Guidance topic " + topic + " on " + artifact.subject.kind + ":" + artifact.subject.id + " must have status available.", path)
    }
    if (status[topic] === "available" && !hasGuidance) {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Guidance topic " + topic + " on " + artifact.subject.kind + ":" + artifact.subject.id + " is marked available without a claim.", path)
    }
    if (status[topic] === "unresolved" && hasGuidance) {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Unresolved guidance topic " + topic + " on " + artifact.subject.kind + ":" + artifact.subject.id + " cannot contain a claim.", path)
    }
  }
}

function validateReferenceRecords(references: KnowledgeReference[], path: string) {
  requireUnique(references.map((reference) => reference.id), "Knowledge reference IDs", path)
  for (const reference of references) {
    if (sourceControlledReferenceKinds.has(reference.kind) && (!reference.sourceRevision || !reference.contentHash)) {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Source-controlled reference " + reference.id + " requires sourceRevision and contentHash.", path)
    }
  }
}

function validateClaimReferences(artifacts: KnowledgeArtifact[], references: KnowledgeReference[], path: string) {
  const knownReferenceIds = new Set(references.map((reference) => reference.id))
  for (const artifact of artifacts) {
    validateGuidanceStatuses(artifact, path)
    for (const claim of claimFromGuidance(artifact)) {
      if (claim.basis.kind !== "source-derived") continue
      for (const referenceId of claim.basis.referenceIds) {
        if (!knownReferenceIds.has(referenceId)) {
          throw new KnowledgeLoadError("KNOWLEDGE_REFERENCE_NOT_FOUND", "Claim on " + artifact.subject.kind + ":" + artifact.subject.id + " references unknown evidence record: " + referenceId + ".", path)
        }
      }
    }
  }
}

function validateArtifactIdentity(artifacts: KnowledgeArtifact[], expectedKind: KnowledgeArtifact["subject"]["kind"], path: string) {
  for (const artifact of artifacts) {
    if (artifact.subject.kind !== expectedKind) {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_INVALID", "Artifact " + artifact.id + " has subject kind " + artifact.subject.kind + " but is listed as a " + expectedKind + " artifact.", path)
    }
  }
  requireUnique(artifacts.map((artifact) => artifact.id), expectedKind + " knowledge IDs", path)
  requireUnique(artifacts.map((artifact) => artifact.subject.id), expectedKind + " knowledge subject IDs", path)
}

function loadContracts({ source, setPath = defaultSetPath }: KnowledgeLoaderOptions): LoadedKnowledge {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validateSet = ajv.compile(setSchema)
  const validateReferenceDocument = ajv.compile(referenceSetSchema)
  const validateComponent = ajv.compile(componentSchema)
  const validatePattern = ajv.compile(patternSchema)
  const set = schemaDocument<KnowledgeSet>(source, setPath, validateSet)

  requireKnowledgePath(set.referenceFile, "reference", setPath)
  for (const path of set.componentFiles) requireKnowledgePath(path, "component", setPath)
  for (const path of set.patternFiles) requireKnowledgePath(path, "pattern", setPath)
  requireUnique(set.componentFiles, "Component knowledge manifest", setPath)
  requireUnique(set.patternFiles, "Pattern knowledge manifest", setPath)
  requireUnique([...set.componentFiles, ...set.patternFiles], "Knowledge manifest", setPath)

  const referenceDocument = schemaDocument<KnowledgeReferenceSet>(source, set.referenceFile, validateReferenceDocument)
  validateReferenceRecords(referenceDocument.references, set.referenceFile)
  const components = set.componentFiles.map((path) => schemaDocument<ComponentKnowledge>(source, path, validateComponent))
  const patterns = set.patternFiles.map((path) => schemaDocument<PatternKnowledge>(source, path, validatePattern))
  validateArtifactIdentity(components, "component", setPath)
  validateArtifactIdentity(patterns, "pattern", setPath)
  validateClaimReferences([...components, ...patterns], referenceDocument.references, setPath)

  return deepFreeze({
    set,
    references: referenceDocument,
    components,
    patterns,
  }) as LoadedKnowledge
}

export function createKnowledgeLoader(options: KnowledgeLoaderOptions): () => LoadedKnowledge {
  return () => loadContracts(options)
}
