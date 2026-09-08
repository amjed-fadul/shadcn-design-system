import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { beforeAll, describe, expect, test } from "vitest"
import ts from "typescript"
import { createElement, isValidElement } from "react"
import type { TokenContract } from "../src/contracts/tokens/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const output = path.join(root, "dist-library")
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"))
const contractedExportNames = () => {
  const contractSet = readJson("contracts/components/component-contract-set.json")
  return contractSet.familyFiles.flatMap((file: string) =>
    readJson(file).exports.map((entry: { name: string }) => entry.name)
  )
}

describe("published library entrypoint", () => {
  test("exposes all 108 contracted public exports including Switch", async () => {
    const library = await import("../src/package/index")
    const names = contractedExportNames()
    expect(Object.keys(library).sort()).toEqual(names.sort())
    expect(names).toHaveLength(108)
    expect(Object.hasOwn(library, "Switch")).toBe(true)
  })
})

describe("library package boundary", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build:library"], { cwd: root, stdio: "pipe", timeout: 120_000 })
  }, 130_000)

  test("exposes every approved component export without exposing internal utilities", async () => {
    const library = await import(/* @vite-ignore */ path.join(output, "index.js"))
    const names = contractedExportNames()
    expect(Object.keys(library).sort()).toEqual(names.sort())
    expect(names).toHaveLength(108)
    expect(Object.hasOwn(library, "Switch")).toBe(true)
    expect(isValidElement(createElement(library.Button))).toBe(true)
    expect(library.useSidebar).toBeTypeOf("function")
  })

  test("ships complete immutable contracts and the unchanged executable release", async () => {
    const library = await import(/* @vite-ignore */ path.join(output, "release.js"))
    expect(Object.keys(library).sort()).toEqual(["getComponentContracts", "getExecutableRelease", "getTokenContract"])
    expect(library.getExecutableRelease()).toEqual(readJson("provenance/releases/shadcn-radix-release-002.json"))
    const components = library.getComponentContracts()
    expect(components.contractSet).toEqual(readJson("contracts/components/component-contract-set.json"))
    expect(components.families).toHaveLength(20)
    for (const file of components.contractSet.familyFiles) {
      expect(components.families).toContainEqual(readJson(file))
    }
    for (const file of components.contractSet.interfaceFiles) {
      expect(components.interfaces).toContainEqual(readJson(file))
    }
    expect(library.getTokenContract()).toEqual(readJson("contracts/tokens/token-contract.json"))
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
    const manifest = readJson("package.json")
    expect(manifest.version).toBe("0.0.0-release.2")
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./release", "./styles.css"])
    const probe = path.join(root, "library-type-probe.tsx")
    const validSource = `
      import { Button, Tabs, DialogContent, SelectContent, SelectTrigger } from "@adc/shadcn-design-system";
      import { getExecutableRelease, getTokenContract } from "@adc/shadcn-design-system/release";
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
      if (name === "index.js") expect(text).not.toContain("shadcn-radix-release-002")
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
