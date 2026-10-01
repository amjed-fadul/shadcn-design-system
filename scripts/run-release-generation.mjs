import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { runnerImport } from "vite"
import { assertHistoricalArtifacts } from "./historical-artifacts.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const releaseId = "shadcn-radix-release-009"
const releasePath = path.join(root, `provenance/releases/${releaseId}.json`)
const r3Path = path.join(root, "provenance/releases/shadcn-radix-release-003.json")
const r3ArtifactDirectory = process.env.ADC_R3_ARTIFACT_DIRECTORY ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-003"
const r3TarballPath = path.join(r3ArtifactDirectory, "adc-shadcn-design-system-0.0.0-release.3.tgz")
const r3Expected = {
  tarballSha256: "bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629",
  payloadSha256: "5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b",
}
const { module: releaseApi } = await runnerImport(path.join(root, "src/validator/release.ts"), { configFile: false })
const { module: componentAuthority } = await runnerImport(path.join(root, "src/contracts/components/canonical-loader.ts"), { configFile: false })
const { module: tokenAuthority } = await runnerImport(path.join(root, "src/contracts/tokens/contract.ts"), { configFile: false })
const { module: inputs } = await runnerImport(path.join(root, "scripts/release-inputs.ts"), { configFile: false })

async function inspectR3Artifact(phase) {
  if (!existsSync(r3TarballPath)) throw new Error(`R3_ARTIFACT_MISSING: ${r3TarballPath}`)
  const tarballBytes = readFileSync(r3TarballPath)
  const tarballSha256 = createHash("sha256").update(tarballBytes).digest("hex")
  if (tarballSha256 !== r3Expected.tarballSha256) throw new Error(`R3_ARTIFACT_MISMATCH (${phase}): expected tarball ${r3Expected.tarballSha256}, received ${tarballSha256}`)
  const releaseSource = execFileSync("tar", ["-xOf", r3TarballPath, "package/dist-library/release.js"], { maxBuffer: 16 * 1024 * 1024 })
  const directory = mkdtempSync(path.join(tmpdir(), "r3-release-generation-"))
  try {
    const releaseModulePath = path.join(directory, "release.mjs")
    writeFileSync(releaseModulePath, releaseSource)
    const library = await import(`${pathToFileURL(releaseModulePath).href}?inspection=${Date.now()}`)
    const release = library.getExecutableRelease()
    const { sha256: _sha256, ...payload } = release
    return {
      tarballSha256,
      payloadSha256: releaseApi.hashExecutableReleasePayload(payload),
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function assertR3Artifact(identity, phase) {
  if (identity.tarballSha256 !== r3Expected.tarballSha256 || identity.payloadSha256 !== r3Expected.payloadSha256) {
    throw new Error(`R3_ARTIFACT_MISMATCH (${phase}): expected tarball ${r3Expected.tarballSha256} and payload ${r3Expected.payloadSha256}, received tarball ${identity.tarballSha256} and payload ${identity.payloadSha256}`)
  }
}

if (!existsSync(r3Path)) throw new Error("Accepted R3 release record is required")
assertHistoricalArtifacts(root, "before-release-generation")
const r3Before = await inspectR3Artifact("before")
assertR3Artifact(r3Before, "before")
const packageIdentity = inputs.packageIdentity(root)
if (packageIdentity.version !== "0.0.0-release.9") throw new Error("R9 package version must be 0.0.0-release.9")
const release = releaseApi.createExecutableRelease({
  componentContracts: componentAuthority.loadComponentContracts(),
  tokenContract: tokenAuthority.getTokenContract(),
}, releaseId, { packageIdentity, implementationInputs: inputs.createImplementationManifest(root, { generatedReleasePath: path.relative(root, releasePath) }) })
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8")
assertHistoricalArtifacts(root, "after-release-generation")
const r3After = await inspectR3Artifact("after")
assertR3Artifact(r3After, "after")
if (r3Before.tarballSha256 !== r3After.tarballSha256 || r3Before.payloadSha256 !== r3After.payloadSha256) throw new Error("R3_ARTIFACT_CHANGED_DURING_GENERATION")
console.log(JSON.stringify({ releaseId, releasePath, releaseSha256: release.sha256, historicalReleasesPreserved: true, r3Before, r3After }, null, 2))
