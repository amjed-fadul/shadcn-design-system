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
  test("checks every retained Release 001–009 record and available distribution manifest", () => {
    expect(Object.keys(HISTORICAL_ARTIFACT_SHA256)).toHaveLength(15)
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
