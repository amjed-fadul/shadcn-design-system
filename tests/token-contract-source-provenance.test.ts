import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const provenancePath = join(repoRoot, "provenance/token-contract-source.json")

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("Phase 2 token contract source provenance", () => {
  test("records the approved baseline and reproducible local source inputs", () => {
    expect(existsSync(provenancePath)).toBe(true)
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))

    expect(provenance).toMatchObject({
      schemaVersion: 1,
      baseline: {
        snapshotId: "shadcn-radix-bootstrap-000",
        sourceCommit: "f9682ce3238f1fc5f41a91b1d6953a40c12d2288",
      },
      sources: {
        canonicalTheme: {
          path: "src/index.css",
          blobSha: "d8c0cfe33f88e04af7aea72c952abee5903d836e",
        },
        shadcnNeutral: {
          repository: "shadcn-ui/ui",
          release: "shadcn@4.19.0",
          commit: "1773ecfeeb4a04366978d353e69b5c7ded78dcb2",
          path: "apps/v4/public/r/colors/neutral.json",
        },
        tailwindTheme: {
          package: "tailwindcss",
          version: "4.3.3",
          path: "node_modules/tailwindcss/theme.css",
        },
      },
    })

    const tailwindTheme = provenance.sources.tailwindTheme
    expect(tailwindTheme.themeCssSha256).toBe(sha256(join(repoRoot, tailwindTheme.path)))

    const packageLock = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"))
    expect(tailwindTheme.packageLockIntegrity).toBe(packageLock.packages["node_modules/tailwindcss"].integrity)
  })
})
