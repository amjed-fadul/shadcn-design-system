import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { analyzeTailwindTokenDependencies, auditComponentTokenCoverage } from "../src/contracts/components/canonical-token-source-analysis"

describe("governed ring offset utility vocabulary", () => {
  test("maps approved semantic offset colors without inventing width or unknown color tokens", () => {
    expect(analyzeTailwindTokenDependencies("focus-visible:ring-offset-background data-[state=on]:ring-offset-primary ring-offset-2 ring-offset-unknown-brand")).toEqual([
      { tokenId: "color.background", evidenceRefs: ["source"] },
      { tokenId: "color.primary", when: { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "on" }, evidenceRefs: ["source"] },
    ])
  })

  test("accepts the established offset width while flagging unsupported offset colors and widths", () => {
    const directory = mkdtempSync(join(tmpdir(), "ring-offset-audit-"))
    const path = join(directory, "fixture.tsx")
    try {
      writeFileSync(path, 'export function Example() { return <div className="focus-visible:ring-offset-background focus-visible:ring-offset-2 ring-offset-unknown-brand ring-offset-17 ring-offset-0 ring-inset ring-unknown-brand" /> }')
      const coverage = auditComponentTokenCoverage(path)
      expect(coverage).toContainEqual({ utility: "ring-offset-background", classification: "resolved-approved-token", tokenId: "color.background", namespace: "color" })
      expect(coverage).toContainEqual({ utility: "ring-offset-2", classification: "known-not-contracted-namespace", namespace: "ring-offset-width" })
      expect(coverage).toContainEqual({ utility: "ring-offset-0", classification: "known-not-contracted-namespace", namespace: "ring-offset-width" })
      expect(coverage).toContainEqual({ utility: "ring-inset", classification: "known-not-contracted-namespace", namespace: "ring-placement" })
      for (const utility of ["ring-offset-unknown-brand", "ring-offset-17", "ring-unknown-brand"]) expect(coverage).toContainEqual({ utility, classification: "suspicious-contracted-namespace", namespace: "color" })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
