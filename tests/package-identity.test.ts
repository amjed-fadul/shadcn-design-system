import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "vitest"
import { createImplementationManifest, verifyImplementationManifest, assertReachedInputs, packageIdentity, verifyRepositoryRelease } from "../scripts/release-inputs"
import { hashExecutableReleasePayload } from "../src/validator/release"

const root = process.cwd()
const temporary: string[] = []
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "release-input-test-")); temporary.push(directory)
  const put = (file: string, text: string) => { mkdirSync(path.dirname(path.join(directory, file)), { recursive: true }); writeFileSync(path.join(directory, file), text) }
  put("package.json", JSON.stringify({ name: "@adc/shadcn-design-system", version: "0.0.0-release.2", exports: { ".": { import: "./dist-library/index.js" }, "./styles.css": "./dist-library/styles.css", "./release": { import: "./dist-library/release.js" } } }))
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
  test.each(["vite.library.config.ts", "scripts/release-inputs.ts"])("a real producer build rejects an omitted runtime input read by %s", injectionFile => {
    const directory = mkdtempSync(path.join(tmpdir(), "release-build-coverage-")); temporary.push(directory)
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-002.json"), "utf8"))
    for (const entry of raw.implementationInputs) {
      if (entry.path.startsWith("node_modules/")) continue
      const destination = path.join(directory, entry.path)
      mkdirSync(path.dirname(destination), { recursive: true })
      cpSync(path.join(root, entry.path), destination)
    }
    symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir")
    const config = path.join(directory, injectionFile)
    writeFileSync(config, readFileSync(config, "utf8") + '\nreadFileSync(path.join(process.cwd(), "unlisted-build-data.json"), "utf8")\n')
    writeFileSync(path.join(directory, "unlisted-build-data.json"), "{}")
    mkdirSync(path.join(directory, "provenance/releases"), { recursive: true })
    writeFileSync(path.join(directory, "provenance/releases/shadcn-radix-release-002.json"), JSON.stringify(raw))
    raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw
    raw.sha256 = hashExecutableReleasePayload(payload)
    mkdirSync(path.join(directory, "provenance/releases"), { recursive: true })
    writeFileSync(path.join(directory, "provenance/releases/shadcn-radix-release-002.json"), JSON.stringify(raw))
    try {
      execFileSync(process.execPath, ["scripts/build-library.mjs"], { cwd: directory, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024, stdio: "pipe" })
      throw new Error("Build unexpectedly accepted the omitted input")
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr)).toMatch(/UNBOUND_INPUT: unlisted-build-data.json/)
    }
  }, 130_000)
  test("excludes release and output identities without overlooking authority data", () => {
    const { directory, put } = fixture()
    for (const file of ["provenance/releases/shadcn-radix-release-002.json", "dist-library/index.js", "candidate.tgz", "distribution-manifest.json"]) put(file, "{}")
    const paths = createImplementationManifest(directory).map(entry => entry.path)
    expect(paths).not.toContain("provenance/releases/shadcn-radix-release-002.json")
    expect(paths.some(file => /dist-library|\.tgz$|distribution-manifest/.test(file))).toBe(false)
    expect(paths).toContain("contracts/tokens/token-contract.json")
  })
  test("rejects circular identity entries even when their release hash is recomputed", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-002.json"), "utf8"))
    raw.packageIdentity = packageIdentity(directory)
    for (const file of ["provenance/releases/shadcn-radix-release-002.json", "dist-library/index.js", "candidate.tgz", "distribution-manifest.json"]) {
      raw.implementationInputs = [{ path: file, gitBlob: "a".repeat(40), sha256: "b".repeat(64) }]
      const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
      put("provenance/releases/shadcn-radix-release-002.json", JSON.stringify(raw))
      expect(() => verifyRepositoryRelease(directory)).toThrow(/Circular/)
    }
  })
  test("an independently retained release digest rejects coordinated source and release refresh", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-002.json"), "utf8"))
    const expectedDigest = raw.sha256
    put("src/shared.ts", "export const value = 99")
    raw.packageIdentity = packageIdentity(directory); raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
    put("provenance/releases/shadcn-radix-release-002.json", JSON.stringify(raw))
    expect(() => verifyRepositoryRelease(directory, expectedDigest)).toThrow(/RELEASE_ANCHOR/)
  })
  test("allows immutable release history beside the active release-002", () => {
    const { directory, put } = fixture()
    const raw = JSON.parse(readFileSync(path.join(root, "provenance/releases/shadcn-radix-release-002.json"), "utf8"))
    raw.packageIdentity = packageIdentity(directory); raw.implementationInputs = createImplementationManifest(directory)
    const { sha256: _hash, ...payload } = raw; raw.sha256 = hashExecutableReleasePayload(payload)
    put("provenance/releases/shadcn-radix-release-002.json", JSON.stringify(raw))
    put("provenance/releases/shadcn-radix-release-001.json", "{}")
    expect(verifyRepositoryRelease(directory).releaseId).toBe("shadcn-radix-release-002")
  })
  test("maps the approved package name, version and exact public entrypoints", () => {
    expect(packageIdentity(root)).toEqual({ name: "@adc/shadcn-design-system", version: "0.0.0-release.2", publicEntrypoints: JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).exports })
  })
  test("canonical release binds all 20 components, shared utilities, mobile hook and build inputs", () => {
    const release = verifyRepositoryRelease(root)
    const paths = release.implementationInputs!.map(entry => entry.path)
    expect(paths.filter(file => /^src\/components\/ui\/.*\.tsx$/.test(file))).toHaveLength(20)
    expect(paths).toEqual(expect.arrayContaining(["src/lib/utils.ts", "src/hooks/use-mobile.ts", "src/index.css", "scripts/library-data.ts", "scripts/build-library.mjs", "vite.library.config.ts", "tsconfig.library.json", "package-lock.json", "components.json"]))
    expect(release.documentSchemaVersion).toBe(1)
    expect(release.packageIdentity).toEqual(packageIdentity(root))
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
