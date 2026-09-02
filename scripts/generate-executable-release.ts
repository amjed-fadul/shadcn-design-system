import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { createExecutableRelease, EXECUTABLE_RELEASE_PATH } from "../src/validator/release"

const repositoryRoot = process.cwd()
const release = createExecutableRelease({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
})
const releasePath = join(repositoryRoot, EXECUTABLE_RELEASE_PATH)

mkdirSync(dirname(releasePath), { recursive: true })
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8")
