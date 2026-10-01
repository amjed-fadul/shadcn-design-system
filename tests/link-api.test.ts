import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, test } from "vitest"

test("Link exports a closed native API with required destination and content", () => {
  const fixture = fileURLToPath(new URL("./link-api.types.tsx", import.meta.url))
  const program = ts.createProgram([fixture], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
    baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
  })
  const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
  expect(errors).toEqual([])
})
