import { createHash } from "node:crypto"
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { assertHistoricalArtifacts, HISTORICAL_ARTIFACT_SHA256 } from "../scripts/historical-artifacts.mjs"

const root = process.cwd()
const temporary: string[] = []
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }) })

describe("frozen release artifact guard", () => {
  test("checks every retained Release 001–012 record and available distribution manifest", () => {
    expect(Object.keys(HISTORICAL_ARTIFACT_SHA256)).toHaveLength(21)
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-007.json"])
      .toBe("366a2dd45490a28689effc10a8c58b68d090d8d0d86895c7e6269c9bbd2ae45c")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/distributions/shadcn-radix-release-007.distribution.json"])
      .toBe("3631a7f0cf0edf62951e71a5c7b52a2971c629fd5fa72ec5178179b99f8d1168")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-008.json"])
      .toBe("890a1a25be20039270c0222524813786044137ff0b90b1843fb9ac0a527015db")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-009.json"])
      .toBe("2df8a6b086af5b4d90c1bda2a9bb9a3304b18d20f3ef9871d5e5b640f85cd0d4")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/distributions/shadcn-radix-release-009.distribution.json"])
      .toBe("79fbbc7657d68c4a3a5d5cf9db0ebf684617be78bb792036f8b89827d698e87f")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-010.json"])
      .toBe("6450355882fe28d3b17ec94bcdf379fdf80dfa4c88538356bb15cc1e0bf8cdac")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/distributions/shadcn-radix-release-010.distribution.json"])
      .toBe("49d4e2e65027011c8b7b861cc6b60778be0c4fb5151e2188058d3ab520845beb")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-011.json"])
      .toBe("fd3afb47e710fa18f4007ad759134018ce4114ec0b5bfd5acb64bbcad4d35773")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/distributions/shadcn-radix-release-011.distribution.json"])
      .toBe("9190ce39c049cc6016fdd976d6a2bb405ce74119bfda4847b4d7548a3f6577ea")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-012.json"])
      .toBe("2909c4112cd27a26e758c5080d731f98f75f5bb6b84de3edea94a08adf84335f")
    expect(HISTORICAL_ARTIFACT_SHA256["provenance/distributions/shadcn-radix-release-012.distribution.json"])
      .toBe("cb65fccb2eafda2d5bfedae66b53f52ab01833094268a130e3bfff60821c8c53")
    assertHistoricalArtifacts(root, "test")
  })

  test("rejects byte changes in a temporary copy without touching the checkout", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "historical-artifact-guard-"))
    temporary.push(directory)
    for (const relativePath of Object.keys(HISTORICAL_ARTIFACT_SHA256)) {
      const destination = path.join(directory, relativePath)
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(path.join(root, relativePath), destination)
    }
    expect(() => assertHistoricalArtifacts(directory, "fixture-before-mutation")).not.toThrow()

    const r7Release = path.join(directory, "provenance/releases/shadcn-radix-release-007.json")
    writeFileSync(r7Release, Buffer.concat([readFileSync(r7Release), Buffer.from(" ")]))
    expect(() => assertHistoricalArtifacts(directory, "fixture-after-mutation")).toThrow(/HISTORICAL_ARTIFACT_CHANGED.*release-007\.json/)
    expect(createHash("sha256").update(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-007.json"))).digest("hex"))
      .toBe(HISTORICAL_ARTIFACT_SHA256["provenance/releases/shadcn-radix-release-007.json"])
  })
})
