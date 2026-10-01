import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import baseline from "./fixtures/release008-semantic-identities.json"
import { assertHistoricalArtifacts } from "../scripts/historical-artifacts.mjs"

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

describe("Release 009 preservation of accepted authorities", () => {
  test("preserves every Release 008 API, rendering fact and composition contract", () => {
    for (const [id, expected] of Object.entries(baseline.families)) {
      const family = JSON.parse(readFileSync(new URL(`../contracts/components/families/${id}.json`, import.meta.url), "utf8"))
      // Styling dependencies and source hashes change; all semantic facts stay exact.
      delete family.source
      delete family.evidence.source
      delete family.evidence.tokens
      for (const entry of family.exports) if (entry.component) delete entry.component.tokenDependencies
      expect(hash(JSON.stringify(family)), id).toBe(expected)
    }
  })
  test("keeps Icon, Image, Link and ToggleGroup implementation bytes intact", () => {
    for (const [id, expected] of Object.entries(baseline.primitives)) {
      expect(hash(readFileSync(new URL(`../src/components/ui/${id}.tsx`, import.meta.url))), id).toBe(expected)
    }
  })
  test("keeps all retained release and distribution files immutable, including R7 and R8", () => {
    expect(() => assertHistoricalArtifacts(fileURLToPath(new URL("../", import.meta.url)))).not.toThrow()
  })
})
