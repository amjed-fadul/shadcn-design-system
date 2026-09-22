import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url))
const workflowRoot = join(repositoryRoot, ".github/workflows")
const releaseWideWorkflows = [
  "alert-dialog-final-verify.yml",
  "command-final-verify.yml",
  "drawer-final-verify.yml",
  "popover-final-verify.yml",
  "baseline.yml",
]
const blockingCommands = [
  "npm ci --ignore-scripts",
  "npm run typecheck",
  "npm run test",
  "npm run build",
  "npm run test-storybook",
  "npm run build-storybook",
  "npm audit --omit=dev",
  "npm audit",
]

describe("release-wide CI workflow gates", () => {
  test("runs the same blocking release sequence for every release workflow", () => {
    for (const workflow of releaseWideWorkflows) {
      const source = readFileSync(join(workflowRoot, workflow), "utf8")
      let previousIndex = -1
      for (const command of blockingCommands) {
        const index = source.indexOf(command, previousIndex + 1)
        expect(index, `${workflow} is missing ${command}`).toBeGreaterThan(previousIndex)
        previousIndex = index
      }
      expect(source).not.toContain("continue-on-error")
      expect(source).not.toMatch(/allowlist|grep -vE|pre-existing Storybook/i)
    }
  })

  test("contains no diagnostic exception in any workflow", () => {
    for (const workflow of readdirSync(workflowRoot).filter((name) => name.endsWith(".yml"))) {
      const source = readFileSync(join(workflowRoot, workflow), "utf8")
      expect(source, workflow).not.toContain("continue-on-error")
    }
  })
})
