import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runnerImport } from "vite"
import { assertHistoricalArtifacts } from "./historical-artifacts.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
process.chdir(root)
const { module: identity } = await runnerImport(path.join(root, "scripts/release-inputs.ts"), { configFile: false })
const { module: distribution } = await runnerImport(path.join(root, "scripts/distribution-identity.ts"), { configFile: false })
const { module: releaseApi } = await runnerImport(path.join(root, "src/validator/release.ts"), { configFile: false })
const { module: projectionApi } = await runnerImport(path.join(root, "src/validator/projection.ts"), { configFile: false })
const { module: componentAuthority } = await runnerImport(path.join(root, "src/contracts/components/canonical-loader.ts"), { configFile: false })
const { module: tokenAuthority } = await runnerImport(path.join(root, "src/contracts/tokens/contract.ts"), { configFile: false })
const [command, ...args] = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Required option: ${name}`)
  return args[index + 1]
}
function toolchain() {
  const node = process.versions.node
  const npm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim()
  if (node !== "22.18.0" || npm !== "10.9.3") throw new Error(`TOOLCHAIN_MISMATCH: Node ${node}, npm ${npm}`)
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"))
  const tools = {}
  for (const name of ["vite", "typescript", "@vitejs/plugin-react", "@tailwindcss/vite", "tailwindcss", "rollup", "esbuild"]) {
    const version = JSON.parse(readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8")).version
    if (version !== lock.packages[`node_modules/${name}`].version) throw new Error(`LOCKED_TOOLCHAIN_MISMATCH: ${name}`)
    tools[name] = version
  }
  return { node, npm, platform: process.platform, arch: process.arch, tools }
}
function packBuild() {
  const stage = mkdtempSync(path.join(tmpdir(), "release-010-build-"))
  try {
    // The full pinned declaration and contract graph exceeds Node's default
    // 4 GB heap during a fresh package build; keep the verifier reproducible.
    execFileSync(process.execPath, ["--max-old-space-size=6144", path.join(root, "scripts/build-library.mjs"), "--out-dir", path.join(stage, "dist-library")], { cwd: root, stdio: "pipe", timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
    for (const file of readdirSync(root)) if (file === "package.json" || /^(README|LICEN[CS]E|COPYING)(\.|$)/i.test(file)) cpSync(path.join(root, file), path.join(stage, file))
    const result = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json"], { cwd: stage, encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }))[0]
    const bytes = readFileSync(path.join(stage, result.filename))
    const inventory = distribution.packedInventory(bytes)
    if (result.integrity !== `sha512-${(hash512(bytes))}`) throw new Error("NPM_INTEGRITY_MISMATCH")
    return { bytes, filename: result.filename, inventory }
  } finally { rmSync(stage, { recursive: true, force: true }) }
}
function candidateRelease(expectedSha256) {
  const releasePath = path.join(root, "provenance/releases/shadcn-radix-release-010.json")
  const raw = JSON.parse(readFileSync(releasePath, "utf8"))
  const expectedProjection = projectionApi.projectExecutableContract({ componentContracts: componentAuthority.loadComponentContracts(), tokenContract: tokenAuthority.getTokenContract() })
  const release = releaseApi.loadExecutableRelease(raw, { expectedProjection, expectedReleaseId: "shadcn-radix-release-010", requirePackageIdentity: true })
  if (expectedSha256 !== undefined && release.sha256 !== expectedSha256) throw new Error("RELEASE_ANCHOR_MISMATCH")
  if (JSON.stringify(release.packageIdentity) !== JSON.stringify(identity.packageIdentity(root))) throw new Error("PACKAGE_IDENTITY_MISMATCH")
  identity.verifyImplementationManifest(root, release.implementationInputs)
  return release
}
// Keep npm's integrity report an independent cross-check of the packed bytes.
import { createHash } from "node:crypto"
function hash512(bytes) { return createHash("sha512").update(bytes).digest("base64") }

if (!["generate", "verify", "release-verify"].includes(command)) throw new Error("Use generate --output DIR, verify --manifest FILE --tarball FILE --manifest-sha256 DIGEST, or release-verify --release-sha256 DIGEST")
const buildToolchain = toolchain()
assertHistoricalArtifacts(root, "before-candidate-command")
const release = candidateRelease(command === "release-verify" ? option("--release-sha256") : undefined)
if (command === "release-verify") {
  assertHistoricalArtifacts(root, "after-release-verification")
  console.log(`Verified release ${release.releaseId}: ${release.sha256}`)
} else if (command === "generate") {
  const output = path.resolve(option("--output"))
  if (output === path.resolve(root) || output.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Candidate artifacts must be external to the repository")
  mkdirSync(output, { recursive: true })
  const packed = packBuild()
  const tarballPath = path.join(output, packed.filename)
  const manifestPath = path.join(output, "distribution-manifest.json")
  if (existsSync(tarballPath) || existsSync(manifestPath)) throw new Error("Candidate output already exists; choose a new directory")
  candidateRelease()
  const manifest = distribution.generateDistributionManifest({ release, toolchain: buildToolchain, tarballFilename: packed.filename, tarballBytes: packed.bytes })
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(tarballPath, packed.bytes, { flag: "wx" })
  writeFileSync(manifestPath, manifestBytes, { flag: "wx" })
  assertHistoricalArtifacts(root, "after-candidate-generation")
  console.log(JSON.stringify({ candidateOnly: true, tarballPath, manifestPath, manifestSha256: identity.sha256(manifestBytes), releasePayloadSha256: release.sha256, tarballSha256: manifest.tarball.sha256, integrity: manifest.tarball.integrity, packedFileCount: manifest.files.length }, null, 2))
} else {
  const manifestPath = path.resolve(option("--manifest"))
  const tarballPath = path.resolve(option("--tarball"))
  const expectedManifestSha256 = option("--manifest-sha256")
  const manifestBytes = readFileSync(manifestPath)
  const tarballBytes = readFileSync(tarballPath)
  if (!/^[0-9a-f]{64}$/.test(expectedManifestSha256) || identity.sha256(manifestBytes) !== expectedManifestSha256) throw new Error("MANIFEST_HASH_MISMATCH: independently retained digest required")
  const rebuilt = packBuild()
  const approvedTarballSha256 = identity.sha256(tarballBytes)
  const rebuiltTarballSha256 = identity.sha256(rebuilt.bytes)
  const approvedIntegrity = `sha512-${hash512(tarballBytes)}`
  const rebuiltIntegrity = `sha512-${hash512(rebuilt.bytes)}`
  if (approvedTarballSha256 !== rebuiltTarballSha256) throw new Error(`FRESH_TARBALL_SHA256_MISMATCH: approved ${approvedTarballSha256}, rebuilt ${rebuiltTarballSha256}`)
  if (approvedIntegrity !== rebuiltIntegrity) throw new Error(`FRESH_TARBALL_INTEGRITY_MISMATCH: approved ${approvedIntegrity}, rebuilt ${rebuiltIntegrity}`)
  if (!Buffer.from(tarballBytes).equals(rebuilt.bytes)) throw new Error("FRESH_TARBALL_BYTES_MISMATCH")
  distribution.verifyDistributionManifest({ manifestBytes, expectedManifestSha256, tarballBytes, tarballFilename: path.basename(tarballPath), release, toolchain: buildToolchain, expectedInventory: rebuilt.inventory })
  candidateRelease()
  assertHistoricalArtifacts(root, "after-candidate-verification")
  console.log(`Verified existing candidate, external manifest and fresh build: ${release.releaseId}, ${rebuilt.inventory.length} packed files. No expectations refreshed.`)
}
