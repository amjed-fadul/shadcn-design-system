import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import {
  EXECUTABLE_RELEASE_ID,
  EXECUTABLE_RELEASE_PATH,
  canonicalExecutableReleasePayload,
  createExecutableRelease,
  hashExecutableReleasePayload,
  loadExecutableRelease,
} from "../src/validator/release"
import { getExecutableRelease, validateAuthoredUiAgainstRelease } from "../src/validator/canonical-release"
import { projectExecutableContract } from "../src/validator/projection"
import type { AuthoredNode, AuthoredUi, AuthoredValue, ExecutableContract, ExecutableRelease } from "../src/validator/types"
import { createNeutralExecutableContractSource } from "./fixtures/executable-neutral-contract"

const neutralSource = createNeutralExecutableContractSource()
const neutralProjection = projectExecutableContract(neutralSource)
const neutralRelease = createExecutableRelease(neutralSource)

type MutableRelease = {
  -readonly [Key in keyof ExecutableRelease]: ExecutableRelease[Key]
}

function cloneRelease(release: ExecutableRelease): MutableRelease {
  return structuredClone(release) as MutableRelease
}

function hashFor(release: MutableRelease) {
  const { sha256: _sha256, ...payload } = release
  return hashExecutableReleasePayload(payload)
}

function component(exportName: string, props: Record<string, AuthoredValue> = {}): AuthoredNode {
  return {
    kind: "component",
    id: `release-${exportName}`,
    familyId: "action-button",
    exportName,
    props,
    children: [],
    location: { path: `release-${exportName}` },
  }
}

function authoredButton(): AuthoredUi {
  return {
    root: {
      kind: "component",
      id: "release-Button",
      familyId: "button",
      exportName: "Button",
      props: { variant: { kind: "literal", value: "outline" } },
      children: [],
      location: { path: "release-Button" },
    },
  }
}

describe("immutable executable release", () => {
  test("loads the versioned canonical release artifact through the production entrypoint", () => {
    const release = getExecutableRelease()

    expect(EXECUTABLE_RELEASE_PATH).toBe("provenance/releases/shadcn-radix-release-011.json")
    expect(release.releaseId).toBe(EXECUTABLE_RELEASE_ID)
    expect(release.componentContractSetId).toBe("shadcn-radix-component-contracts-001")
    expect(release.tokenContractId).toBe("shadcn-radix-token-contract-002")
    expect(release.projectionSchemaVersion).toBe(1)
  })

  test("contains every canonical family and export exactly once", () => {
    const release = getExecutableRelease()
    const canonical = loadComponentContracts()
    const familyIds = [...new Set(Object.values(release.projection.exports).map((entry) => entry.familyId))].sort()
    const exportIds = Object.keys(release.projection.exports).sort()
    const expectedFamilyIds = canonical.families.map((family) => family.id).sort()
    const expectedExportIds = canonical.families.flatMap((family) => family.exports.map((entry) => `${family.id}\u0000${entry.name}`)).sort()

    expect(familyIds).toEqual(expectedFamilyIds)
    expect(familyIds).toHaveLength(41)
    expect(exportIds).toEqual(expectedExportIds)
    expect(exportIds).toHaveLength(210)
  })

  test("preserves releases 001 through 007 byte-for-byte while selecting 008", () => {
    const historicalHashes = [
      "70795494166657dfcdc74a57626b5b9501621ffa8aaa11a17216a1cf72bbd6a9",
      "f63207dedd4d8e3c8656db50583660f5ab16174051c4ae847b3b6ddc1954f3ae",
      "2aa266790b3e74395750e0f6e703238f2e29192f46f4237094fae212263600eb",
      "bd90164eb8065a2e5c8a3209d9d831e85a8cf6b1134b44011e4921f57ab3d797",
      "a8f0be8d622a8e9f773af522564ec2398860cb7fe6ff49e4c057f65f81cbff88",
      "6fbdf4a98a7d0e5667e073857cd9beb3061b4d71b141dc38248008f37b8e7b43",
      "366a2dd45490a28689effc10a8c58b68d090d8d0d86895c7e6269c9bbd2ae45c",
    ]
    for (const [index, expected] of historicalHashes.entries()) {
      const releaseNumber = String(index + 1).padStart(3, "0")
      const releaseBytes = readFileSync(fileURLToPath(new URL(`../provenance/releases/shadcn-radix-release-${releaseNumber}.json`, import.meta.url)))
      expect(createHash("sha256").update(releaseBytes).digest("hex")).toBe(expected)
    }
    expect(EXECUTABLE_RELEASE_ID).toBe("shadcn-radix-release-011")
  })

  test("derives the canonical release payload from the approved projection", () => {
    const canonicalProjection = projectExecutableContract({
      componentContracts: loadComponentContracts(),
      tokenContract: getTokenContract(),
    })
    const release = createExecutableRelease({
      componentContracts: loadComponentContracts(),
      tokenContract: getTokenContract(),
    })

    expect(release.projection).toEqual(canonicalProjection)
    expect(release.componentContractSetId).toBe(canonicalProjection.componentContractSetId)
    expect(release.tokenContractId).toBe(canonicalProjection.tokenContractId)
    expect(release.sourceBaselines).toEqual({
      componentContract: canonicalProjection.sourceBaselineCommit,
      tokenContract: canonicalProjection.tokenSourceBaselineCommit,
    })
  })

  test("validates a release hash over canonical serialization without sha256", () => {
    const { sha256, ...payload } = neutralRelease

    expect(canonicalExecutableReleasePayload(payload)).toBe(canonicalExecutableReleasePayload({ ...payload }))
    expect(hashExecutableReleasePayload(payload)).toBe(sha256)
    expect(sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  test("rejects changed projection content even when its forged payload hash is recomputed", () => {
    const candidate = cloneRelease(neutralRelease)
    candidate.projection = { ...candidate.projection, tokenIds: [...candidate.projection.tokenIds, "forged.token"] }
    candidate.sha256 = hashFor(candidate)

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/PROJECTION_MISMATCH/)
  })

  test("rejects a forged hash", () => {
    const candidate = cloneRelease(neutralRelease)
    candidate.sha256 = "0".repeat(64)

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/HASH_MISMATCH/)
  })

  test("rejects a wrong release identity", () => {
    const candidate = cloneRelease(neutralRelease)
    candidate.releaseId = "shadcn-radix-release-forged"

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/RELEASE_ID_MISMATCH/)
  })

  test("rejects a wrong component-contract identity", () => {
    const candidate = cloneRelease(neutralRelease)
    candidate.componentContractSetId = "forged-components-001"

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/COMPONENT_CONTRACT_ID_MISMATCH/)
  })

  test("rejects a wrong token-contract identity", () => {
    const candidate = cloneRelease(neutralRelease)
    candidate.tokenContractId = "forged-tokens-001"

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/TOKEN_CONTRACT_ID_MISMATCH/)
  })

  test.each([
    ["missing release field", (candidate: MutableRelease) => { delete (candidate as Partial<MutableRelease>).tokenContractId }],
    ["extra release field", (candidate: MutableRelease) => { (candidate as MutableRelease & { extra?: string }).extra = "forged" }],
    ["missing source baseline", (candidate: MutableRelease) => { candidate.sourceBaselines = { componentContract: candidate.sourceBaselines.componentContract } as typeof candidate.sourceBaselines }],
  ])("rejects %s", (_name, mutate) => {
    const candidate = cloneRelease(neutralRelease)
    mutate(candidate)

    expect(() => loadExecutableRelease(candidate, { expectedProjection: neutralProjection })).toThrowError(/SHAPE_INVALID/)
  })

  test("deep-freezes a loaded release and its executable projection", () => {
    const loaded = loadExecutableRelease(neutralRelease, { expectedProjection: neutralProjection })

    expect(Object.isFrozen(loaded)).toBe(true)
    expect(Object.isFrozen(loaded.sourceBaselines)).toBe(true)
    expect(Object.isFrozen(loaded.projection)).toBe(true)
    expect(Object.isFrozen(loaded.projection.exports)).toBe(true)
    expect(() => ((loaded.projection as { tokenIds: readonly string[] }).tokenIds = [])).toThrow(TypeError)
  })

  test("production validation consumes the immutable release projection", () => {
    expect(validateAuthoredUiAgainstRelease(authoredButton())).toEqual({ ok: true, errors: [] })
    expect(validateAuthoredUiAgainstRelease({
      root: {
        kind: "component",
        id: "release-invalid-Button",
        familyId: "button",
        exportName: "Button",
        props: { variant: { kind: "literal", value: "invented" } },
        children: [],
        location: { path: "release-invalid-Button" },
      },
    })).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: "INVALID_PROP_VALUE" })],
    })
  })

  test("does not include Phase 4 knowledge in the release payload", () => {
    const serialized = canonicalExecutableReleasePayload(getExecutableRelease())

    expect(serialized).not.toContain("knowledge")
  })
})
