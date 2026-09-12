import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import release004Artifact from "../provenance/releases/shadcn-radix-release-004.json"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract } from "../src/validator/projection"
import { hashExecutableReleasePayload, loadExecutableRelease } from "../src/validator/release"
import type { ExecutableRelease } from "../src/validator/types"
import { describe, expect, test } from "vitest"

const canonicalReleasePath = resolve(import.meta.dirname, "../src/validator/canonical-release.ts")

type MutableRelease = {
  -readonly [Key in keyof ExecutableRelease]: ExecutableRelease[Key]
}

function approvedProjection() {
  return projectExecutableContract({
    componentContracts: loadComponentContracts(),
    tokenContract: getTokenContract(),
  })
}

describe("Release 004 active canonical binding", () => {
  test("binds the Release 004 package and canonical projection to the active runtime validator", async () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"))
    const sourceText = readFileSync(canonicalReleasePath, "utf8")

    expect(packageJson.version).toBe("0.0.0-release.4")
    expect(release004Artifact.projection).toEqual(approvedProjection())
    expect(sourceText).toContain('provenance/releases/shadcn-radix-release-004.json')
    expect(sourceText).not.toContain('provenance/releases/shadcn-radix-release-003.json')

    const canonical = await import("../src/validator/canonical-release")
    expect(canonical.getExecutableRelease().releaseId).toBe("shadcn-radix-release-004")
  })

  test("rejects a hash-valid tampered Release 004 projection against canonical source", () => {
    const candidate = structuredClone(release004Artifact) as MutableRelease
    candidate.projection = { ...candidate.projection, tokenIds: [...candidate.projection.tokenIds, "forged.token"] }
    const { sha256: _sha256, ...payload } = candidate
    candidate.sha256 = hashExecutableReleasePayload(payload)

    expect(() => loadExecutableRelease(candidate, {
      expectedProjection: approvedProjection(),
      expectedReleaseId: "shadcn-radix-release-004",
      requirePackageIdentity: true,
    })).toThrowError(/PROJECTION_MISMATCH/)
  })
})
