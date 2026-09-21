import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testsDirectory, "..")
const storyDirectory = path.join(repositoryRoot, "src/components/ui")

const expectedFamilyIds = [
  "accordion",
  "alert-dialog",
  "alert",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "card",
  "checkbox",
  "command",
  "dialog",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "input-group",
  "input",
  "label",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toggle-group",
  "toggle",
  "tooltip",
] as const

describe("Storybook contract coverage", () => {
  test("preserves the exact 37-family source and story manifests", () => {
    const directoryEntries = readdirSync(storyDirectory)
    const actualComponentFiles = directoryEntries
      .filter(
        (fileName) =>
          fileName.endsWith(".tsx") && !fileName.endsWith(".stories.tsx")
      )
      .sort()
    const actualStoryFiles = directoryEntries
      .filter((fileName) => fileName.endsWith(".stories.tsx"))
      .sort()
    const expectedComponentFiles = expectedFamilyIds
      .map((familyId) => `${familyId}.tsx`)
      .sort()
    const expectedStoryFiles = expectedFamilyIds
      .map((familyId) => `${familyId}.stories.tsx`)
      .sort()

    expect(expectedFamilyIds).toHaveLength(37)
    expect(actualComponentFiles).toEqual(expectedComponentFiles)
    expect(actualStoryFiles).toEqual(expectedStoryFiles)
  })
})
