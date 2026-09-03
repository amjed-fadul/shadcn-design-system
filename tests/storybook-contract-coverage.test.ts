import { readdirSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testsDirectory, "..")
const storyDirectory = path.join(repositoryRoot, "src/components/ui")

const familyIds = contractSet.familyFiles.map((familyFile) =>
  path.basename(familyFile, ".json")
)
const expectedStoryFiles = familyIds.map((familyId) => `${familyId}.stories.tsx`)

describe("Storybook contract coverage", () => {
  test("has exactly one conventional story file for every approved family", () => {
    expect(new Set(familyIds).size).toBe(familyIds.length)
    expect(contractSet.familyCount).toBe(familyIds.length)

    const missingStoryFiles = expectedStoryFiles.filter(
      (storyFile) => !existsSync(path.join(storyDirectory, storyFile))
    )
    const actualStoryFiles = readdirSync(storyDirectory)
      .filter((fileName) => fileName.endsWith(".stories.tsx"))
      .sort()

    expect(missingStoryFiles).toEqual([])
    expect(actualStoryFiles).toEqual([...expectedStoryFiles].sort())
  })
})
