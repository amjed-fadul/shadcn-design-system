import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import release014Artifact from "../provenance/releases/shadcn-radix-release-014.json"
import { verifyImplementationManifest } from "../scripts/release-inputs"
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

describe("Release 014 active canonical binding", { timeout: 60000 }, () => {
  test("binds the active Release 014 to the exact current implementation inputs", () => {
    expect(() => verifyImplementationManifest(
      resolve(import.meta.dirname, ".."),
      release014Artifact.implementationInputs
    )).not.toThrow()
  })

  test("binds the Release 014 package and canonical projection to the active runtime validator", async () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"))
    const sourceText = readFileSync(canonicalReleasePath, "utf8")

    expect(packageJson.version).toBe("0.0.0-release.14")
    expect(release014Artifact.projection).toEqual(approvedProjection())
    expect(sourceText).toContain('provenance/releases/shadcn-radix-release-014.json')
    expect(sourceText).not.toContain('provenance/releases/shadcn-radix-release-007.json')

    const canonical = await import("../src/validator/canonical-release")
    expect(canonical.getExecutableRelease().releaseId).toBe("shadcn-radix-release-014")
    // Imports the canonical release and its projection: about 3 s on a macOS runner.
  }, 30_000)

  test("rejects a hash-valid tampered Release 014 projection against canonical source", () => {
    const candidate = structuredClone(release014Artifact) as MutableRelease
    candidate.projection = { ...candidate.projection, tokenIds: [...candidate.projection.tokenIds, "forged.token"] }
    const { sha256: _sha256, ...payload } = candidate
    candidate.sha256 = hashExecutableReleasePayload(payload)

    expect(() => loadExecutableRelease(candidate, {
      expectedProjection: approvedProjection(),
      expectedReleaseId: "shadcn-radix-release-014",
      requirePackageIdentity: true,
    })).toThrowError(/PROJECTION_MISMATCH/)
  })
})
