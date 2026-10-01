import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, test } from "vitest"

test("the public Icon API accepts governed usage and rejects escape hatches and unnamed meaningful icons", () => {
  const fixture = fileURLToPath(new URL("./icon-api.types.tsx", import.meta.url))
  const program = ts.createProgram([fixture], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
    baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
  })
  const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
  expect(errors).toEqual([])
})

test("Icon declarations do not require the bundled private Lucide dependency", () => {
  const source = fileURLToPath(new URL("../src/components/ui/icon.tsx", import.meta.url))
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true,
    esModuleInterop: true, baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
  }
  const host = ts.createCompilerHost(options)
  let declaration = ""
  host.writeFile = (path, contents) => { if (path.endsWith("/icon.d.ts")) declaration = contents }
  const program = ts.createProgram([source], options, host)
  expect(ts.getPreEmitDiagnostics(program)).toEqual([])
  expect(program.emit().emitSkipped).toBe(false)
  expect(declaration).toContain("name:")
  expect(declaration).not.toContain("lucide-react")
  expect(declaration).not.toContain("iconRegistry")
})
