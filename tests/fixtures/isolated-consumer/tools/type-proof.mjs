import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
export function typeProof(root) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.options.strict, true)
  assert.equal(parsed.options.skipLibCheck, false)
  assert.equal(parsed.options.paths, undefined)
  assert.equal(parsed.options.baseUrl, undefined)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
  const checker = program.getTypeChecker()
  const strictSource = program.getSourceFile(path.join(root, 'src/strict-types.tsx'))
  const boundary = strictSource.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'StrictBoundary')
  assert.ok(boundary, 'StrictBoundary anti-any proof is required')
  const tuple = checker.getTypeAtLocation(boundary)
  assert.ok(checker.isTupleType(tuple))
  const antiAnyResults = checker.getTypeArguments(tuple).map(type => checker.typeToString(type))
  assert.deepEqual(antiAnyResults, Array(17).fill('false'))
  const sources = program.getSourceFiles().map(source => source.fileName)
  for (const file of sources) assert.ok(file.startsWith(`${root}/`), `TypeScript source outside consumer: ${file}`)
  const declarations = sources.filter(file => file.includes('/@adc/shadcn-design-system/') && file.endsWith('.d.ts'))
  assert.ok(declarations.length >= 20)
  for (const file of declarations) assert.doesNotMatch(readFileSync(file, 'utf8'), /(?:from\s*|import\()["']@\//)
  const invalidFile = path.join(root, 'types/invalid.tsx')
  const negativeProgram = ts.createProgram([invalidFile], parsed.options)
  const negative = ts.getPreEmitDiagnostics(negativeProgram).map(d => ({ code: d.code, file: d.file?.fileName, line: d.file?.getLineAndCharacterOfPosition(d.start).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }))
  assert.equal(negative.length, 6)
  assert.deepEqual(negative.map(d => d.line), [2, 3, 4, 5, 6, 7])
  for (const d of negative) { assert.equal(d.file, invalidFile); assert.equal(d.code, 2322) }
  const refSource = program.getSourceFile(path.join(root, 'src/ref-types.tsx'))
  const refBoundary = refSource.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'RefBoundary')
  assert.ok(refBoundary)
  const refTuple = checker.getTypeAtLocation(refBoundary)
  assert.ok(checker.isTupleType(refTuple))
  const refAntiAny = checker.getTypeArguments(refTuple).map(type => checker.typeToString(type))
  assert.deepEqual(refAntiAny, Array(14).fill('false'))
  const invalidRefFile = path.join(root, 'types/ref-invalid.tsx')
  const refProgram = ts.createProgram([invalidRefFile], parsed.options)
  const refNegative = ts.getPreEmitDiagnostics(refProgram).map(d => ({ code: d.code, file: d.file?.fileName, line: d.file?.getLineAndCharacterOfPosition(d.start).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }))
  assert.deepEqual(refNegative.map(d => d.line), [4, 5, 6, 7, 8, 9, 10])
  for (const d of refNegative) { assert.equal(d.file, invalidRefFile); assert.equal(d.code, 2322) }
  return { refAntiAny, refNegative, strict: true, skipLibCheck: false, positiveDiagnostics: 0, noAnyAssertions: antiAnyResults.length, antiAnyResults, sources, declarations, negative }
}
