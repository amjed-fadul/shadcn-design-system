import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, test } from "vitest"

test("Image exports the closed source API and rejects native-image escape hatches", () => {
  // Compile the canonical UI surface independently of the not-yet-generated R8 artifact.
  expect(readFileSync(new URL("../src/package/index.ts", import.meta.url), "utf8")).toContain('export * from "../components/ui/image"')
  const fixture = fileURLToPath(new URL("./image-api.types.tsx", import.meta.url))
  const program = ts.createProgram([fixture], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
    baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
  })
  expect(ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([])
})
