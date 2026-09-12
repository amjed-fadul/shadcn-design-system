import executableReleaseArtifact from "../../provenance/releases/shadcn-radix-release-003.json"

import { loadExecutableRelease } from "./release"
import { validateAuthoredUi } from "./validate"
import type { AuthoredUi, ExecutableContract, ExecutableRelease } from "./types"

const approvedProjection = executableReleaseArtifact.projection as ExecutableContract
const executableRelease = loadExecutableRelease(executableReleaseArtifact, { expectedProjection: approvedProjection, requirePackageIdentity: true })

/** Returns the one immutable release used by production validation. */
export function getExecutableRelease(): ExecutableRelease {
  return executableRelease
}

/** Production entrypoint: authored validation is evaluated against the immutable release graph. */
export function validateAuthoredUiAgainstRelease(input: AuthoredUi): ReturnType<typeof validateAuthoredUi> {
  return validateAuthoredUi(input, executableRelease.projection)
}
