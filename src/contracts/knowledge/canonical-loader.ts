import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { loadComponentContracts } from "../components/canonical-loader"
import { createKnowledgeLoader, KnowledgeLoadError, type KnowledgeArtifactSource } from "./loader"
import type { LoadedKnowledge } from "./types"

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url))

const canonicalSource: KnowledgeArtifactSource = {
  readJson(path) {
    const absolutePath = join(repositoryRoot, path)
    if (!existsSync(absolutePath)) {
      throw new KnowledgeLoadError("KNOWLEDGE_ARTIFACT_NOT_FOUND", "Missing knowledge artifact: " + path + ".", path)
    }
    try {
      return JSON.parse(readFileSync(absolutePath, "utf8"))
    } catch (error) {
      throw new KnowledgeLoadError("KNOWLEDGE_SCHEMA_INVALID", "Unable to parse knowledge artifact: " + path + ". " + String(error), path)
    }
  },
}

const canonicalLoader = createKnowledgeLoader({ source: canonicalSource, requireAllReferencesUsed: true })

export function loadKnowledge(): LoadedKnowledge {
  const loaded = canonicalLoader()
  const expectedFamilyIds = loadComponentContracts().families.map((family) => family.id).sort()
  const actualFamilyIds = loaded.components.map((component) => component.subject.id).sort()
  if (actualFamilyIds.length !== expectedFamilyIds.length || actualFamilyIds.some((id, index) => id !== expectedFamilyIds[index])) {
    throw new KnowledgeLoadError(
      "KNOWLEDGE_ARTIFACT_INVALID",
      "Canonical knowledge component IDs must match the canonical component family IDs.",
      "contracts/knowledge/knowledge-set.json",
    )
  }
  return loaded
}
