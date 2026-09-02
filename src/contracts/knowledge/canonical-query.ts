import { loadKnowledge } from "./canonical-loader"
import { createKnowledgeQuery } from "./query"

const canonicalQuery = createKnowledgeQuery(loadKnowledge)

export const listComponentKnowledge = canonicalQuery.listComponentKnowledge
export const getComponentKnowledge = canonicalQuery.getComponentKnowledge
export const listPatternKnowledge = canonicalQuery.listPatternKnowledge
export const getPatternKnowledge = canonicalQuery.getPatternKnowledge
