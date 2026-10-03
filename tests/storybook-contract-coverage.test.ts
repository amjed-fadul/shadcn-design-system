import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testsDirectory, "..")
const storyDirectory = path.join(repositoryRoot, "src/components/ui")
const previewSource = readFileSync(
  path.join(repositoryRoot, ".storybook/preview.ts"),
  "utf8"
)

const expectedFamilyIds = [
  "accordion",
  "alert-dialog",
  "alert",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "card",
  "chart",
  "checkbox",
  "collapsible",
  "command",
  "dialog",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "icon",
  "image",
  "input-group",
  "input",
  "label",
  "link",
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
  test("preserves 42 family stories and the bounded product-system integration matrix", () => {
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
    const expectedStoryFiles = [...expectedFamilyIds.map((familyId) => `${familyId}.stories.tsx`), "product-system.stories.tsx"].sort()

    expect(expectedFamilyIds).toHaveLength(42)
    expect(actualComponentFiles).toEqual(expectedComponentFiles)
    expect(actualStoryFiles).toEqual(expectedStoryFiles)
  })

  test("keeps every axe rule enabled in the enforced Storybook gate", () => {
    expect(previewSource).toMatch(/test:\s*"error"/)
    expect(previewSource).toMatch(
      /rules:\s*\[\{\s*id:\s*"region",\s*enabled:\s*true\s*\}\]/
    )
  })
})
