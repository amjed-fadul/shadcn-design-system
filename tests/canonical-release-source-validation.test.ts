import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import ts from "typescript"
import { describe, expect, test } from "vitest"

const canonicalReleasePath = resolve(import.meta.dirname, "../src/validator/canonical-release.ts")

function variableInitializer(sourceFile: ts.SourceFile, name: string) {
  let initializer: ts.Expression | undefined

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (!initializer) throw new Error(`Missing initializer for ${name}.`)
  return initializer
}

describe("canonical release source validation", () => {
  test("derives the active-release expectation from canonical source rather than the artifact projection", () => {
    const sourceText = readFileSync(canonicalReleasePath, "utf8")
    const sourceFile = ts.createSourceFile(canonicalReleasePath, sourceText, ts.ScriptTarget.Latest, true)

    expect(sourceText).toContain('import { loadComponentContracts } from "../contracts/components/canonical-loader"')
    expect(sourceText).toContain('import { getTokenContract } from "../contracts/tokens/contract"')
    expect(sourceText).toContain('import { projectExecutableContract } from "./projection"')
    expect(variableInitializer(sourceFile, "approvedProjection").getText(sourceFile)).toBe("projectExecutableContract(approvedSource)")
    expect(sourceText).not.toContain("executableReleaseArtifact.projection")
    expect(sourceText).toContain("expectedProjection: approvedProjection")
  })
})
