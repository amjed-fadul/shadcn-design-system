import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

type Provenance = {
  upstream: { repository: string; commit: string; tag: string }
  sourceResolution: { cliVersionIsInsufficient: boolean }
  derivation: { operations: string[] }
  components: Record<string, { canonicalPath: string; canonicalBlobSha: string; implementationKind: string }>
}

const provenance = JSON.parse(readFileSync(new URL("../provenance/seed-components.json", import.meta.url), "utf8")) as Provenance

describe("canonical component provenance", () => {
  test("pins every included component to a local file and the exact upstream revision", () => {
    expect(provenance.upstream).toMatchObject({
      repository: "shadcn-ui/ui",
      tag: "shadcn@4.19.0",
      commit: "1773ecfeeb4a04366978d353e69b5c7ded78dcb2",
    })
    expect(provenance.sourceResolution.cliVersionIsInsufficient).toBe(true)

    for (const [id, component] of Object.entries(provenance.components)) {
      expect(existsSync(new URL(`../${component.canonicalPath}`, import.meta.url))).toBe(true)
      expect(component.canonicalBlobSha).toBe(
        execFileSync("git", ["hash-object", component.canonicalPath], { encoding: "utf8" }).trim()
      )
      expect(component.implementationKind).toBe(id === "collapsible" ? "upstream-wrapper" : "semantic-token-normalized-derivative")
    }
  })

  test("keeps Canvas host tokens and imports outside the canonical component source", () => {
    for (const component of Object.values(provenance.components)) {
      const source = readFileSync(new URL(`../${component.canonicalPath}`, import.meta.url), "utf8")
      expect(source).not.toMatch(/(^|[^a-z])canvas([^a-z]|$)|host-chrome|status-ready|status-experiment/i)
    }
  })

  test("records deterministic Sidebar adaptation without ambient-app policy", () => {
    expect(provenance.components.sidebar.canonicalBlobSha).toBe("30877f7508ba49fe48992ca744f53a3903ed4482")
    expect(provenance.derivation.operations).toContain(
      "make Sidebar presentation and desktop/mobile state explicit, preserve sidebar.context, and move viewport detection, persistence, and keyboard shortcuts to an external normal-app recipe"
    )
    expect(JSON.stringify(provenance.components.sidebar)).not.toMatch(/Canvas|authoring policy/i)
  })
})
