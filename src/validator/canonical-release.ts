import executableReleaseArtifact from "../../provenance/releases/shadcn-radix-release-001.json"

import { loadComponentContracts } from "../contracts/components/canonical-loader"
import { getTokenContract } from "../contracts/tokens/contract"
import { projectExecutableContract } from "./projection"
import { loadExecutableRelease } from "./release"
import { validateAuthoredUi } from "./validate"
import type { AuthoredUi, ExecutableRelease, ExecutableContractSource } from "./types"

const approvedSource: ExecutableContractSource = {
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
}
const approvedProjection = projectExecutableContract(approvedSource)
const executableRelease = loadExecutableRelease(executableReleaseArtifact, { expectedProjection: approvedProjection, requirePackageIdentity: true })

/** Returns the one immutable release used by production validation. */
export function getExecutableRelease(): ExecutableRelease {
  return executableRelease
}

/** Production entrypoint: authored validation is evaluated against the immutable release graph. */
export function validateAuthoredUiAgainstRelease(input: AuthoredUi): ReturnType<typeof validateAuthoredUi> {
  return validateAuthoredUi(input, executableRelease.projection)
}
