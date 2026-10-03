import { execFileSync } from "node:child_process"
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
          blobSha: execFileSync("git", ["hash-object", "src/index.css"], { cwd: repoRoot, encoding: "utf8" }).trim(),
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

    // Token contract -002 was cut from this commit; -003 records its own baseline in release011Layer.
    expect(brand.sourceCommit).toBe("e04ee6822a0b49e227970e787940db96730c9222")
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

  test("records the Release 011 status and chart layer and where its values match the pinned Tailwind palette", () => {
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))
    const contract = JSON.parse(readFileSync(join(repoRoot, "contracts/tokens/token-contract.json"), "utf8"))
    const layer = provenance.release011Layer

    expect(layer.release).toBe("shadcn-radix-release-011")
    expect(layer.sourceCommit).toBe(contract.sourceBaselineCommit)
    expect(layer.addedTokens).toEqual([
      "color.success",
      "color.success-foreground",
      "color.warning",
      "color.warning-foreground",
      "color.info",
      "color.info-foreground",
      "radius.full",
      "line-height.display",
    ])
    expect(layer.changedTokens).toEqual(["color.chart-1", "color.chart-2", "color.chart-3", "color.chart-4", "color.chart-5"])
    for (const id of [...layer.addedTokens, ...layer.changedTokens]) {
      expect(contract.tokens.some((token: { id: string }) => token.id === id)).toBe(true)
    }

    const origin = layer.valueOrigin
    expect(origin.path).toBe(provenance.sources.tailwindTheme.path)
    expect(origin.version).toBe(provenance.sources.tailwindTheme.version)
    const themeCss = readFileSync(join(repoRoot, origin.path), "utf8")
    const valueOf = (id: string, mode: "light" | "dark") => contract.tokens.find((token: { id: string }) => token.id === id).value.values[mode]
    for (const mode of ["light", "dark"] as const) {
      expect(Object.keys(origin[mode])).toEqual([
        "color.success",
        "color.warning",
        "color.info",
        "color.chart-1",
        "color.chart-2",
        "color.chart-3",
        "color.chart-4",
        "color.chart-5",
      ])
      for (const [id, variable] of Object.entries(origin[mode] as Record<string, string>)) {
        const match = new RegExp(`${variable}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\);`).exec(themeCss)
        expect(match, `${variable} in ${origin.path}`).not.toBeNull()
        const [, lightness, chroma, hue] = match!
        expect(valueOf(id, mode)).toBe(`oklch(${Number((Number(lightness) / 100).toFixed(6))} ${chroma} ${hue})`)
      }
      for (const status of ["success", "warning", "info"]) {
        expect(valueOf(`color.${status}-foreground`, mode)).toBe(valueOf("color.primary-foreground", mode))
      }
    }
    expect(layer.floors.tests).toEqual([
      "tests/token-contract-status-contrast.test.ts",
      "tests/token-contract-chart-palette.test.ts",
    ])
  })
})
