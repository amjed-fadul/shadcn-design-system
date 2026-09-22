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
  "npx playwright install --with-deps chromium",
  "npm run typecheck",
  "npm run test",
  "npm run build",
  "npm run test-storybook",
  "npm run build-storybook",
  "npm audit --omit=dev",
  "npm audit",
]

type WorkflowPolicyError = { code: string; message: string }

/** Validate the release workflow contract without executing YAML or shell. */
export function validateReleaseWorkflowPolicy(source: string, packageScripts: Record<string, unknown>): WorkflowPolicyError[] {
  const errors: WorkflowPolicyError[] = []
  const add = (code: string, message: string) => errors.push({ code, message })

  if (/continue-on-error\s*:/i.test(source)) add("CONTINUE_ON_ERROR", "workflow must not permit a failing step to continue")
  if (/allow[- ]?list|grep\s+-v(?:E)?|pre-existing\s+storybook|known\s+failure/i.test(source)) add("DIAGNOSTIC_ALLOWLIST", "workflow must not allowlist or filter diagnostics")
  if (/if:\s*(?:\$\{\{\s*)?always\(\)(?:\s*\}\})?/i.test(source)) add("ALWAYS_BYPASS", "blocking release steps must not run under an always condition")
  if (/set\s*\+e/i.test(source)) add("SET_PLUS_E", "workflow must not disable shell error handling")
  if (/\|\|\s*true\b/i.test(source)) add("STATUS_SWALLOW", "workflow must not swallow command status with || true")
  if (/\b(?:status|exit[_-]?code|result)\s*=\s*\$?\??\(?\s*\$?\??/i.test(source)) add("STATUS_SWALLOW", "workflow must not capture and ignore a command status")

  const commandIndex = (command: string, start: number) => {
    let index = source.indexOf(command, start)
    while (index >= 0 && /[A-Za-z0-9:_-]/.test(source[index + command.length] ?? "")) index = source.indexOf(command, index + command.length)
    return index
  }
  let previousIndex = -1
  for (const command of blockingCommands) {
    const index = commandIndex(command, previousIndex + 1)
    if (index < 0) {
      add(commandIndex(command, 0) >= 0 ? "COMMAND_ORDER" : "MISSING_COMMAND", `${command} is missing or out of order`)
    } else {
      if (index <= previousIndex) add("COMMAND_ORDER", `${command} is out of order`)
      previousIndex = index
    }
  }

  const storybookIndex = source.indexOf("npm run test-storybook")
  const chromiumIndex = source.indexOf("npx playwright install --with-deps chromium")
  if (storybookIndex >= 0 && (chromiumIndex < 0 || chromiumIndex > storybookIndex)) add("MISSING_CHROMIUM", "test-storybook requires Playwright chromium installation first")

  for (const match of source.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    const script = match[1]
    if (!(script in packageScripts)) add("UNKNOWN_NPM_SCRIPT", `workflow invokes npm run ${script}, but package.json has no such script`)
  }

  return errors
}

const packageScripts = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")).scripts as Record<string, unknown>

describe("release-wide CI workflow gates", () => {
  test("all five workflows satisfy the same blocking release policy", () => {
    for (const workflow of releaseWideWorkflows) {
      const source = readFileSync(join(workflowRoot, workflow), "utf8")
      expect(validateReleaseWorkflowPolicy(source, packageScripts), workflow).toEqual([])
    }
  })

  test("contains no diagnostic exception in any workflow", () => {
    for (const workflow of readdirSync(workflowRoot).filter((name) => name.endsWith(".yml"))) {
      const source = readFileSync(join(workflowRoot, workflow), "utf8")
      expect(validateReleaseWorkflowPolicy(source, packageScripts), workflow).not.toContainEqual(expect.objectContaining({ code: "CONTINUE_ON_ERROR" }))
    }
  })

  test("rejects adversarial policy mutations", () => {
    const baseline = readFileSync(join(workflowRoot, releaseWideWorkflows[0]), "utf8")
    const replaceOnce = (source: string, from: string, to: string) => {
      expect(source).toContain(from)
      return source.replace(from, to)
    }
    const expectRejects = (source: string, code: string) => {
      expect(validateReleaseWorkflowPolicy(source, packageScripts).map((error) => error.code)).toContain(code)
    }

    expectRejects(`${baseline}\n      - continue-on-error: true\n`, "CONTINUE_ON_ERROR")
    expectRejects(`${baseline}\n      - run: set +e\n`, "SET_PLUS_E")
    expectRejects(replaceOnce(baseline, "npm run typecheck", "npm run typecheck || true"), "STATUS_SWALLOW")
    expectRejects(`${baseline}\n      - run: status=$?\n`, "STATUS_SWALLOW")
    expectRejects(`${baseline}\n      - run: grep -vE 'known failure'\n`, "DIAGNOSTIC_ALLOWLIST")
    expectRejects(`${baseline}\n      - if: \${{ always() }}\n`, "ALWAYS_BYPASS")
    expectRejects(replaceOnce(baseline, "      - run: npm run build\n", ""), "MISSING_COMMAND")
    expectRejects(replaceOnce(baseline, "      - run: npm run typecheck\n      - run: npm run test\n", "      - run: npm run test\n      - run: npm run typecheck\n"), "COMMAND_ORDER")
    expectRejects(replaceOnce(baseline, "      - run: npx playwright install --with-deps chromium\n", ""), "MISSING_CHROMIUM")
    expectRejects(replaceOnce(baseline, "npm run test\n", "npm run missing-script\n"), "UNKNOWN_NPM_SCRIPT")
  })
})
