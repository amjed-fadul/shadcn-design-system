import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import baseline from "./fixtures/release008-semantic-identities.json"
import { assertHistoricalArtifacts } from "../scripts/historical-artifacts.mjs"

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
// Release 011 adds options to these families; tests/release-011-delta.test.ts proves that the
// additions are the only change against the same Release 008 identities.
const release011Extended = new Set(["alert", "avatar", "badge", "icon"])

describe("Release 009 preservation of accepted authorities", () => {
  test("preserves every Release 008 API, rendering fact and composition contract", () => {
    for (const [id, expected] of Object.entries(baseline.families)) {
      if (release011Extended.has(id)) continue
      const family = JSON.parse(readFileSync(new URL(`../contracts/components/families/${id}.json`, import.meta.url), "utf8"))
      // Styling dependencies and source hashes change; all semantic facts stay exact.
      delete family.source
      delete family.evidence.source
      delete family.evidence.tokens
      for (const entry of family.exports) if (entry.component) delete entry.component.tokenDependencies
      expect(hash(JSON.stringify(family)), id).toBe(expected)
    }
  })
  test("keeps Image, Link and ToggleGroup implementation bytes intact (Icon is extended in Release 011)", () => {
    for (const [id, expected] of Object.entries(baseline.primitives)) {
      if (release011Extended.has(id)) continue
      expect(hash(readFileSync(new URL(`../src/components/ui/${id}.tsx`, import.meta.url))), id).toBe(expected)
    }
  })
  test("keeps all retained release and distribution files immutable, including R7 and R8", () => {
    expect(() => assertHistoricalArtifacts(fileURLToPath(new URL("../", import.meta.url)))).not.toThrow()
  })
})
