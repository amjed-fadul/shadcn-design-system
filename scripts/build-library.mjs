import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { build } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
process.chdir(root)
// The package build is always production, including when launched by Vitest.
// Otherwise JSX development transforms can embed absolute source filenames.
process.env.NODE_ENV = "production"
await build({ configFile: path.join(root, "vite.library.config.ts") })

const configFile = ts.readConfigFile(path.join(root, "tsconfig.library.json"), ts.sys.readFile)
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"))
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
const program = ts.createProgram(config.fileNames, config.options)
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
console.log("Library declarations emitted with package-relative imports.")
