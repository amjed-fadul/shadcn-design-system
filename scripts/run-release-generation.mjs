import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runnerImport } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
const releaseId = "shadcn-radix-release-004"
const releasePath = path.join(root, `provenance/releases/${releaseId}.json`)
const r3Path = path.join(root, "provenance/releases/shadcn-radix-release-003.json")
const { module: releaseApi } = await runnerImport(path.join(root, "src/validator/release.ts"), { configFile: false })
const { module: componentAuthority } = await runnerImport(path.join(root, "src/contracts/components/canonical-loader.ts"), { configFile: false })
const { module: tokenAuthority } = await runnerImport(path.join(root, "src/contracts/tokens/contract.ts"), { configFile: false })
const { module: inputs } = await runnerImport(path.join(root, "scripts/release-inputs.ts"), { configFile: false })

if (!existsSync(r3Path)) throw new Error("Accepted R3 release record is required")
const packageIdentity = inputs.packageIdentity(root)
if (packageIdentity.version !== "0.0.0-release.4") throw new Error("R4 package version must be 0.0.0-release.4")
const release = releaseApi.createExecutableRelease({
  componentContracts: componentAuthority.loadComponentContracts(),
  tokenContract: tokenAuthority.getTokenContract(),
}, releaseId, { packageIdentity, implementationInputs: inputs.createImplementationManifest(root) })
const previousR3 = readFileSync(r3Path)
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8")
if (!previousR3.equals(readFileSync(r3Path))) throw new Error("R3 release record changed during R4 generation")
console.log(JSON.stringify({ releaseId, releasePath, releaseSha256: release.sha256, r3Preserved: true }, null, 2))
