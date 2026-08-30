import { createHash } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "vitest"

type Snapshot = {
  id: string
  status: string
  sourceBaseCommit: string
  upstream: { repository: string; tag: string; commitSha: string; tagObjectSha: string }
  configuration: { path: string; blobSha: string }
  dependencies: { packageJsonPath: string; packageJsonSha: string; packageLockPath: string; packageLockSha: string; installCommand: string }
  sourceFiles: Record<string, string>
  tests: { path: string; blobSha: string; provenanceTestPath: string; provenanceTestBlobSha: string }
  testFiles: Record<string, string>
  componentSet: string[]
}

type Provenance = {
  upstream: { repository: string; tag: string; commit: string }
  sourceResolution: { cliVersionIsInsufficient: boolean }
  components: Record<string, { canonicalPath: string; canonicalBlobSha: string; upstreamBlobSha: string }>
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const snapshot = JSON.parse(readFileSync(join(repoRoot, "snapshots/shadcn-radix-bootstrap-000.json"), "utf8")) as Snapshot
const provenance = JSON.parse(readFileSync(join(repoRoot, "provenance/seed-components.json"), "utf8")) as Provenance

function gitBlobSha(root: string, relativePath: string) {
  const content = readFileSync(join(root, relativePath))
  return createHash("sha1").update(Buffer.from(`blob ${content.byteLength}\0`)).update(content).digest("hex")
}

function governedFiles(currentSnapshot: Snapshot, currentProvenance: Provenance) {
  const files = new Map<string, string>([
    [currentSnapshot.configuration.path, currentSnapshot.configuration.blobSha],
    [currentSnapshot.dependencies.packageJsonPath, currentSnapshot.dependencies.packageJsonSha],
    [currentSnapshot.dependencies.packageLockPath, currentSnapshot.dependencies.packageLockSha],
    ...Object.entries(currentSnapshot.sourceFiles),
    [currentSnapshot.tests.path, currentSnapshot.tests.blobSha],
    [currentSnapshot.tests.provenanceTestPath, currentSnapshot.tests.provenanceTestBlobSha],
    ...Object.entries(currentSnapshot.testFiles),
  ])

  for (const component of Object.values(currentProvenance.components)) {
    const previous = files.get(component.canonicalPath)
    if (previous && previous !== component.canonicalBlobSha) {
      throw new Error(`conflicting governed hash for ${component.canonicalPath}`)
    }
    files.set(component.canonicalPath, component.canonicalBlobSha)
  }

  return files
}

function verifySnapshotIntegrity(root: string, currentSnapshot: Snapshot, currentProvenance: Provenance) {
  const recordedShas = [
    currentSnapshot.sourceBaseCommit,
    currentSnapshot.upstream.commitSha,
    currentSnapshot.upstream.tagObjectSha,
    currentSnapshot.configuration.blobSha,
    currentSnapshot.dependencies.packageJsonSha,
    currentSnapshot.dependencies.packageLockSha,
    currentSnapshot.tests.blobSha,
    currentSnapshot.tests.provenanceTestBlobSha,
    ...Object.values(currentSnapshot.sourceFiles),
    ...Object.values(currentSnapshot.testFiles),
    ...Object.values(currentProvenance.components).flatMap((component) => [component.canonicalBlobSha, component.upstreamBlobSha]),
  ]

  for (const sha of recordedShas) {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`invalid Git SHA: ${sha}`)
  }

  if (currentSnapshot.id !== "shadcn-radix-bootstrap-000") throw new Error("unexpected snapshot id")
  if (currentSnapshot.status !== "candidate") throw new Error(`unexpected snapshot status: ${currentSnapshot.status}`)
  if (currentSnapshot.upstream.repository !== "shadcn-ui/ui" || currentSnapshot.upstream.tag !== "shadcn@4.19.0") {
    throw new Error("snapshot upstream identity changed")
  }
  if (currentSnapshot.upstream.commitSha !== "1773ecfeeb4a04366978d353e69b5c7ded78dcb2") throw new Error("snapshot upstream commit changed")
  if (currentSnapshot.dependencies.installCommand !== "npm ci") throw new Error("snapshot install command changed")
  if (!currentProvenance.sourceResolution.cliVersionIsInsufficient) throw new Error("CLI-only provenance was accepted")

  const componentSet = [...currentSnapshot.componentSet].sort()
  const provenanceSet = Object.keys(currentProvenance.components).sort()
  if (JSON.stringify(componentSet) !== JSON.stringify(provenanceSet)) throw new Error("snapshot component set differs from provenance")
  if (new Set(currentSnapshot.componentSet).size !== currentSnapshot.componentSet.length) throw new Error("snapshot component set contains duplicates")

  const css = readFileSync(join(root, "src/index.css"), "utf8")
  if (!css.includes("--background: oklch(1 0 0)") || !css.includes("--background: oklch(0.145 0 0)")) throw new Error("canonical theme tokens are missing")
  if (/--(?:host-chrome-surface|canvas-surface|canvas-status-ready|canvas-status-experiment)/.test(css)) throw new Error("Canvas host token leaked into canonical theme")

  const tokenSource = JSON.parse(readFileSync(join(root, "provenance/token-source.json"), "utf8")) as { theme: string; style: string; source: { commit: string } }
  if (tokenSource.theme !== "neutral" || tokenSource.style !== "radix-nova" || tokenSource.source.commit !== currentSnapshot.upstream.commitSha) {
    throw new Error("canonical token source does not match snapshot")
  }

  for (const [relativePath, expectedSha] of governedFiles(currentSnapshot, currentProvenance)) {
    if (!existsSync(join(root, relativePath))) throw new Error(`missing governed file: ${relativePath}`)
    const actualSha = gitBlobSha(root, relativePath)
    if (actualSha !== expectedSha) throw new Error(`${relativePath} changed; regenerate Bootstrap Snapshot 0`)
  }
}

describe("Bootstrap Snapshot 0 integrity", () => {
  test("validates the offline snapshot and every governed local Git blob", () => {
    expect(() => verifySnapshotIntegrity(repoRoot, snapshot, provenance)).not.toThrow()
  })

  test("detects a governed-file mutation without consulting upstream", () => {
    const mutatedRoot = mkdtempSync(join(tmpdir(), "bootstrap-snapshot-"))
    for (const relativePath of governedFiles(snapshot, provenance).keys()) {
      const target = join(mutatedRoot, relativePath)
      mkdirSync(join(target, ".."), { recursive: true })
      copyFileSync(join(repoRoot, relativePath), target)
    }

    const packagePath = join(mutatedRoot, snapshot.dependencies.packageJsonPath)
    writeFileSync(packagePath, `${readFileSync(packagePath, "utf8")}\n`)

    expect(() => verifySnapshotIntegrity(mutatedRoot, snapshot, provenance)).toThrow("package.json changed; regenerate Bootstrap Snapshot 0")
  })
})
