import type { ComponentKnowledge, DeepReadonly, LoadedKnowledge, PatternKnowledge } from "./types"

export type KnowledgeQueryErrorCode = "COMPONENT_KNOWLEDGE_NOT_FOUND" | "PATTERN_KNOWLEDGE_NOT_FOUND"

export class KnowledgeQueryError extends Error {
  constructor(readonly code: KnowledgeQueryErrorCode, message: string) {
    super("[" + code + "] " + message)
    this.name = "KnowledgeQueryError"
  }
}

export type KnowledgeQuery = Readonly<{
  listComponentKnowledge(): readonly DeepReadonly<ComponentKnowledge>[]
  getComponentKnowledge(subjectId: string): DeepReadonly<ComponentKnowledge>
  listPatternKnowledge(): readonly DeepReadonly<PatternKnowledge>[]
  getPatternKnowledge(patternId: string): DeepReadonly<PatternKnowledge>
}>

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Builds independent component and pattern indexes over any knowledge loader. */
export function createKnowledgeQuery(load: () => LoadedKnowledge): KnowledgeQuery {
  const loaded = load()
  const components = new Map<string, DeepReadonly<ComponentKnowledge>>()
  const patterns = new Map<string, DeepReadonly<PatternKnowledge>>()

  for (const entry of loaded.components) {
    if (components.has(entry.subject.id)) throw new Error("Duplicate component knowledge subject: " + entry.subject.id + ".")
    components.set(entry.subject.id, entry)
  }
  for (const entry of loaded.patterns) {
    if (patterns.has(entry.subject.id)) throw new Error("Duplicate pattern knowledge subject: " + entry.subject.id + ".")
    patterns.set(entry.subject.id, entry)
  }

  const componentList = [...components.values()].sort((left, right) => compareText(left.subject.id, right.subject.id))
  const patternList = [...patterns.values()].sort((left, right) => compareText(left.subject.id, right.subject.id))

  return Object.freeze({
    listComponentKnowledge: () => Object.freeze([...componentList]),
    getComponentKnowledge: (subjectId: string) => {
      const entry = components.get(subjectId)
      if (!entry) throw new KnowledgeQueryError("COMPONENT_KNOWLEDGE_NOT_FOUND", "Component knowledge is not available: " + subjectId + ".")
      return entry
    },
    listPatternKnowledge: () => Object.freeze([...patternList]),
    getPatternKnowledge: (patternId: string) => {
      const entry = patterns.get(patternId)
      if (!entry) throw new KnowledgeQueryError("PATTERN_KNOWLEDGE_NOT_FOUND", "Pattern knowledge is not available: " + patternId + ".")
      return entry
    },
  })
}
