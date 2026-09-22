import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import ts from "typescript"
import { createElement, isValidElement } from "react"
import type { TokenContract } from "../src/contracts/tokens/types"
import { hashExecutableReleasePayload } from "../src/validator/release"

const root = fileURLToPath(new URL("../", import.meta.url))
const r3ArtifactDirectory = process.env.ADC_R3_ARTIFACT_DIRECTORY ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-003"
const r3Tarball = path.join(r3ArtifactDirectory, "adc-shadcn-design-system-0.0.0-release.3.tgz")
const r3DistributionManifest = path.join(r3ArtifactDirectory, "distribution-manifest.json")
const r3PayloadSha256 = "5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b"
const r3TarballSha256 = "bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629"
const r4ArtifactDirectory = "/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004"
const r4DistributionManifest = path.join(r4ArtifactDirectory, "distribution-manifest.json")
let r3Extraction = ""
let output = ""
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"))
const contractedExportNames = () => {
  const contractSet = readJson("contracts/components/component-contract-set.json")
  return contractSet.familyFiles.flatMap((file: string) =>
    readJson(file).exports.map((entry: { name: string }) => entry.name)
  )
}

describe("published library entrypoint", () => {
  test("exposes all 205 contracted public exports including Switch", async () => {
    const library = await import("../src/package/index")
    const names = contractedExportNames()
    expect(Object.keys(library).sort()).toEqual(names.sort())
    expect(names).toHaveLength(205)
    expect(Object.hasOwn(library, "Switch")).toBe(true)
    expect(Object.hasOwn(library, "SidebarNormalAppProvider")).toBe(false)
    const sidebar = readJson("contracts/components/families/sidebar.json")
    const provider = sidebar.exports.find((entry: { name: string }) => entry.name === "SidebarProvider").component
    expect(provider.localProps.map((prop: { name: string }) => prop.name)).toEqual(expect.arrayContaining([
      "isMobile", "defaultOpen", "open", "onOpenChange", "defaultOpenMobile", "openMobile", "onOpenMobileChange",
    ]))
    expect(provider.composition.provides).toEqual(["sidebar.context"])
    expect(sidebar.exports.find((entry: { name: string }) => entry.name === "Sidebar").component.composition.requires).toEqual(["sidebar.context"])
  })

  test("typechecks explicit Sidebar inputs through the public source entrypoint", () => {
    const probe = path.join(root, "source-library-type-probe.tsx")
    const source = `
      import { Sidebar, SidebarProvider } from "./src/package/index";
      const sidebar = <SidebarProvider isMobile={false} open={true} onOpenChange={(open: boolean) => open} openMobile={false} onOpenMobileChange={(open: boolean) => open}><Sidebar portalContainer={document.createElement("div")} /></SidebarProvider>;
    `
    const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, types: ["react", "react-dom"], baseUrl: root, paths: { "@/*": ["src/*"] } }
    const host = ts.createCompilerHost(options)
    const originalRead = host.readFile.bind(host)
    host.readFile = (file) => file === probe ? source : originalRead(file)
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([probe], options, host)).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
    expect(diagnostics).toEqual([])
  }, 15_000)
})

describe("immutable Release 003 package artifact verification", () => {
  beforeAll(() => {
    expect(existsSync(r3Tarball)).toBe(true)
    expect(existsSync(r3DistributionManifest)).toBe(true)
    r3Extraction = mkdtempSync(path.join(tmpdir(), "adc-r3-library-"))
    execFileSync("tar", ["-xzf", r3Tarball, "-C", r3Extraction], { stdio: "pipe" })
    const packageRoot = path.join(r3Extraction, "package")
    symlinkSync(path.join(root, "node_modules"), path.join(packageRoot, "node_modules"), "dir")
    output = path.join(packageRoot, "dist-library")
  })

  afterAll(() => {
    if (r3Extraction) rmSync(r3Extraction, { recursive: true, force: true })
  })

  test("anchors the archived R3 package to its immutable release and tarball identities", () => {
    const distribution = JSON.parse(readFileSync(r3DistributionManifest, "utf8"))
    expect(distribution.release).toEqual({ id: "shadcn-radix-release-003", payloadSha256: r3PayloadSha256 })
    expect(distribution.tarball.sha256).toBe(r3TarballSha256)
    expect(createHash("sha256").update(readFileSync(r3Tarball)).digest("hex")).toBe(r3TarballSha256)
  })

  test("exposes every approved component export without exposing internal utilities", async () => {
    const library = await import(/* @vite-ignore */ path.join(output, "index.js"))
    const names = Object.keys(readJson("provenance/releases/shadcn-radix-release-003.json").projection.exports).map((key) => key.split("\0")[1])
    expect(Object.keys(library).sort()).toEqual(names.sort())
    expect(names).toHaveLength(108)
    expect(Object.hasOwn(library, "Switch")).toBe(true)
    expect(isValidElement(createElement(library.Button))).toBe(true)
    expect(library.useSidebar).toBeTypeOf("function")
  })

  test("ships the R3 executable release and frozen contract data", async () => {
    const library = await import(/* @vite-ignore */ path.join(output, "release.js"))
    expect(Object.keys(library).sort()).toEqual(["getComponentContracts", "getExecutableRelease", "getTokenContract"])
    expect(library.getExecutableRelease()).toEqual(readJson("provenance/releases/shadcn-radix-release-003.json"))
    const components = library.getComponentContracts()
    expect(components.contractSet.id).toBe("shadcn-radix-component-contracts-001")
    expect(components.families).toHaveLength(20)
    expect(Object.isFrozen(components.families[0].exports[0])).toBe(true)
    expect(Object.isFrozen(library.getTokenContract().tokens[0].value)).toBe(true)
  })

  test("packages built CSS with tokens, internal utilities, animations, and fonts", () => {
    const css = readFileSync(path.join(output, "styles.css"), "utf8")
    expect(css).not.toMatch(/@(?:import|source|theme|apply|custom-variant)\b/)
    expect(css).not.toMatch(/\/Users\/|node_modules|https?:\/\//)
    expect(css).toContain(".dark")
    expect(css).toContain("data-slot")
    expect(css).toContain("@keyframes accordion-down")
    expect(css).toContain("data:font/woff2;base64,")
    expect(css).toContain("--text-9xl:")
    expect(css).toContain("--font-weight-thin:")
    expect(css).toContain("--radius-4xl:")
    expect(css).toContain("--background:")
    expect(css).toContain("--sidebar:")
    expect(css).not.toContain(".min-h-96") // Storybook-only fixture utility.
    expect(css.match(/--color-(?:red|blue)-\d+:/)).toBeNull()
    expect(css).not.toContain("--font-serif:")
    expect(css).not.toContain("--breakpoint-3xl:")
    const contract = readJson("contracts/tokens/token-contract.json") as TokenContract
    const expected = contract.tokens.flatMap(({ binding }) => [
      binding.cssVariable,
      ...(binding.tailwindThemeVariable ? [binding.tailwindThemeVariable] : []),
      ...Object.values(binding.companionVariables ?? {}),
    ])
    const variables = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]))
    const implementationVariables = [
      // Tailwind preflight defaults and approved component utilities.
      "--font-mono", "--color-black", "--container-sm", "--container-lg", "--animate-pulse",
      "--default-transition-duration", "--default-transition-timing-function",
      "--default-font-family", "--default-mono-font-family",
      // Internal properties supplied by the canonical shadcn CSS import.
      "--shimmer-angle", "--shimmer-image", "--shimmer-text-fill",
      "--scroll-fade-t", "--scroll-fade-b", "--scroll-fade-s", "--scroll-fade-e", "--scroll-fade-mask",
    ]
    // Allow Tailwind's utility machinery, but no extra public theme variables.
    expect([...variables].filter((variable) => !variable.startsWith("--tw-")).sort())
      .toEqual([...new Set([...expected, ...implementationVariables])].sort())
  })

  test("public declarations resolve and reject invalid usage without repository aliases", () => {
    const manifest = JSON.parse(readFileSync(path.join(r3Extraction, "package", "package.json"), "utf8"))
    expect(manifest.version).toBe("0.0.0-release.3")
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./release", "./styles.css"])
    const probe = path.join(r3Extraction, "package", "r3-library-type-probe.tsx")
    const validSource = `
      import { Button, Tabs, DialogContent, SelectContent, SelectTrigger, Sidebar, SidebarProvider } from "./dist-library/types/src/package/index";
      import { getExecutableRelease, getTokenContract } from "./dist-library/types/src/package/release";
      import type { ComponentProps } from "react";
      const button = <Button variant="outline" size="sm">OK</Button>;
      const tabs = <Tabs defaultValue="one" onValueChange={(value: string) => value.toUpperCase()} />;
      const dialog: ComponentProps<typeof DialogContent> = { showCloseButton: false };
      const labeledTrigger = <SelectTrigger id="view" aria-label="View" aria-labelledby="view-label" />;
      // @ts-expect-error inherited native id must be a string
      const invalidTriggerId = <SelectTrigger id={42} />;
      const dialogHost = <DialogContent portalContainer={document.createElement("div")} />;
      const selectFragment = <SelectContent portalContainer={document.createDocumentFragment()} />;
      const dialogDefault = <DialogContent portalContainer={undefined} />;
      const sidebarHost = <SidebarProvider defaultOpen={true} open={true} onOpenChange={(open: boolean) => open}><Sidebar collapsible="icon" /></SidebarProvider>;
      // @ts-expect-error portal containers are DOM objects, never selector strings
      const invalidHost = <SelectContent portalContainer="#page" />;
      const releaseId: string = getExecutableRelease().releaseId;
      const tokenId: string = getTokenContract().tokens[0].id;
      // @ts-expect-error unsupported Button variant must be rejected
      const badButton = <Button variant="invented" />;
      // @ts-expect-error incorrect callback payload must be rejected
      const badTabs = <Tabs onValueChange={(value: number) => value} />;
    `
    const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, types: ["react", "react-dom"] }
    const host = ts.createCompilerHost(options)
    const originalRead = host.readFile.bind(host)
    host.readFile = (file) => file === probe ? validSource : originalRead(file)
    const program = ts.createProgram([probe], options, host)
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
    expect(diagnostics).toEqual([])
    for (const file of program.getSourceFiles().filter((file) => file.fileName.startsWith(output))) {
      expect(file.text).not.toMatch(/(?:from\s*|import\()["']@\//)
    }
  })

  test("every emitted JavaScript chunk has only React runtime externals", () => {
    for (const name of readdirSync(output).filter((file) => file.endsWith(".js"))) {
      const text = readFileSync(path.join(output, name), "utf8")
      expect(text.match(/node:|__vite-browser-external|\/Users\/|react\.production\.min|react\.development/)).toBeNull()
      const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
        const specifier = statement.moduleSpecifier
        if (specifier && ts.isStringLiteral(specifier) && !specifier.text.startsWith(".")) {
          expect(specifier.text).toMatch(/^(react|react-dom)(\/|$)/)
        }
      }
      if (name === "index.js") expect(text).not.toContain("shadcn-radix-release-003")
    }
    const manifest = readJson("package.json")
    expect(manifest.peerDependencies).toEqual({ react: "18.3.1", "react-dom": "18.3.1" })
    expect(manifest.dependencies.react).toBeUndefined()
    expect(manifest.dependencies["react-dom"]).toBeUndefined()
  })

  test("retains license notices for bundled runtime and font dependencies", () => {
    const notices = readFileSync(path.join(output, "THIRD_PARTY_LICENSES.txt"), "utf8")
    for (const name of ["@radix-ui/react-dialog", "lucide-react", "class-variance-authority", "@fontsource-variable/geist"]) {
      expect(notices).toContain(name)
    }
  })
})

describe("generated Release 004 package candidate", () => {
  test("ships the new release identity and corrected Sidebar context projection", async () => {
    expect(existsSync(r4DistributionManifest)).toBe(true)
    const distribution = JSON.parse(readFileSync(r4DistributionManifest, "utf8"))
    const tarball = path.join(r4ArtifactDirectory, distribution.tarball.filename)
    expect(existsSync(tarball)).toBe(true)
    const extraction = mkdtempSync(path.join(tmpdir(), "adc-r4-library-"))
    try {
      execFileSync("tar", ["-xzf", tarball, "-C", extraction], { stdio: "pipe" })
      const packageRoot = path.join(extraction, "package")
      const packageManifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"))
      expect(packageManifest.name).toBe("@adc/shadcn-design-system")
      expect(packageManifest.version).toBe("0.0.0-release.4")
      const library = await import(/* @vite-ignore */ path.join(packageRoot, "dist-library/release.js"))
      const release = library.getExecutableRelease()
      expect(release.releaseId).toBe("shadcn-radix-release-004")
      expect(release.sha256).toBe(distribution.release.payloadSha256)
      expect(release.projection.exports["sidebar\0SidebarProvider"].component.composition.provides).toEqual(["sidebar.context"])
      expect(release.projection.exports["sidebar\0Sidebar"].component.composition.requires).toEqual(["sidebar.context"])
    } finally {
      rmSync(extraction, { recursive: true, force: true })
    }
  })
})
