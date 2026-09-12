import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { generateDistributionManifest, packedInventory, verifyDistributionManifest } from "../scripts/distribution-identity"

const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex")
const release = { releaseId: "shadcn-radix-release-001", sha256: "a".repeat(64), packageIdentity: { name: "@adc/shadcn-design-system", version: "0.0.0-release.1" } }
const toolchain = { node: "22.18.0", npm: "10.9.3", platform: process.platform, arch: process.arch, tools: { vite: "7.3.6", typescript: "5.5.4" } }
const r4ArtifactDirectory = "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004"
let directory: string
let tarball: Buffer
let manifest: any
let inventory: any
function pack() {
  const result = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json"], { cwd: directory, encoding: "utf8" }))[0]
  return readFileSync(path.join(directory, result.filename))
}
function verify(candidate: any = manifest, bytes = tarball, anchor = digest(JSON.stringify(candidate))) {
  return verifyDistributionManifest({ manifestBytes: Buffer.from(JSON.stringify(candidate)), expectedManifestSha256: anchor, tarballBytes: bytes, tarballFilename: "adc-shadcn-design-system-0.0.0-release.1.tgz", release, toolchain, expectedInventory: inventory })
}
beforeAll(() => {
  directory = mkdtempSync(path.join(tmpdir(), "distribution-identity-"))
  mkdirSync(path.join(directory, "dist-library"))
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: release.packageIdentity.name, version: release.packageIdentity.version, files: ["dist-library"] }))
  for (const [file, text] of Object.entries({ "index.js": "export const value = 1", "styles.css": "body {}", "index.d.ts": "export declare const value: number", "release.js": "export const release = {}" })) writeFileSync(path.join(directory, "dist-library", file), text)
  tarball = pack()
  inventory = packedInventory(tarball)
  manifest = generateDistributionManifest({ release, toolchain, tarballFilename: "adc-shadcn-design-system-0.0.0-release.1.tgz", tarballBytes: tarball })
}, 30_000)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

describe("external distribution identity", () => {
  test("retains the generated R4 manifest as the exact external candidate identity", () => {
    const manifestPath = path.join(r4ArtifactDirectory, "distribution-manifest.json")
    expect(readFileSync(manifestPath, "utf8")).toBe(readFileSync(path.join(process.cwd(), "provenance/distributions/shadcn-radix-release-004.distribution.json"), "utf8"))
  })
  test("records the sorted actual packed-file inventory, tarball hash and npm integrity", () => {
    expect(inventory.map((entry: any) => entry.path)).toEqual(["dist-library/index.d.ts", "dist-library/index.js", "dist-library/release.js", "dist-library/styles.css", "package.json"])
    expect(inventory.find((entry: any) => entry.path === "dist-library/styles.css")).toEqual({ path: "dist-library/styles.css", size: 7, sha256: digest("body {}") })
    expect(manifest.tarball.sha256).toBe(digest(tarball))
    expect(manifest.tarball.integrity).toBe(`sha512-${createHash("sha512").update(tarball).digest("base64")}`)
    expect(() => verify()).not.toThrow()
  })
  test("requires an externally retained manifest digest", () => {
    expect(() => verify(manifest, tarball, "")).toThrow(/MANIFEST.*(ANCHOR|HASH)/)
  })
  test("rejects manifest changes against the retained digest", () => {
    const forged = structuredClone(manifest); forged.release.payloadSha256 = "b".repeat(64)
    expect(() => verify(forged, tarball, digest(JSON.stringify(manifest)))).toThrow(/MANIFEST_HASH/)
  })
  test("checks the release hash against independently verified release truth", () => {
    const forged = structuredClone(manifest); forged.release.payloadSha256 = "b".repeat(64)
    expect(() => verify(forged)).toThrow(/RELEASE/)
  })
  test.each(["name", "version"])("rejects package %s mismatch", key => {
    const forged = structuredClone(manifest); forged.package[key] = "forged"
    expect(() => verify(forged)).toThrow(/PACKAGE/)
  })
  test("rejects toolchain identity tampering", () => {
    const forged = structuredClone(manifest); forged.toolchain.npm = "0.0.0"
    expect(() => verify(forged)).toThrow(/TOOLCHAIN/)
  })
  test("rejects changed tarball bytes", () => {
    const bytes = Buffer.from(tarball); bytes[20] ^= 1
    expect(() => verify(manifest, bytes)).toThrow(/TARBALL_HASH/)
  })
  test("rejects packed-file hash mismatch even with an updated manifest anchor", () => {
    const forged = structuredClone(manifest); forged.files[0].sha256 = "0".repeat(64)
    expect(() => verify(forged)).toThrow(/PACKED_FILE/)
  })
  test.each(["index.js", "styles.css", "index.d.ts", "release.js"])("rejects tampered %s even when all candidate hashes were regenerated", file => {
    const full = path.join(directory, "dist-library", file); const previous = readFileSync(full)
    try {
      writeFileSync(full, Buffer.concat([previous, Buffer.from("\n/* tampered */")]))
      const changed = pack()
      const forged = generateDistributionManifest({ release, toolchain, tarballFilename: manifest.tarball.filename, tarballBytes: changed })
      expect(() => verify(forged, changed)).toThrow(/BUILD_INVENTORY/)
    } finally { writeFileSync(full, previous) }
  })
  test("rejects an external manifest accidentally included in the package", () => {
    const full = path.join(directory, "dist-library/distribution-manifest.json")
    try {
      writeFileSync(full, "{}")
      expect(() => generateDistributionManifest({ release, toolchain, tarballFilename: manifest.tarball.filename, tarballBytes: pack() })).toThrow(/EXTERNAL/)
    } finally { rmSync(full) }
  })
  test("rejects duplicate or unsorted inventory, omitted files, and extra fields", () => {
    for (const mutate of [
      (value: any) => value.files.reverse(),
      (value: any) => value.files.pop(),
      (value: any) => value.files.push(value.files[0]),
      (value: any) => { value.unreviewed = true },
    ]) {
      const forged = structuredClone(manifest); mutate(forged)
      expect(() => verify(forged)).toThrow()
    }
  })
})
