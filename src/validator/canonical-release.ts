import executableReleaseArtifact from "../../provenance/releases/shadcn-radix-release-012.json"

import { loadComponentContracts } from "../contracts/components/canonical-loader"
import { getTokenContract } from "../contracts/tokens/contract"
import { projectExecutableContract } from "./projection"
import { loadExecutableRelease } from "./release"
import { validateAuthoredUi } from "./validate"
import type { AuthoredUi, ExecutableContractSource, ExecutableRelease } from "./types"

const approvedSource: ExecutableContractSource = {
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
}
const approvedProjection = projectExecutableContract(approvedSource)
const executableRelease = loadExecutableRelease(executableReleaseArtifact, {
  expectedProjection: approvedProjection,
  expectedReleaseId: "shadcn-radix-release-012",
  requirePackageIdentity: true,
})

/** Returns the one immutable release used by production validation. */
export function getExecutableRelease(): ExecutableRelease {
  return executableRelease
}

/** Production entrypoint: authored validation is evaluated against the immutable release graph. */
export function validateAuthoredUiAgainstRelease(input: AuthoredUi): ReturnType<typeof validateAuthoredUi> {
  return validateAuthoredUi(input, executableRelease.projection)
}
