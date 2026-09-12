import { createHash } from "node:crypto"
import { execFile, execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { afterEach, describe, expect, test } from "vitest"
import { createImplementationManifest, verifyImplementationManifest, assertReachedInputs, packageIdentity, verifyRepositoryRelease } from "../scripts/release-inputs"
import { hashExecutableReleasePayload } from "../src/validator/release"
import { loadExecutableRelease } from "../src/validator/release"

const root = process.cwd()
const temporary: string[] = []
const r3ArtifactDirectory = process.env.ADC_R3_ARTIFACT_DIRECTORY ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-003"
const r3Tarball = path.join(r3ArtifactDirectory, "adc-shadcn-design-system-0.0.0-release.3.tgz")
const r4ArtifactDirectory = "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004"
const r4DistributionManifest = path.join(r4ArtifactDirectory, "distribution-manifest.json")
const r3TarballSha256 = "bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629"
const r3PayloadSha256 = "5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b"
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "release-input-test-")); temporary.push(directory)
  const put = (file: string, text: string) => { mkdirSync(path.dirname(path.join(directory, file)), { recursive: true }); writeFileSync(path.join(directory, file), text) }
  put("package.json", JSON.stringify({ name: "@adc/shadcn-design-system", version: "0.0.0-release.3", exports: { ".": { import: "./dist-library/index.js" }, "./styles.css": "./dist-library/styles.css", "./release": { import: "./dist-library/release.js" } } }))
  put("package-lock.json", "{}")
  put("components.json", "{}")
  put("tsconfig.json", JSON.stringify({ compilerOptions: { moduleResolution: "Bundler", module: "ESNext" } }))
  put("tsconfig.library.json", JSON.stringify({ extends: "./tsconfig.json", include: ["src/package/index.ts"] }))
  put("src/package/index.ts", 'export { value } from "../shared"')
  put("src/shared.ts", "export const value = 1")
  put("src/index.css", "body {}")
  put("vite.library.config.ts", "export default {}")
  put("scripts/build-library.mjs", "export {}")
  put("scripts/generate-executable-release.ts", "export {}")
  put("contracts/components/component-contract-set.json", "{}")
  put("contracts/tokens/token-contract.json", "{}")
  put("provenance/baseline.json", "{}")
  return { directory, put }
}
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }) })

async function readR3ArchiveIdentity(tarball = r3Tarball) {
  const releaseSource = execFileSync("tar", ["-xOf", tarball, "package/dist-library/release.js"], { maxBuffer: 16 * 1024 * 1024 })
  const directory = mkdtempSync(path.join(tmpdir(), "r3-release-inspection-")); temporary.push(directory)
  const releasePath = path.join(directory, "release.mjs")
  writeFileSync(releasePath, releaseSource)
  const library = await import(/* @vite-ignore */ `${pathToFileURL(releasePath).href}?inspection=${Date.now()}`)
  const release = library.getExecutableRelease()
  const { sha256: _sha256, ...payload } = release
  return {
    tarballSha256: createHash("sha256").update(readFileSync(tarball)).digest("hex"),
    payloadSha256: hashExecutableReleasePayload(payload),
  }
}

const sha512 = (bytes: Buffer) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`
const runFile = promisify(execFile)

describe("release package input identity", () => {
  test("discovers imports and sorts normalized paths deterministically with byte identities", () => {
    const { directory, put } = fixture()
    put("src/z.ts", "export const z = 1")
    put("src/a.ts", "export const a = 1")
    put("src/shared.ts", 'export * from "./z"; export * from "./a"')
    const manifest = createImplementationManifest(directory)
    const paths = manifest.map(entry => entry.path)
    expect(paths).toEqual([...paths].sort())
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toEqual(expect.arrayContaining(["src/a.ts", "src/z.ts", "src/shared.ts", "src/package/index.ts", "src/index.css"]))
    expect(manifest.find(entry => entry.path === "src/z.ts")).toEqual({ path: "src/z.ts", gitBlob: createHash("sha1").update("blob 18\0export const z = 1").digest("hex"), sha256: createHash("sha256").update("export const z = 1").digest("hex") })
    expect(createImplementationManifest(directory)).toEqual(manifest)
  })
  test.each(["src/shared.ts", "src/index.css", "vite.library.config.ts", "package.json", "package-lock.json", "tsconfig.library.json", "contracts/tokens/token-contract.json"])("rejects frozen input drift in %s", file => {
    const { directory, put } = fixture(); const expected = createImplementationManifest(directory)
    put(file, readFileSync(path.join(directory, file), "utf8") + "\n")
    expect(() => verifyImplementationManifest(directory, expected)).toThrow(/INPUT/)
  })
  test("discovers and freezes the complete CSS import/font chain and package resolution metadata", () => {
    const { directory, put } = fixture()
    put("src/index.css", '@import "style-package";')
    put("node_modules/style-package/package.json", JSON.stringify({ exports: { ".": { style: "./theme.css" } } }))
    put("node_modules/style-package/theme.css", '@import "./base.css"; @font-face { src: url(./font.woff2) }')
    put("node_modules/style-package/base.css", "body {}")
    put("node_modules/style-package/font.woff2", "font bytes")
    const expected = createImplementationManifest(directory)
    expect(expected.map(entry => entry.path)).toEqual(expect.arrayContaining(["node_modules/style-package/package.json", "node_modules/style-package/theme.css", "node_modules/style-package/base.css", "node_modules/style-package/font.woff2"]))
    expect(expected.find(entry => entry.path.endsWith("font.woff2"))!.gitBlob).toBeNull()
    put("node_modules/style-package/font.woff2", "tampered")
    expect(() => verifyImplementationManifest(directory, expected)).toThrow(/INPUT_DRIFT/)
  })
  test("includes installed CSS/compiler evidence referenced by provenance outside CSS imports", () => {
    const { directory, put } = fixture()
    put("provenance/token-contract-source.json", JSON.stringify({ sources: { theme: { path: "node_modules/compiler/theme.css" }, compiler: { path: "node_modules/compiler/lib.mjs" } } }))
    put("node_modules/compiler/theme.css", "body {}")
    put("node_modules/compiler/lib.mjs", "export {}")
    expect(createImplementationManifest(directory).map(entry => entry.path)).toEqual(expect.arrayContaining(["node_modules/compiler/theme.css", "node_modules/compiler/lib.mjs"]))
  })
  test("rejects a newly reached import even if the importer digest was refreshed", () => {
    const { directory, put } = fixture(); const old = createImplementationManifest(directory)
    put("src/new.ts", "export const added = true")
    put("src/shared.ts", 'export * from "./new"')
    const refreshed = createImplementationManifest(directory).filter(entry => old.some(previous => previous.path === entry.path))
    expect(() => verifyImplementationManifest(directory, refreshed)).toThrow(/INPUT.*(missing|set)/i)
  })
  test("permits only the intentional React runtime externals in build module reports", () => {
    const { directory } = fixture(); const manifest = createImplementationManifest(directory)
    expect(() => assertReachedInputs(directory, manifest, ["react", "react-dom", "react/jsx-runtime", "react-dom/client"])).not.toThrow()
    expect(() => assertReachedInputs(directory, manifest, ["unapproved-runtime"])).toThrow(/UNBOUND_INPUT/)
  })
  test("recognizes only explicitly declared fresh build scratch paths as generated reads", () => {
    const { directory } = fixture(); const manifest = createImplementationManifest(directory)
    const scratch = path.join(directory, "generated-scratch")
    expect(() => assertReachedInputs(directory, manifest, [path.join(scratch, "esbuild.code")], [scratch])).not.toThrow()
    expect(() => assertReachedInputs(directory, manifest, [path.join(directory, "other/esbuild.code")], [scratch])).toThrow(/UNBOUND_INPUT/)
  })
  test("actual build reads fail closed for omitted dynamic data", () => {
    const { directory, put } = fixture(); const manifest = createImplementationManifest(directory)
    put("build-data/extra.json", "{}")
    expect(() => assertReachedInputs(directory, manifest, [path.join(directory, "build-data/extra.json")])).toThrow(/UNBOUND_INPUT/)
  })
  test("observes synchronous, promise and callback reads before enforcing coverage", async () => {
    const { directory, put } = fixture(); const manifest = createImplementationManifest(directory)
    put("dynamic/unknown.json", "{}")
    for (const file of ["open-sync.json", "open-promise.json", "open-callback.json", "stream.json"]) put(`dynamic/${file}`, "{}")
    const guard = await import(/* @vite-ignore */ path.join(root, "scripts/build-input-guard.mjs"))
    const fs = await import("node:fs")
    const observer = guard.observeBuildReads()
    try {
      readFileSync(path.join(directory, "dynamic/unknown.json"))
      await fs.promises.readFile(path.join(directory, "src/shared.ts"))
      const descriptor = fs.openSync(path.join(directory, "dynamic/open-sync.json"), "r"); fs.closeSync(descriptor)
      await new Promise<void>((resolve, reject) => fs.open(path.join(directory, "dynamic/open-callback.json"), (error, descriptor) => { if (error) reject(error); else { fs.closeSync(descriptor); resolve() } }))
      const handle = await fs.promises.open(path.join(directory, "dynamic/open-promise.json"), "r"); await handle.close()
      for await (const _chunk of fs.createReadStream(path.join(directory, "dynamic/stream.json"))) { /* consume real stream */ }
      await new Promise<void>((resolve, reject) => fs.readFile(path.join(directory, "package.json"), error => error ? reject(error) : resolve()))
    } finally { observer.restore() }
    expect([...observer.reads]).toEqual(expect.arrayContaining([path.join(directory, "dynamic/unknown.json"), path.join(directory, "dynamic/open-sync.json"), path.join(directory, "dynamic/open-callback.json"), path.join(directory, "dynamic/open-promise.json"), path.join(directory, "dynamic/stream.json"), path.join(directory, "src/shared.ts"), path.join(directory, "package.json")]))
    expect(() => assertReachedInputs(directory, manifest, [...observer.reads])).toThrow(/UNBOUND_INPUT/)
  })
  test.each(["vite.library.config.ts", "scripts/release-inputs.ts"])("a real producer build rejects an omitted runtime input read by %s", async injectionFile => {
    const directory = mkdtempSync(path.join(tmpdir(), "release-build-coverage-")); temporary.push(directory)
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-003.json"), "utf8"))
    for (const entry of raw.implementationInputs) {
      if (entry.path.startsWith("node_modules/")) continue
      const destination = path.join(directory, entry.path)
      mkdirSync(path.dirname(destination), { recursive: true })
      writeFileSync(destination, execFileSync("git", ["cat-file", "blob", entry.gitBlob], { cwd: root }))
    }
    symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir")
    const config = path.join(directory, injectionFile)
    writeFileSync(config, readFileSync(config, "utf8") + '\nreadFileSync(path.join(process.cwd(), "unlisted-build-data.json"), "utf8")\n')
    writeFileSync(path.join(directory, "unlisted-build-data.json"), "{}")
    mkdirSync(path.join(directory, "provenance/releases"), { recursive: true })
    writeFileSync(path.join(directory, "provenance/releases/shadcn-radix-release-003.json"), JSON.stringify(raw))
    raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw
    raw.sha256 = hashExecutableReleasePayload(payload)
    mkdirSync(path.join(directory, "provenance/releases"), { recursive: true })
    writeFileSync(path.join(directory, "provenance/releases/shadcn-radix-release-003.json"), JSON.stringify(raw))
    try {
      await runFile(process.execPath, ["scripts/build-library.mjs"], { cwd: directory, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })
      throw new Error("Build unexpectedly accepted the omitted input")
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toMatch(/UNBOUND_INPUT: unlisted-build-data.json/)
    }
  }, 130_000)
  test("excludes release and output identities without overlooking authority data", () => {
    const { directory, put } = fixture()
    for (const file of ["provenance/releases/shadcn-radix-release-003.json", "dist-library/index.js", "candidate.tgz", "distribution-manifest.json"]) put(file, "{}")
    const paths = createImplementationManifest(directory).map(entry => entry.path)
    expect(paths).not.toContain("provenance/releases/shadcn-radix-release-003.json")
    expect(paths.some(file => /dist-library|\.tgz$|distribution-manifest/.test(file))).toBe(false)
    expect(paths).toContain("contracts/tokens/token-contract.json")
  })
  test("rejects circular identity entries even when their release hash is recomputed", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-003.json"), "utf8"))
    raw.packageIdentity = packageIdentity(directory)
    for (const file of ["provenance/releases/shadcn-radix-release-003.json", "dist-library/index.js", "candidate.tgz", "distribution-manifest.json"]) {
      raw.implementationInputs = [{ path: file, gitBlob: "a".repeat(40), sha256: "b".repeat(64) }]
      const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
      put("provenance/releases/shadcn-radix-release-003.json", JSON.stringify(raw))
      expect(() => verifyRepositoryRelease(directory)).toThrow(/Circular/)
    }
  })
  test("an independently retained release digest rejects coordinated source and release refresh", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-003.json"), "utf8"))
    const expectedDigest = raw.sha256
    put("src/shared.ts", "export const value = 99")
    raw.packageIdentity = packageIdentity(directory); raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
    put("provenance/releases/shadcn-radix-release-003.json", JSON.stringify(raw))
    expect(() => verifyRepositoryRelease(directory, expectedDigest)).toThrow(/RELEASE_ANCHOR/)
  })
  test("allows immutable release history beside the active release-003", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-003.json"), "utf8"))
    raw.packageIdentity = packageIdentity(directory); raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
    put("provenance/releases/shadcn-radix-release-003.json", JSON.stringify(raw))
    put("provenance/releases/shadcn-radix-release-002.json", "{}")
    put("provenance/releases/shadcn-radix-release-001.json", "{}")
    expect(verifyRepositoryRelease(directory).releaseId).toBe("shadcn-radix-release-003")
  })
  test("maps the approved package name, version and exact public entrypoints", () => {
    expect(packageIdentity(root)).toEqual({ name: "@adc/shadcn-design-system", version: "0.0.0-release.4", publicEntrypoints: JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).exports })
  })
  test("preserves the accepted R3 tarball and extracted release payload across release generation", async () => {
    expect(existsSync(r3Tarball)).toBe(true)
    const before = await readR3ArchiveIdentity()
    expect(before).toEqual({ tarballSha256: r3TarballSha256, payloadSha256: r3PayloadSha256 })
    await runFile(process.execPath, [path.join(root, "scripts/run-release-generation.mjs")], { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })
    const after = await readR3ArchiveIdentity()
    expect(after).toEqual(before)
  }, 180_000)
  test("fails closed when the accepted R3 archive is not the retained artifact", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "r3-artifact-override-")); temporary.push(directory)
    const tarball = path.join(directory, path.basename(r3Tarball))
    copyFileSync(r3Tarball, tarball)
    const mutated = Buffer.from(readFileSync(tarball)); mutated[0] ^= 1; writeFileSync(tarball, mutated)
    try {
      await runFile(process.execPath, [path.join(root, "scripts/run-release-generation.mjs")], {
        cwd: root,
        env: { ...process.env, ADC_R3_ARTIFACT_DIRECTORY: directory },
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      })
      throw new Error("R3 override unexpectedly accepted")
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toMatch(/R3_ARTIFACT_MISMATCH.*before/)
    }
  }, 30_000)
  test("candidate verification rejects fresh tarball byte drift even when inventory is unchanged", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "r4-tarball-drift-")); temporary.push(directory)
    const sourceManifest = JSON.parse(readFileSync(r4DistributionManifest, "utf8"))
    const original = readFileSync(path.join(r4ArtifactDirectory, sourceManifest.tarball.filename))
    const forgedTarball = Buffer.from(original); forgedTarball[9] = forgedTarball[9] === 255 ? 0 : forgedTarball[9] + 1
    const tarballPath = path.join(directory, sourceManifest.tarball.filename)
    writeFileSync(tarballPath, forgedTarball)
    sourceManifest.tarball.sha256 = createHash("sha256").update(forgedTarball).digest("hex")
    sourceManifest.tarball.integrity = sha512(forgedTarball)
    const manifestPath = path.join(directory, "distribution-manifest.json")
    const manifestBytes = Buffer.from(`${JSON.stringify(sourceManifest, null, 2)}\n`)
    writeFileSync(manifestPath, manifestBytes)
    try {
      await runFile(process.execPath, [path.join(root, "scripts/package-candidate.mjs"), "verify", "--manifest", manifestPath, "--tarball", tarballPath, "--manifest-sha256", createHash("sha256").update(manifestBytes).digest("hex")], {
        cwd: root,
        encoding: "utf8",
        timeout: 240_000,
        maxBuffer: 16 * 1024 * 1024,
      })
      throw new Error("Fresh tarball byte drift unexpectedly accepted")
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toMatch(/FRESH_TARBALL_(?:BYTES|SHA256|INTEGRITY)_MISMATCH/)
    }
  }, 240_000)
  test("requires a separately identified R4 release, external candidate, and complete handoff", () => {
    const releasePath = path.join(root, "provenance/releases/shadcn-radix-release-004.json")
    const handoffPath = path.join(root, "docs/CANVAS-RELEASE-004.md")
    expect(existsSync(releasePath)).toBe(true)
    expect(existsSync(r4DistributionManifest)).toBe(true)
    expect(existsSync(handoffPath)).toBe(true)
    const release = JSON.parse(readFileSync(releasePath, "utf8"))
    const manifest = JSON.parse(readFileSync(r4DistributionManifest, "utf8"))
    const handoff = readFileSync(handoffPath, "utf8")
    expect(loadExecutableRelease(release, { expectedProjection: release.projection, expectedReleaseId: "shadcn-radix-release-004", requirePackageIdentity: true })).toEqual(release)
    expect(release.packageIdentity).toEqual({
      name: "@adc/shadcn-design-system",
      version: "0.0.0-release.4",
      publicEntrypoints: JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).exports,
    })
    expect(release.projection.exports["sidebar\0SidebarProvider"].component.composition.provides).toEqual(["sidebar.context"])
    expect(release.projection.exports["sidebar\0Sidebar"].component.composition.requires).toEqual(["sidebar.context"])
    expect(manifest.release).toEqual({ id: release.releaseId, payloadSha256: release.sha256 })
    expect(manifest.package).toEqual({ name: release.packageIdentity.name, version: release.packageIdentity.version })
    expect(handoff).toContain("shadcn-radix-release-004")
    expect(handoff).toContain("0.0.0-release.4")
    expect(handoff).toContain(release.sha256)
    expect(handoff).toContain(manifest.tarball.sha256)
    expect(handoff).toContain(manifest.tarball.integrity)
    expect(handoff).toContain(r4ArtifactDirectory)
    expect(handoff).toContain("Source commit: `876ff9cb84caba6b19326bf0c6d08564cc76960d`")
    expect(handoff).toContain("Manifest SHA-256: `b7907b575c362ba36be5faa588a20440138e0714f2db2c9e85c13782ed6c0bd7`")
    expect(handoff).toMatch(/Release 003 unchanged: `true`/)
    expect(handoff).toContain(`Release 003 tarball SHA-256 before: \`${r3TarballSha256}\``)
    expect(handoff).toContain(`Release 003 tarball SHA-256 after: \`${r3TarballSha256}\``)
    expect(handoff).toContain(`Release 003 release.js payload SHA-256 before: \`${r3PayloadSha256}\``)
    expect(handoff).toContain(`Release 003 release.js payload SHA-256 after: \`${r3PayloadSha256}\``)
  })
  test("immutable R3 release records all 20 components, shared utilities, mobile hook and build inputs", () => {
    const release = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-003.json"), "utf8"))
    const paths = release.implementationInputs.map((entry: { path: string }) => entry.path)
    expect(paths.filter((file: string) => /^src\/components\/ui\/.*\.tsx$/.test(file))).toHaveLength(20)
    expect(paths).toEqual(expect.arrayContaining(["src/lib/utils.ts", "src/hooks/use-mobile.ts", "src/index.css", "scripts/library-data.ts", "scripts/build-library.mjs", "vite.library.config.ts", "tsconfig.library.json", "package-lock.json", "components.json"]))
    expect(release.documentSchemaVersion).toBe(1)
    expect(release.packageIdentity).toEqual({ ...packageIdentity(root), version: "0.0.0-release.3" })
  })
  test("retained release-001 preserves the six reviewed ref facts", () => {
    const old = JSON.parse(execFileSync("git", ["show", "765e2d7786142cb3ed9f9ae56ebbc8c5e07614d2:provenance/releases/shadcn-radix-release-001.json"], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))
    const release = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-001.json"), "utf8"))
    const expected = structuredClone(old.projection)
    for (const [family, name] of [["button", "Button"], ["dialog", "DialogTrigger"], ["sidebar", "SidebarMenuButton"], ["sidebar", "SidebarMenuAction"], ["dropdown-menu", "DropdownMenuTrigger"], ["sheet", "SheetTrigger"]]) {
      const slots = expected.exports[`${family}\0${name}`].component.slots
      expect(slots).toHaveLength(1)
      expect(slots[0].refForwarding).toBe("unresolved")
      slots[0].refForwarding = "supported"
    }
    expect(release.projection).toEqual(expected)
    expect(release.projectionSchemaVersion).toBe(old.projectionSchemaVersion)
    expect(release.releaseId).toBe("shadcn-radix-release-001")
    const { sha256, ...payload } = release
    expect(hashExecutableReleasePayload(payload)).toBe(sha256)
  })
})
