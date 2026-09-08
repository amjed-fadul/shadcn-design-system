import { createHash } from "node:crypto"

import { projectExecutableContract } from "./projection"
import type {
  ExecutableContract,
  ExecutableContractSource,
  ExecutableRelease,
  ExecutableReleasePayload,
  PackageIdentity,
  ImplementationInput,
} from "./types"

export const EXECUTABLE_RELEASE_ID = "shadcn-radix-release-003"
export const EXECUTABLE_RELEASE_PATH = "provenance/releases/shadcn-radix-release-003.json"

export type ExecutableReleaseLoadErrorCode =
  | "RELEASE_SHAPE_INVALID"
  | "RELEASE_ID_MISMATCH"
  | "PROJECTION_SCHEMA_MISMATCH"
  | "COMPONENT_CONTRACT_ID_MISMATCH"
  | "TOKEN_CONTRACT_ID_MISMATCH"
  | "SOURCE_BASELINE_MISMATCH"
  | "PROJECTION_MISMATCH"
  | "HASH_MISMATCH"

export class ExecutableReleaseLoadError extends Error {
  constructor(readonly code: ExecutableReleaseLoadErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.name = "ExecutableReleaseLoadError"
  }
}

export type ExecutableReleaseVerificationOptions = Readonly<{
  expectedProjection: ExecutableContract
  expectedReleaseId?: string
  requirePackageIdentity?: boolean
}>

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string) {
  const actual = Object.keys(value).sort()
  const required = [...expected].sort()
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new ExecutableReleaseLoadError("RELEASE_SHAPE_INVALID", `${path} must contain exactly: ${required.join(", ")}.`)
  }
}

function failShape(message: string): never {
  throw new ExecutableReleaseLoadError("RELEASE_SHAPE_INVALID", message)
}

function canonicalJsonValue(value: unknown, path = "$", seen = new WeakSet<object>()): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failShape(`${path} contains a non-finite number.`)
    return JSON.stringify(value)
  }
  if (typeof value !== "object") failShape(`${path} contains an unsupported value.`)
  if (seen.has(value)) failShape(`${path} contains a cycle.`)
  seen.add(value)
  if (Array.isArray(value)) {
    const serialized = `[${value.map((entry, index) => canonicalJsonValue(entry, `${path}[${index}]`, seen)).join(",")}]`
    seen.delete(value)
    return serialized
  }
  const entries = Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJsonValue(child, `${path}.${key}`, seen)}`)
  seen.delete(value)
  return `{${entries.join(",")}}`
}

/** Serializes the hash-free release payload with sorted object keys. */
export function canonicalExecutableReleasePayload(payload: ExecutableReleasePayload): string {
  return canonicalJsonValue(payload)
}

/** Computes the release hash from the canonical payload, never including sha256. */
export function hashExecutableReleasePayload(payload: ExecutableReleasePayload): string {
  return createHash("sha256").update(canonicalExecutableReleasePayload(payload), "utf8").digest("hex")
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object") return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  for (const key of Reflect.ownKeys(object)) deepFreeze((object as Record<PropertyKey, unknown>)[key], seen)
  return Object.freeze(value)
}

function payloadForProjection(projection: ExecutableContract, releaseId: string): ExecutableReleasePayload {
  return {
    documentSchemaVersion: 1,
    packageIdentity: null,
    implementationInputs: [],
    releaseId,
    projectionSchemaVersion: projection.schemaVersion,
    componentContractSetId: projection.componentContractSetId,
    tokenContractId: projection.tokenContractId,
    sourceBaselines: {
      componentContract: projection.sourceBaselineCommit,
      tokenContract: projection.tokenSourceBaselineCommit,
    },
    projection,
  }
}

export function createExecutableRelease(source: ExecutableContractSource, releaseId = EXECUTABLE_RELEASE_ID, identity?: { packageIdentity: PackageIdentity; implementationInputs: readonly ImplementationInput[] }): ExecutableRelease {
  const payload = { ...payloadForProjection(projectExecutableContract(source), releaseId), ...identity }
  return deepFreeze(structuredClone({ ...payload, sha256: hashExecutableReleasePayload(payload) }))
}

function requireString(record: JsonRecord, key: string, path: string): string {
  if (typeof record[key] !== "string") failShape(`${path}.${key} must be a string.`)
  return record[key] as string
}

function requireProjection(value: unknown): ExecutableContract {
  if (!isRecord(value)) failShape("$.projection must be an object.")
  return value as unknown as ExecutableContract
}

/** Verifies and deep-freezes a release payload against its approved projection. */
export function loadExecutableRelease(raw: unknown, options: ExecutableReleaseVerificationOptions): ExecutableRelease {
  if (!isRecord(raw)) failShape("Release must be an object.")
  exactKeys(raw, ["documentSchemaVersion", "packageIdentity", "implementationInputs", "releaseId", "projectionSchemaVersion", "componentContractSetId", "tokenContractId", "sourceBaselines", "projection", "sha256"], "Release")

  if (raw.documentSchemaVersion !== 1) failShape("Unsupported release document schema.")
  if (raw.packageIdentity === null) {
    if (options.requirePackageIdentity) failShape("Canonical release requires package identity.")
  } else {
    if (!isRecord(raw.packageIdentity)) failShape("Package identity must be an object.")
    exactKeys(raw.packageIdentity, ["name", "version", "publicEntrypoints"], "Package identity")
    for (const key of ["name", "version"]) if (!requireString(raw.packageIdentity, key, "Package identity")) failShape("Empty package identity.")
    if (!isRecord(raw.packageIdentity.publicEntrypoints) || !Object.keys(raw.packageIdentity.publicEntrypoints).length) failShape("Package entrypoints required.")
    for (const [key, target] of Object.entries(raw.packageIdentity.publicEntrypoints)) {
      if (key !== "." && !key.startsWith("./")) failShape("Invalid public entrypoint.")
      const targets = typeof target === "string" ? [target] : isRecord(target) ? Object.values(target) : []
      if (!targets.length || targets.some(value => typeof value !== "string" || !value.startsWith("./dist-library/") || value.includes("..\/"))) failShape("Invalid entrypoint target.")
    }
  }
  if (!Array.isArray(raw.implementationInputs)) failShape("Implementation inputs must be an array.")
  let previous = ""
  for (const entry of raw.implementationInputs) {
    if (!isRecord(entry)) failShape("Invalid implementation input.")
    exactKeys(entry, ["path", "gitBlob", "sha256"], "Implementation input")
    const file = requireString(entry, "path", "Implementation input")
    if (!file || file <= previous || file.startsWith("/") || file.includes("\\") || file.split("/").some(part => !part || part === "." || part === "..")) failShape("Input paths must be normalized, unique and sorted.")
    if (/^(provenance\/releases\/|dist-library\/)|\.tgz$|distribution-manifest|acceptance-digest/.test(file)) failShape("Circular identity input.")
    if ((file.startsWith("node_modules/") ? entry.gitBlob !== null : !/^[0-9a-f]{40}$/.test(String(entry.gitBlob))) || !/^[0-9a-f]{64}$/.test(String(entry.sha256))) failShape("Invalid input digest.")
    previous = file
  }
  if (options.requirePackageIdentity && !raw.implementationInputs.length) failShape("Canonical release requires implementation inputs.")

  const expectedReleaseId = options.expectedReleaseId ?? EXECUTABLE_RELEASE_ID
  if (raw.releaseId !== expectedReleaseId) throw new ExecutableReleaseLoadError("RELEASE_ID_MISMATCH", `Expected release ${expectedReleaseId}, received ${String(raw.releaseId)}.`)
  if (raw.projectionSchemaVersion !== options.expectedProjection.schemaVersion) throw new ExecutableReleaseLoadError("PROJECTION_SCHEMA_MISMATCH", "Release projection schema version does not match the approved projection.")
  if (raw.componentContractSetId !== options.expectedProjection.componentContractSetId) throw new ExecutableReleaseLoadError("COMPONENT_CONTRACT_ID_MISMATCH", "Release component-contract identity does not match the approved projection.")
  if (raw.tokenContractId !== options.expectedProjection.tokenContractId) throw new ExecutableReleaseLoadError("TOKEN_CONTRACT_ID_MISMATCH", "Release token-contract identity does not match the approved projection.")

  if (!isRecord(raw.sourceBaselines)) failShape("$.sourceBaselines must be an object.")
  exactKeys(raw.sourceBaselines, ["componentContract", "tokenContract"], "$.sourceBaselines")
  if (raw.sourceBaselines.componentContract !== options.expectedProjection.sourceBaselineCommit || raw.sourceBaselines.tokenContract !== options.expectedProjection.tokenSourceBaselineCommit) {
    throw new ExecutableReleaseLoadError("SOURCE_BASELINE_MISMATCH", "Release source baselines do not match the approved projection.")
  }

  const projection = requireProjection(raw.projection)
  if (canonicalJsonValue(projection, "$.projection") !== canonicalJsonValue(options.expectedProjection, "$.expectedProjection")) {
    throw new ExecutableReleaseLoadError("PROJECTION_MISMATCH", "Release projection does not match the approved executable projection.")
  }

  const sha256 = requireString(raw, "sha256", "Release")
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new ExecutableReleaseLoadError("HASH_MISMATCH", "Release sha256 must be a lowercase SHA-256 digest.")
  const { sha256: _sha256, ...payload } = raw
  if (hashExecutableReleasePayload(payload as unknown as ExecutableReleasePayload) !== sha256) {
    throw new ExecutableReleaseLoadError("HASH_MISMATCH", "Release sha256 does not match the canonical hash-free payload.")
  }

  return deepFreeze(structuredClone(raw as unknown as ExecutableRelease))
}
