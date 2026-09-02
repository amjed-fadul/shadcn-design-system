import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

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

const canonicalLoader = createKnowledgeLoader({ source: canonicalSource })

export function loadKnowledge(): LoadedKnowledge {
  return canonicalLoader()
}
