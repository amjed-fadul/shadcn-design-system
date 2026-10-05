import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"

// The accepted Release 013 candidate's committed manifest records the packed inventory.
const root = path.resolve(import.meta.dirname, "..")
const manifest = JSON.parse(readFileSync(path.join(root, "provenance/distributions/shadcn-radix-release-013.distribution.json"), "utf8")) as { release: { id: string }; package: { version: string }; files: Array<{ path: string }> }

describe("Release 013 distribution", () => {
  test("packs the root LICENSE and the bundled third-party licence notices", () => {
    const files = manifest.files.map((file) => file.path)
    expect(manifest.release.id).toBe("shadcn-radix-release-013")
    expect(manifest.package.version).toBe("0.0.0-release.13")
    expect(files).toContain("LICENSE")
    expect(files).toContain("dist-library/THIRD_PARTY_LICENSES.txt")
  })
})
