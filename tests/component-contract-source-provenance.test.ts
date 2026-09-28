import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { canonicalFamilyIds as expectedFamilyIds } from "./fixtures/canonical-component-inventory"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const provenancePath = join(repoRoot, "provenance/component-contract-source.json")

type SeedComponent = {
  canonicalPath: string
  canonicalBlobSha: string
  upstreamPath: string
  upstreamBlobSha: string
  implementationKind: string
}

function gitBlobSha(path: string) {
  return execFileSync("git", ["hash-object", path], { cwd: repoRoot, encoding: "utf8" }).trim()
}

describe("canonical component-contract source provenance", { timeout: 60000 }, () => {
  test("freezes the approved baseline, seed closure, token contract, and package pins", () => {
    expect(existsSync(provenancePath)).toBe(true)

    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))
    const seedPath = join(repoRoot, "provenance/seed-components.json")
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as { components: Record<string, SeedComponent> }
    const tokenContractPath = join(repoRoot, "contracts/tokens/token-contract.json")
    const tokenContract = JSON.parse(readFileSync(tokenContractPath, "utf8"))
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
    const packageLock = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"))
    const familyIds = Object.keys(seed.components).sort()

    expect(provenance).toMatchObject({
      schemaVersion: 1,
      baseline: { commit: "6f14d8f9f5b5638ab97db009d7c164a65331dca7" },
      familySource: {
        path: "provenance/seed-components.json",
        blobSha: gitBlobSha("provenance/seed-components.json"),
        familyCount: 38,
        familyIds: expectedFamilyIds,
      },
      tokenContract: {
        id: "shadcn-radix-token-contract-002",
        status: "candidate",
        path: "contracts/tokens/token-contract.json",
        blobSha: gitBlobSha("contracts/tokens/token-contract.json"),
      },
      packages: {
        react: { version: "18.3.1" },
        "@types/react": { version: "18.3.3" },
        "radix-ui": { version: "1.6.7" },
        typescript: { version: "5.5.4" },
        "class-variance-authority": { version: "0.7.1" },
        cmdk: { version: "1.1.1" },
        vaul: { version: "1.1.2" },
      },
    })

    expect(familyIds).toEqual(expectedFamilyIds)
    expect(familyIds).toHaveLength(38)
    expect(provenance.familySource.familyIds).toEqual(familyIds)
    expect(provenance.familySource.blobSha).toBe(gitBlobSha(provenance.familySource.path))

    expect(tokenContract.id).toBe("shadcn-radix-token-contract-002")
    expect(tokenContract.status).toBe("candidate")
    expect(tokenContract.tokens).toHaveLength(82)
    expect(tokenContract.derivedRules).toHaveLength(1)
    expect(provenance.tokenContract.blobSha).toBe(gitBlobSha(provenance.tokenContract.path))

    const expectedPackages = {
      react: "18.3.1",
      "@types/react": "18.3.3",
      "radix-ui": "1.6.7",
      typescript: "5.5.4",
      "class-variance-authority": "0.7.1",
      cmdk: "1.1.1",
      vaul: "1.1.2",
    }
    for (const [packageName, expectedVersion] of Object.entries(expectedPackages)) {
      const declaredVersion = packageJson.dependencies[packageName] ?? packageJson.devDependencies[packageName]
      expect(declaredVersion).toBe(expectedVersion)
      expect(packageLock.packages[`node_modules/${packageName}`].version).toBe(expectedVersion)
      expect(provenance.packages[packageName].version).toBe(expectedVersion)
    }

    for (const [id, component] of Object.entries(seed.components)) {
      const family = JSON.parse(readFileSync(join(repoRoot, `contracts/components/families/${id}.json`), "utf8"))
      expect(family.source).toMatchObject({
        canonicalPath: component.canonicalPath,
        canonicalBlobSha: component.canonicalBlobSha,
        upstreamPath: component.upstreamPath,
        upstreamBlobSha: component.upstreamBlobSha,
        implementationKind: component.implementationKind,
      })
      expect(existsSync(join(repoRoot, component.canonicalPath))).toBe(true)
      expect(component.canonicalBlobSha).toBe(gitBlobSha(component.canonicalPath))
      expect(component.upstreamPath).not.toBe("")
      expect(component.upstreamBlobSha).toMatch(/^[0-9a-f]{40}$/)
      expect(component.implementationKind).not.toBe("")
    }
  })
})
