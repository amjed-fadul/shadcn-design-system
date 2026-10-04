import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import ts from "typescript"
import { build, runnerImport } from "vite"
import { observeBuildReads } from "./build-input-guard.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
process.chdir(root)
// The package build is always production, including when launched by Vitest.
// Otherwise JSX development transforms can embed absolute source filenames.
process.env.NODE_ENV = "production"
const outputFlag = process.argv.indexOf("--out-dir")
const output = outputFlag < 0 ? path.join(root, "dist-library") : path.resolve(process.argv[outputFlag + 1])
// Compiler IPC files are generated outputs. Use a fresh private scratch
// directory so unrelated pre-existing temporary files cannot become inputs.
const scratch = mkdtempSync(path.join(tmpdir(), "release-012-compiler-"))
const previousTmpdir = process.env.TMPDIR
process.env.TMPDIR = scratch
const releasePath = path.join(root, "provenance/releases/shadcn-radix-release-012.json")
const selectedReleasePath = releasePath
// Observe from the first producer module load, so reads made while those modules load are gated too.
const observation = observeBuildReads()
const { module: identity } = await runnerImport(path.join(root, "scripts/release-inputs.ts"), { configFile: false })
const { module: releaseApi } = await runnerImport(path.join(root, "src/validator/release.ts"), { configFile: false })
// Loading the canonical contracts caches a TypeScript program per inherited
// interface declaration (about 3 GB). Only the projection leaves this scope, so
// those programs are collectable before Vite loads the contracts again.
const expectedProjection = await (async () => {
  const { module: componentAuthority } = await runnerImport(path.join(root, "src/contracts/components/canonical-loader.ts"), { configFile: false })
  const { module: tokenAuthority } = await runnerImport(path.join(root, "src/contracts/tokens/contract.ts"), { configFile: false })
  const { module: projectionApi } = await runnerImport(path.join(root, "src/validator/projection.ts"), { configFile: false })
  return projectionApi.projectExecutableContract({ componentContracts: componentAuthority.loadComponentContracts(), tokenContract: tokenAuthority.getTokenContract() })
})()
const rawRelease = JSON.parse(readFileSync(selectedReleasePath, "utf8"))
const release = releaseApi.loadExecutableRelease(rawRelease, { expectedProjection, expectedReleaseId: rawRelease.releaseId, requirePackageIdentity: true })
if (JSON.stringify(release.packageIdentity) !== JSON.stringify(identity.packageIdentity(root))) throw new Error("PACKAGE_IDENTITY_MISMATCH")
identity.verifyImplementationManifest(root, release.implementationInputs)
const buildConfigScratch = mkdtempSync(path.join(tmpdir(), "release-012-config-"))
const buildDataPath = path.join(buildConfigScratch, "library-data.ts")
const buildConfigPath = path.join(buildConfigScratch, "vite.library.config.ts")
writeFileSync(buildDataPath, [
  `import { loadComponentContracts } from ${JSON.stringify(path.join(root, "src/contracts/components/canonical-loader.ts"))}`,
  `import { getTokenContract } from ${JSON.stringify(path.join(root, "src/contracts/tokens/contract.ts"))}`,
  "export const componentContracts = loadComponentContracts()",
  "export const tokenContract = getTokenContract()",
  `export const executableRelease = JSON.parse(${JSON.stringify(JSON.stringify(release))})`,
].join("\n"))
let buildConfigSource = readFileSync(path.join(root, "vite.library.config.ts"), "utf8")
const require = createRequire(import.meta.url)
buildConfigSource = buildConfigSource
  .replace(/const root = path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/, `const root = ${JSON.stringify(root)}`)
  .replace('path.join(root, "scripts/library-data.ts")', JSON.stringify(buildDataPath))
  .replace('from "./scripts/library-data"', `from ${JSON.stringify(path.join(root, "scripts/library-data.ts"))}`)
  .replace('from "./scripts/library-licenses"', `from ${JSON.stringify(path.join(root, "scripts/library-licenses.ts"))}`)
  .replaceAll('"@vitejs/plugin-react"', JSON.stringify(require.resolve("@vitejs/plugin-react")))
  .replaceAll('"@tailwindcss/vite"', JSON.stringify(require.resolve("@tailwindcss/vite")))
  .replaceAll('"vite"', JSON.stringify(require.resolve("vite")))
writeFileSync(buildConfigPath, buildConfigSource)
try {
  const reached = []
  await build({
    configFile: buildConfigPath,
    build: { outDir: output },
    plugins: [{
      name: "release-input-coverage",
      generateBundle() {
        reached.push(...this.getModuleIds(), ...this.getWatchFiles())
      },
    }],
  })

  const configFile = ts.readConfigFile(path.join(root, "tsconfig.library.json"), ts.sys.readFile)
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
  config.options.outDir = path.join(output, "types")
  const program = ts.createProgram(config.fileNames, config.options)
  reached.push(...program.getSourceFiles().map(file => file.fileName))
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)]
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: (name) => name, getNewLine: () => "\n",
  }))

  // TypeScript intentionally preserves path aliases. Rewrite only generated
  // declaration module specifiers, retaining the canonical source untouched.
  const portableSpecifiers = (context) => (source) => {
    const specifier = (node) => {
      if (!node || !ts.isStringLiteral(node) || !node.text.startsWith("@/")) return node
      const relative = path.relative(path.dirname(source.fileName), path.join(root, "src", node.text.slice(2))).split(path.sep).join("/")
      return context.factory.createStringLiteral(relative.startsWith(".") ? relative : `./${relative}`)
    }
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) return context.factory.updateImportDeclaration(node, node.modifiers, node.importClause, specifier(node.moduleSpecifier), node.attributes)
      if (ts.isExportDeclaration(node)) return context.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, specifier(node.moduleSpecifier), node.attributes)
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        return context.factory.updateImportTypeNode(node, context.factory.updateLiteralTypeNode(node.argument, specifier(node.argument.literal)), node.attributes, node.qualifier, node.typeArguments, node.isTypeOf)
      }
      return ts.visitEachChild(node, visit, context)
    }
    return ts.visitNode(source, visit)
  }
  // Imported JSON schemas have no declaration output. Emit the actual TS source
  // files individually so a skipped JSON emit cannot mask a failed TS emit.
  for (const source of program.getSourceFiles().filter((file) => !file.isDeclarationFile && /\.tsx?$/.test(file.fileName))) {
    const result = program.emit(source, (file, text) => {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, text)
    }, undefined, true, { afterDeclarations: [portableSpecifiers] })
    if (result.emitSkipped || result.diagnostics.length) throw new Error(`Library declaration emission failed for ${source.fileName}: ${ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: (name) => name, getNewLine: () => "\n",
    })}`)
  }
  observation.restore()
  identity.assertReachedInputs(root, release.implementationInputs, [...reached, ...observation.reads], [scratch, realpathSync(scratch), buildConfigScratch, realpathSync(buildConfigScratch)])
  releaseApi.loadExecutableRelease(JSON.parse(readFileSync(selectedReleasePath, "utf8")), { expectedProjection, expectedReleaseId: release.releaseId, requirePackageIdentity: true })
  console.log("Library declarations emitted; release inputs and actual build dependency coverage verified.")
} finally {
  observation.restore()
  if (previousTmpdir === undefined) delete process.env.TMPDIR
  else process.env.TMPDIR = previousTmpdir
  rmSync(scratch, { recursive: true, force: true })
  rmSync(buildConfigScratch, { recursive: true, force: true })
}
