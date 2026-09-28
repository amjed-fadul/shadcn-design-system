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
          blobSha: "f0402b08be0c2ea80831805928d87977e5543e8d",
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

  test("records the owner brand layer and where its values match the pinned Tailwind palette", () => {
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))
    const contract = JSON.parse(readFileSync(join(repoRoot, "contracts/tokens/token-contract.json"), "utf8"))
    const brand = provenance.brandLayer

    expect(brand.sourceCommit).toBe(contract.sourceBaselineCommit)
    expect(brand.tokens).toEqual([
      "color.primary",
      "color.primary-foreground",
      "color.ring",
      "color.sidebar-primary",
      "color.sidebar-primary-foreground",
      "color.sidebar-ring",
    ])

    const valueOf = (id: string, mode: "light" | "dark") => contract.tokens.find((token: { id: string }) => token.id === id).value.values[mode]
    for (const mode of ["light", "dark"] as const) {
      const { brand: brandValue, foreground } = brand.values[mode]
      for (const id of ["color.primary", "color.ring", "color.sidebar-primary", "color.sidebar-ring"]) expect(valueOf(id, mode)).toBe(brandValue)
      for (const id of ["color.primary-foreground", "color.sidebar-primary-foreground"]) expect(valueOf(id, mode)).toBe(foreground)

      const origin = brand.valueOrigin[mode]
      expect(origin.path).toBe(provenance.sources.tailwindTheme.path)
      expect(origin.version).toBe(provenance.sources.tailwindTheme.version)
      const themeCss = readFileSync(join(repoRoot, origin.path), "utf8")
      expect(themeCss).toContain(`${origin.variable}: ${origin.value};`)
      const [, lightness, chroma, hue] = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(origin.value)!
      expect(brandValue).toBe(`oklch(${Number((Number(lightness) / 100).toFixed(6))} ${chroma} ${hue})`)
    }
  })
})
