import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testsDirectory, "..")
const storyDirectory = path.join(repositoryRoot, "src/components/ui")

describe("Storybook contract coverage", () => {
  test("has exactly one conventional story file for each of the 37 present components", () => {
    const directoryEntries = readdirSync(storyDirectory)
    const componentFiles = directoryEntries
      .filter(
        (fileName) =>
          fileName.endsWith(".tsx") && !fileName.endsWith(".stories.tsx")
      )
      .sort()
    const expectedStoryFiles = componentFiles.map((componentFile) =>
      componentFile.replace(/\.tsx$/, ".stories.tsx")
    )
    const actualStoryFiles = directoryEntries
      .filter((fileName) => fileName.endsWith(".stories.tsx"))
      .sort()

    expect(componentFiles).toHaveLength(37)
    expect(actualStoryFiles).toHaveLength(37)
    expect(actualStoryFiles).toEqual(expectedStoryFiles)
  })
})
