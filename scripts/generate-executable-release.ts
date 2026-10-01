import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { createExecutableRelease, EXECUTABLE_RELEASE_PATH } from "../src/validator/release"

import { createImplementationManifest, packageIdentity } from "./release-inputs"
import { assertHistoricalArtifacts } from "./historical-artifacts.mjs"

const repositoryRoot = process.cwd()
assertHistoricalArtifacts(repositoryRoot, "before-release-generation")
const release = createExecutableRelease({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
}, undefined, { packageIdentity: packageIdentity(repositoryRoot), implementationInputs: createImplementationManifest(repositoryRoot) })
const releasePath = join(repositoryRoot, EXECUTABLE_RELEASE_PATH)

if (existsSync(releasePath)) {
  const previous = JSON.parse(readFileSync(releasePath, "utf8"))
  if (JSON.stringify(previous.projection) !== JSON.stringify(release.projection)) throw new Error("STOP: executable projection changed unexpectedly")
}
mkdirSync(dirname(releasePath), { recursive: true })
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8")
assertHistoricalArtifacts(repositoryRoot, "after-release-generation")
