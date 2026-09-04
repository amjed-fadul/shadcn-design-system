import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

type Snapshot = {
  id: string
  status: string
  sourceBaseCommit: string
  upstream: { repository: string; tag: string; commitSha: string; tagObjectSha: string }
  configuration: { path: string; blobSha: string }
  dependencies: { packageJsonPath: string; packageJsonSha: string; packageLockPath: string; packageLockSha: string; installCommand: string }
  sourceFiles: Record<string, string>
  tests: { paths: string[]; scope: string[]; provenanceTestPath: string; provenanceTestBlobSha: string }
  testFiles: Record<string, string>
  componentSet: string[]
}

type Provenance = {
  upstream: { repository: string; tag: string; commit: string }
  sourceResolution: { cliVersionIsInsufficient: boolean }
  components: Record<string, { canonicalPath: string; canonicalBlobSha: string; upstreamBlobSha: string }>
}

type SnapshotFileReader = (relativePath: string) => Buffer

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const approvedSnapshotSourceBaseCommit = "f9682ce3238f1fc5f41a91b1d6953a40c12d2288"
const snapshot = JSON.parse(readFileSync(join(repoRoot, "snapshots/shadcn-radix-bootstrap-000.json"), "utf8")) as Snapshot

function gitBlobSha(content: Buffer) {
  return createHash("sha1").update(Buffer.from(`blob ${content.byteLength}\0`)).update(content).digest("hex")
}

function createHistoricalFileReader(root: string, sourceBaseCommit: string): SnapshotFileReader {
  try {
    execFileSync("git", ["cat-file", "-e", `${sourceBaseCommit}^{commit}`], { cwd: root, stdio: "pipe" })
  } catch {
    throw new Error(`approved historical commit ${sourceBaseCommit} cannot be resolved locally`)
  }

  return (relativePath) => {
    try {
      return execFileSync("git", ["show", `${sourceBaseCommit}:${relativePath}`], { cwd: root, stdio: "pipe" })
    } catch {
      throw new Error(`unable to read ${relativePath} from approved historical commit ${sourceBaseCommit}`)
    }
  }
}

function governedFiles(currentSnapshot: Snapshot, currentProvenance: Provenance) {
  const files = new Map<string, string>([
    [currentSnapshot.configuration.path, currentSnapshot.configuration.blobSha],
    [currentSnapshot.dependencies.packageJsonPath, currentSnapshot.dependencies.packageJsonSha],
    [currentSnapshot.dependencies.packageLockPath, currentSnapshot.dependencies.packageLockSha],
    ...Object.entries(currentSnapshot.sourceFiles),
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

function verifySnapshotIntegrity(
  currentSnapshot: Snapshot,
  readHistoricalFile: SnapshotFileReader,
) {
  if (currentSnapshot.sourceBaseCommit !== approvedSnapshotSourceBaseCommit) {
    throw new Error("snapshot source base commit changed")
  }

  const historicalProvenance = JSON.parse(readHistoricalFile("provenance/seed-components.json").toString("utf8")) as Provenance
  const recordedShas = [
    currentSnapshot.sourceBaseCommit,
    currentSnapshot.upstream.commitSha,
    currentSnapshot.upstream.tagObjectSha,
    currentSnapshot.configuration.blobSha,
    currentSnapshot.dependencies.packageJsonSha,
    currentSnapshot.dependencies.packageLockSha,
    currentSnapshot.tests.provenanceTestBlobSha,
    ...Object.values(currentSnapshot.sourceFiles),
    ...Object.values(currentSnapshot.testFiles),
    ...Object.values(historicalProvenance.components).flatMap((component) => [component.canonicalBlobSha, component.upstreamBlobSha]),
  ]

  for (const sha of recordedShas) {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`invalid Git SHA: ${sha}`)
  }

  if (currentSnapshot.id !== "shadcn-radix-bootstrap-000") throw new Error("unexpected snapshot id")
  if (currentSnapshot.status !== "approved") throw new Error(`unexpected snapshot status: ${currentSnapshot.status}`)
  if (currentSnapshot.upstream.repository !== "shadcn-ui/ui" || currentSnapshot.upstream.tag !== "shadcn@4.19.0") {
    throw new Error("snapshot upstream identity changed")
  }
  if (currentSnapshot.upstream.commitSha !== "1773ecfeeb4a04366978d353e69b5c7ded78dcb2") throw new Error("snapshot upstream commit changed")
  if (currentSnapshot.dependencies.installCommand !== "npm ci") throw new Error("snapshot install command changed")
  if (!historicalProvenance.sourceResolution.cliVersionIsInsufficient) throw new Error("CLI-only provenance was accepted")

  const componentSet = [...currentSnapshot.componentSet].sort()
  const provenanceSet = Object.keys(historicalProvenance.components).sort()
  if (JSON.stringify(componentSet) !== JSON.stringify(provenanceSet)) throw new Error("snapshot component set differs from provenance")
  if (new Set(currentSnapshot.componentSet).size !== currentSnapshot.componentSet.length) throw new Error("snapshot component set contains duplicates")

  const studioTestPaths = Object.keys(currentSnapshot.testFiles)
    .filter((path) => path.startsWith("tests/studio-components-") && path.endsWith(".test.tsx"))
    .sort()
  if (JSON.stringify([...currentSnapshot.tests.paths].sort()) !== JSON.stringify(studioTestPaths)) {
    throw new Error("snapshot Studio component test paths differ from governed test files")
  }

  const css = readHistoricalFile("src/index.css").toString("utf8")
  if (!css.includes("--background: oklch(1 0 0)") || !css.includes("--background: oklch(0.145 0 0)")) throw new Error("canonical theme tokens are missing")
  if (/--(?:host-chrome-surface|canvas-surface|canvas-status-ready|canvas-status-experiment)/.test(css)) throw new Error("Canvas host token leaked into canonical theme")

  const tokenSource = JSON.parse(readHistoricalFile("provenance/token-source.json").toString("utf8")) as { theme: string; style: string; source: { commit: string } }
  if (tokenSource.theme !== "neutral" || tokenSource.style !== "radix-nova" || tokenSource.source.commit !== currentSnapshot.upstream.commitSha) {
    throw new Error("canonical token source does not match snapshot")
  }

  for (const [relativePath, expectedSha] of governedFiles(currentSnapshot, historicalProvenance)) {
    const actualSha = gitBlobSha(readHistoricalFile(relativePath))
    if (actualSha !== expectedSha) throw new Error(`${relativePath} differs from recorded historical Git blob`)
  }
}

describe("Bootstrap Snapshot 0 integrity", () => {
  const readHistoricalFile = createHistoricalFileReader(repoRoot, snapshot.sourceBaseCommit)

  test("validates governed files from the approved historical tree while current Phase 2 package metadata evolves", () => {
    expect(() => verifySnapshotIntegrity(snapshot, readHistoricalFile)).not.toThrow()
  }, 30_000)

  test("rejects a well-formed snapshot anchor other than the approved Phase 1 commit", () => {
    expect(() => verifySnapshotIntegrity(
      { ...snapshot, sourceBaseCommit: "1111111111111111111111111111111111111111" },
      readHistoricalFile,
    )).toThrow("snapshot source base commit changed")
  })

  test("parses component provenance from the injected historical reader", () => {
    const historicalProvenance = JSON.parse(readHistoricalFile("provenance/seed-components.json").toString("utf8")) as Provenance
    const readMutatedHistoricalProvenance = (relativePath: string) => relativePath === "provenance/seed-components.json"
      ? Buffer.from(JSON.stringify({ ...historicalProvenance, components: {} }))
      : readHistoricalFile(relativePath)

    expect(() => verifySnapshotIntegrity(snapshot, readMutatedHistoricalProvenance))
      .toThrow("snapshot component set differs from provenance")
  })

  test("rejects a mutated historical governed file without consulting the working tree", () => {
    const readMutatedHistoricalFile = (relativePath: string) => relativePath === snapshot.dependencies.packageJsonPath
      ? Buffer.concat([readHistoricalFile(relativePath), Buffer.from("\n")])
      : readHistoricalFile(relativePath)

    expect(() => verifySnapshotIntegrity(snapshot, readMutatedHistoricalFile))
      .toThrow("package.json differs from recorded historical Git blob")
  })

  test("fails clearly when the approved historical commit is unavailable locally", () => {
    expect(() => createHistoricalFileReader(repoRoot, "0000000000000000000000000000000000000000"))
      .toThrow("approved historical commit 0000000000000000000000000000000000000000 cannot be resolved locally")
  })
})
