import { readFileSync } from "node:fs"
import { describe, expect, test, vi } from "vitest"
import type { ComponentContractLoaderOptions } from "../src/contracts/components/loader"
import type { ComponentContractSet } from "../src/contracts/components/types"
import { canonicalCapabilityIds, canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const configured = vi.hoisted(() => ({ options: undefined as ComponentContractLoaderOptions | undefined }))

// Capture only the canonical-to-generic loader boundary. Exercise the real
// configured authority callbacks below. Full loading remains covered by the
// unmocked index/query suites, including their outstanding 4B/4C failures.
vi.mock("../src/contracts/components/loader", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/contracts/components/loader")>(),
  createComponentContractLoader(options: ComponentContractLoaderOptions) {
    configured.options = options
    return () => undefined
  },
}))
import "../src/contracts/components/canonical-loader"

const manifest = JSON.parse(readFileSync(new URL("../contracts/components/component-contract-set.json", import.meta.url), "utf8")) as ComponentContractSet

describe("canonical loader authority configuration", () => {
  test("accepts exactly the independently approved 42-family scope", () => {
    const expected = { ...manifest, familyCount: 42, familyFiles: canonicalFamilyIds.map((id) => `contracts/components/families/${id}.json`) }
    expect(configured.options!.contractSetReconciler!(expected)).toEqual([])
  })

  test.each(["remove", "replace", "duplicate"])("rejects a %s mutation of the pinned scope", (mutation) => {
    const set = structuredClone(manifest)
    if (mutation === "remove") { set.familyFiles.pop(); set.familyCount-- }
    else set.familyFiles[0] = mutation === "replace" ? "contracts/components/families/forged.json" : set.familyFiles[1]
    expect(configured.options!.contractSetReconciler!(set).length).toBeGreaterThan(0)
  })

  test("requires source identity for all 42 families and refuses unknown identities", () => {
    expect(configured.options!.requireSourceIdentity).toBe(true)
    for (const id of canonicalFamilyIds) {
      expect(configured.options!.sourceIdentityForFamily!(id)).toMatchObject({
        canonicalPath: `src/components/ui/${id}.tsx`, canonicalBlobSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      })
    }
    expect(configured.options!.sourceIdentityForFamily!("forged")).toBeUndefined()
  })

  test("passes the exact pinned capability authority without authorizing arbitrary capabilities", () => {
    expect([...configured.options!.capabilityIds!].sort()).toEqual(canonicalCapabilityIds)
    expect(configured.options!.capabilityIds!.has("forged.context")).toBe(false)
  })
})
