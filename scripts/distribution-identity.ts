import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { sha256 } from "./release-inputs"

export type PackedFile = { path: string; size: number; sha256: string }
export type BuildToolchain = { node: string; npm: string; platform: string; arch: string; tools: Record<string, string> }
type ReleaseIdentity = { releaseId: string; sha256: string; packageIdentity: { name: string; version: string } | null }
export type DistributionManifest = {
  schemaVersion: 1
  release: { id: string; payloadSha256: string }
  package: { name: string; version: string }
  toolchain: BuildToolchain
  tarball: { filename: string; sha256: string; integrity: string }
  files: PackedFile[]
}
const integrity = (bytes: Buffer) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`
const fail = (code: string): never => { throw new Error(code) }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`
  return JSON.stringify(value)
}
const equal = (left: unknown, right: unknown) => stable(left) === stable(right)

/** Parse tar bytes directly, never trusting npm's reported file inventory or extracting paths. */
export function packedInventory(tarball: Buffer): PackedFile[] {
  const tar = gunzipSync(tarball, { maxOutputLength: 128 * 1024 * 1024 })
  const files: PackedFile[] = []
  const seen = new Set<string>()
  const string = (data: Buffer) => data.toString("utf8").replace(/\0.*$/s, "")
  const octal = (data: Buffer) => { const value = string(data).trim(); if (!/^[0-7]+$/.test(value)) fail("TAR_NUMBER_INVALID"); return parseInt(value, 8) }
  let offset = 0
  let pax: Record<string, string> = {}
  let ended = false
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      if (tar.length - offset < 1024 || !tar.subarray(offset).every(byte => byte === 0)) fail("TAR_TRAILING_DATA")
      ended = true; break
    }
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0)
    if (checksum !== octal(header.subarray(148, 156))) fail("TAR_CHECKSUM_INVALID")
    const size = octal(header.subarray(124, 136))
    const type = string(header.subarray(156, 157))
    const prefix = string(header.subarray(345, 500))
    const name = `${prefix ? `${prefix}/` : ""}${string(header.subarray(0, 100))}`
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (body.length !== size) fail("TAR_TRUNCATED")
    offset += 512 + Math.ceil(size / 512) * 512
    if (type === "x") {
      if (Object.keys(pax).length) fail("TAR_REPEATED_PAX")
      let position = 0
      while (position < body.length) {
        const space = body.indexOf(32, position)
        const length = Number(body.subarray(position, space).toString())
        if (space < 0 || !Number.isSafeInteger(length) || length <= space - position + 1 || position + length > body.length || body[position + length - 1] !== 10) fail("TAR_PAX_INVALID")
        const record = body.subarray(space + 1, position + length - 1).toString("utf8")
        const equals = record.indexOf("=")
        if (equals < 1 || Object.hasOwn(pax, record.slice(0, equals))) fail("TAR_PAX_INVALID")
        pax[record.slice(0, equals)] = record.slice(equals + 1)
        position += length
      }
      continue
    }
    if (type !== "0" && type !== "") fail("TAR_NON_REGULAR_ENTRY")
    if (pax.size !== undefined && Number(pax.size) !== size) fail("TAR_PAX_SIZE_INVALID")
    const full = pax.path ?? name
    if (!full.startsWith("package/") || full.includes("\\") || full.split("/").some(part => !part || part === "." || part === "..")) fail("TAR_PATH_INVALID")
    const file = full.slice("package/".length)
    if (seen.has(file)) fail("TAR_DUPLICATE_PATH")
    if (/distribution-manifest|\.tgz$|acceptance-digest/.test(file)) fail("DISTRIBUTION_MANIFEST_MUST_BE_EXTERNAL")
    seen.add(file); files.push({ path: file, size, sha256: sha256(body) }); pax = {}
  }
  if (!ended || Object.keys(pax).length || !seen.has("package.json")) fail("TAR_INCOMPLETE")
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

export function generateDistributionManifest(input: { release: ReleaseIdentity; toolchain: BuildToolchain; tarballFilename: string; tarballBytes: Buffer }): DistributionManifest {
  if (!input.release.packageIdentity) fail("PACKAGE_IDENTITY_REQUIRED")
  if (!/^[a-zA-Z0-9_.-]+\.tgz$/.test(input.tarballFilename)) fail("TARBALL_FILENAME_INVALID")
  return {
    schemaVersion: 1,
    release: { id: input.release.releaseId, payloadSha256: input.release.sha256 },
    package: { name: input.release.packageIdentity!.name, version: input.release.packageIdentity!.version },
    toolchain: input.toolchain,
    tarball: { filename: input.tarballFilename, sha256: sha256(input.tarballBytes), integrity: integrity(input.tarballBytes) },
    files: packedInventory(input.tarballBytes),
  }
}

export function verifyDistributionManifest(input: { manifestBytes: Buffer; expectedManifestSha256: string; tarballBytes: Buffer; tarballFilename: string; release: ReleaseIdentity; toolchain: BuildToolchain; expectedInventory: readonly PackedFile[] }): DistributionManifest {
  if (!/^[0-9a-f]{64}$/.test(input.expectedManifestSha256)) fail("MANIFEST_ANCHOR_REQUIRED")
  if (sha256(input.manifestBytes) !== input.expectedManifestSha256) fail("MANIFEST_HASH_MISMATCH")
  const manifest = JSON.parse(input.manifestBytes.toString("utf8")) as DistributionManifest
  if (!manifest || !equal(Object.keys(manifest).sort(), ["files", "package", "release", "schemaVersion", "tarball", "toolchain"]) || manifest.schemaVersion !== 1) fail("MANIFEST_SCHEMA_INVALID")
  if (!equal(manifest.release, { id: input.release.releaseId, payloadSha256: input.release.sha256 })) fail("RELEASE_IDENTITY_MISMATCH")
  if (!equal(manifest.package, { name: input.release.packageIdentity?.name, version: input.release.packageIdentity?.version })) fail("PACKAGE_IDENTITY_MISMATCH")
  if (!equal(manifest.toolchain, input.toolchain)) fail("TOOLCHAIN_IDENTITY_MISMATCH")
  if (!equal(manifest.tarball, { filename: input.tarballFilename, sha256: sha256(input.tarballBytes), integrity: integrity(input.tarballBytes) })) fail("TARBALL_HASH_MISMATCH")
  const inventory = packedInventory(input.tarballBytes)
  if (!equal(manifest.files, inventory)) fail("PACKED_FILE_HASH_MISMATCH")
  if (!equal(inventory, input.expectedInventory)) fail("BUILD_INVENTORY_MISMATCH")
  return manifest
}
