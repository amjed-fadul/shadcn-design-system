import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

type Provenance = {
  upstream: { repository: string; commit: string; tag: string }
  sourceResolution: { cliVersionIsInsufficient: boolean }
  components: Record<string, { canonicalPath: string; canonicalBlobSha: string; implementationKind: string }>
}

const provenance = JSON.parse(readFileSync(new URL("../provenance/seed-components.json", import.meta.url), "utf8")) as Provenance

describe("Phase 1 component provenance", () => {
  test("pins every included component to a local file and the exact upstream revision", () => {
    expect(provenance.upstream).toMatchObject({
      repository: "shadcn-ui/ui",
      tag: "shadcn@4.19.0",
      commit: "1773ecfeeb4a04366978d353e69b5c7ded78dcb2",
    })
    expect(provenance.sourceResolution.cliVersionIsInsufficient).toBe(true)

    for (const component of Object.values(provenance.components)) {
      expect(existsSync(new URL(`../${component.canonicalPath}`, import.meta.url))).toBe(true)
      expect(component.canonicalBlobSha).toBe(
        execFileSync("git", ["hash-object", component.canonicalPath], { encoding: "utf8" }).trim()
      )
      expect(component.implementationKind).toBe("semantic-token-normalized-derivative")
    }
  })

  test("keeps Canvas host tokens and imports outside the canonical component source", () => {
    for (const component of Object.values(provenance.components)) {
      const source = readFileSync(new URL(`../${component.canonicalPath}`, import.meta.url), "utf8")
      expect(source).not.toMatch(/(^|[^a-z])canvas([^a-z]|$)|host-chrome|status-ready|status-experiment/i)
    }
  })
})
