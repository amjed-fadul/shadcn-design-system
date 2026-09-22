import { createHash } from "node:crypto"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { resolve } from "node:path"

import ts from "typescript"

import type { LocalPropContract, SourceExpressionIdentity, StructuredPropType } from "./types"

export type ComponentPropSourceFact = {
  name: string
  required: boolean
  type: StructuredPropType
  default?: string | number | boolean | null
}

export type ComponentPropSourceUnresolved = SourceExpressionIdentity & { reason: string }
export type ComponentPropSourceAnalysis = { props: ComponentPropSourceFact[]; localPropNames: string[]; unresolved: ComponentPropSourceUnresolved[] }
export type ComponentPropSourceAnalyzerConfig = Readonly<{
  compilerOptions: ts.CompilerOptions
  rootNames?: readonly string[]
}>

type SourceFunction = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction
type Literal = string | number | boolean | null
type ProgramEntry = { program: ts.Program; fingerprint: string }

function normalizedPath(path: string): string {
  const absolute = resolve(path)
  return existsSync(absolute) ? realpathSync.native(absolute) : absolute
}

function programFingerprint(program: ts.Program): string {
  const hash = createHash("sha256")
  for (const source of program.getSourceFiles().filter((candidate) => !candidate.isDeclarationFile).sort((left, right) => left.fileName.localeCompare(right.fileName))) {
    const path = normalizedPath(source.fileName)
    hash.update(path)
    try { hash.update(readFileSync(path)) } catch (error) { hash.update(`unreadable:${String(error)}`) }
  }
  return hash.digest("hex")
}

function createProgramEntry(rootNames: readonly string[], compilerOptions: ts.CompilerOptions): ProgramEntry {
  const program = ts.createProgram([...rootNames], compilerOptions)
  return { program, fingerprint: programFingerprint(program) }
}

function isProgramCurrent(entry: ProgramEntry): boolean {
  return entry.fingerprint === programFingerprint(entry.program)
}

function literal(expression: ts.Expression | undefined): Literal | undefined {
  if (!expression) return undefined
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null
  return undefined
}

function functionLikeIn(node: ts.Node | undefined): SourceFunction | undefined {
  if (!node) return undefined
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return node
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    for (const argument of node.arguments ?? []) {
      const result = functionLikeIn(argument)
      if (result) return result
    }
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return functionLikeIn(node.expression)
  return undefined
}

function sourceFunction(source: ts.SourceFile, exportName: string): SourceFunction | undefined {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName) return statement
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) {
        const result = functionLikeIn(declaration.initializer)
        if (result) return result
      }
    }
  }
  return undefined
}

function sourceIdentity(node: ts.Node, source: ts.SourceFile, reason: string): ComponentPropSourceUnresolved {
  return {
    sourcePath: source.fileName,
    start: node.getStart(source),
    end: node.getEnd(),
    expressionKind: ts.SyntaxKind[node.kind],
    sourceText: node.getText(source),
    reason,
  }
}

function publicBindings(functionLike: SourceFunction) {
  const values = new Set<string>()
  const parameter = functionLike.parameters[0]
  if (!parameter) return values
  if (ts.isIdentifier(parameter.name)) values.add(parameter.name.text)
  if (ts.isObjectBindingPattern(parameter.name)) {
    for (const element of parameter.name.elements) if (element.dotDotDotToken && ts.isIdentifier(element.name)) values.add(element.name.text)
  }
  return values
}

function directDefaults(functionLike: SourceFunction) {
  const values = new Map<string, Literal>()
  const parameter = functionLike.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return values
  for (const element of parameter.name.elements) {
    const name = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName))
      ? element.propertyName.text
      : ts.isIdentifier(element.name) ? element.name.text : undefined
    const value = literal(element.initializer)
    if (name && value !== undefined) values.set(name, value)
  }
  return values
}

function cvaDefaults(functionLike: SourceFunction, source: ts.SourceFile) {
  const values = new Map<string, Literal>()
  const bodyText = functionLike.getText(source)
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
      if (!ts.isIdentifier(declaration.initializer.expression) || declaration.initializer.expression.text !== "cva" || !bodyText.includes(declaration.name.text)) continue
      const options = declaration.initializer.arguments[1]
      if (!options || !ts.isObjectLiteralExpression(options)) continue
      const defaults = options.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property)
        && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        && property.name.text === "defaultVariants")
      if (!defaults || !ts.isObjectLiteralExpression(defaults.initializer)) continue
      for (const property of defaults.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))) continue
        const value = literal(property.initializer)
        if (value !== undefined) values.set(property.name.text, value)
      }
    }
  }
  return values
}

function returnedExpressions(functionLike: SourceFunction) {
  if (!functionLike.body) return []
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const values: ts.Expression[] = []
  const visit = (node: ts.Node) => {
    if (node !== functionLike.body && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node) && node.expression) values.push(node.expression)
    else ts.forEachChild(node, visit)
  }
  visit(functionLike.body)
  return values
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) return unwrapExpression(expression.expression)
  return expression
}

function rootOpening(expression: ts.Expression): ts.JsxOpeningLikeElement | undefined {
  const unwrapped = unwrapExpression(expression)
  if (ts.isJsxElement(unwrapped)) return unwrapped.openingElement
  if (ts.isJsxSelfClosingElement(unwrapped)) return unwrapped
  return undefined
}

function aliasedSymbol(checker: ts.TypeChecker, symbol: ts.Symbol | undefined) {
  return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}

function declarationFunction(symbol: ts.Symbol | undefined): SourceFunction | undefined {
  for (const declaration of symbol?.declarations ?? []) {
    const result = ts.isVariableDeclaration(declaration) ? functionLikeIn(declaration.initializer) : functionLikeIn(declaration)
    if (result) return result
  }
  return undefined
}

function rightmostTypeName(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : name.right.text
}

function stringTypeKeys(node: ts.TypeNode | undefined): string[] {
  if (!node) return []
  if (ts.isUnionTypeNode(node)) return node.types.flatMap(stringTypeKeys)
  return ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? [node.literal.text] : []
}

function propsTypeNode(functionLike: SourceFunction): ts.TypeNode | undefined {
  const direct = functionLike.parameters[0]?.type
  if (direct) return direct
  const parent = functionLike.parent
  return ts.isCallExpression(parent) ? parent.typeArguments?.[1] : undefined
}

function sourceLocalPropTypeNodes(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, seen = new Set<ts.Node>()): Map<string, ts.TypeNode | undefined> {
  const values = new Map<string, ts.TypeNode | undefined>()
  if (!typeNode || seen.has(typeNode)) return values
  seen.add(typeNode)
  if (ts.isParenthesizedTypeNode(typeNode)) return sourceLocalPropTypeNodes(typeNode.type, checker, seen)
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) for (const [name, node] of sourceLocalPropTypeNodes(member, checker, new Set(seen))) values.set(name, node)
    return values
  }
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) values.set(member.name.text, member.type)
    }
    return values
  }
  if (!ts.isTypeReferenceNode(typeNode)) return values
  const utility = rightmostTypeName(typeNode.typeName)
  if (utility === "Pick") {
    const selected = sourceLocalPropTypeNodes(typeNode.typeArguments?.[0], checker, new Set(seen))
    for (const name of stringTypeKeys(typeNode.typeArguments?.[1])) values.set(name, selected.get(name))
    return values
  }
  if (utility === "Omit") {
    const selected = sourceLocalPropTypeNodes(typeNode.typeArguments?.[0], checker, new Set(seen))
    for (const name of stringTypeKeys(typeNode.typeArguments?.[1])) selected.delete(name)
    return selected
  }
  if (utility === "VariantProps") {
    for (const property of checker.getPropertiesOfType(checker.getTypeAtLocation(typeNode))) values.set(property.name, undefined)
    return values
  }
  if (utility === "ComponentProps" || utility === "ComponentPropsWithoutRef") {
    const target = typeNode.typeArguments?.[0]
    if (!target || !ts.isTypeQueryNode(target)) return values
    const child = declarationFunction(aliasedSymbol(checker, checker.getSymbolAtLocation(target.exprName)))
    return child ? sourceLocalPropTypeNodes(propsTypeNode(child), checker, new Set(seen)) : values
  }
  const symbol = aliasedSymbol(checker, checker.getSymbolAtLocation(typeNode.typeName))
  for (const declaration of symbol?.declarations ?? []) {
    if (!ts.isTypeAliasDeclaration(declaration)) continue
    for (const [name, node] of sourceLocalPropTypeNodes(declaration.type, checker, new Set(seen))) values.set(name, node)
  }
  return values
}

function unsafeAuthorityNode(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, seen = new Set<ts.Node>()): ts.Node | undefined {
  if (!typeNode || seen.has(typeNode)) return undefined
  seen.add(typeNode)
  const type = checker.getTypeAtLocation(typeNode)
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return typeNode
  if (ts.isParenthesizedTypeNode(typeNode)) return unsafeAuthorityNode(typeNode.type, checker, seen)
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) {
      const unsafe = unsafeAuthorityNode(member, checker, new Set(seen))
      if (unsafe) return unsafe
    }
    return undefined
  }
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member)) continue
      const unsafe = unsafeAuthorityNode(member.type, checker, new Set(seen))
      if (unsafe) return unsafe
    }
    return undefined
  }
  if (!ts.isTypeReferenceNode(typeNode)) return undefined
  const utility = rightmostTypeName(typeNode.typeName)
  if (utility === "Pick" || utility === "Omit" || utility === "VariantProps") {
    const unsafe = unsafeAuthorityNode(typeNode.typeArguments?.[0], checker, new Set(seen))
    if (unsafe) return unsafe
  }
  if (utility === "ComponentProps" || utility === "ComponentPropsWithoutRef") return undefined
  const symbol = aliasedSymbol(checker, checker.getSymbolAtLocation(typeNode.typeName))
  for (const declaration of symbol?.declarations ?? []) {
    if (!ts.isTypeAliasDeclaration(declaration)) continue
    const unsafe = unsafeAuthorityNode(declaration.type, checker, new Set(seen))
    if (unsafe) return unsafe
  }
  return undefined
}

function sourceLocalPropNames(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, seen = new Set<ts.Node>()): Set<string> {
  return new Set(sourceLocalPropTypeNodes(typeNode, checker, seen).keys())
}

function delegatedDefaults(functionLike: SourceFunction, checker: ts.TypeChecker, visited: Set<SourceFunction>): Map<string, Literal> {
  if (visited.has(functionLike)) return new Map()
  visited.add(functionLike)
  const bindings = publicBindings(functionLike)
  const candidates: Array<Map<string, Literal>> = []
  for (const expression of returnedExpressions(functionLike)) {
    const opening = rootOpening(expression)
    if (!opening) continue
    const forwards = opening.attributes.properties.some((property) => ts.isJsxSpreadAttribute(property) && ts.isIdentifier(property.expression) && bindings.has(property.expression.text))
    if (!forwards) continue
    const defaults = new Map<string, Literal>()
    if (ts.isIdentifier(opening.tagName)) {
      const child = declarationFunction(aliasedSymbol(checker, checker.getSymbolAtLocation(opening.tagName)))
      if (child) {
        for (const [name, value] of delegatedDefaults(child, checker, new Set(visited))) defaults.set(name, value)
        for (const [name, value] of directDefaults(child)) defaults.set(name, value)
      }
    }
    for (const property of opening.attributes.properties) {
      if (!ts.isJsxAttribute(property) || !ts.isIdentifier(property.name)) continue
      const initializer = property.initializer
      const value = initializer && ts.isStringLiteral(initializer)
        ? initializer.text
        : initializer && ts.isJsxExpression(initializer) ? literal(initializer.expression) : undefined
      if (value !== undefined) defaults.set(property.name.text, value)
    }
    candidates.push(defaults)
  }
  visited.delete(functionLike)
  if (!candidates.length) return new Map()
  const common = new Map(candidates[0])
  for (const [name, value] of common) {
    if (!candidates.every((candidate) => candidate.has(name) && candidate.get(name) === value)) common.delete(name)
  }
  return common
}

function unionMembers(type: ts.Type): ts.Type[] {
  return type.isUnion() ? type.types.flatMap(unionMembers) : [type]
}

function structuredType(checker: ts.TypeChecker, type: ts.Type): StructuredPropType {
  const members = unionMembers(type).filter((member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)))
  const stringValues = members.filter((member) => member.isStringLiteral()).map((member) => member.value)
  if (members.length > 0 && stringValues.length === members.length) return { kind: "enum", values: [...new Set(stringValues)].sort() }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)))) return { kind: "boolean" }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)))) return { kind: "string" }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)))) return { kind: "number" }
  return { kind: "typescript", typeText: checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation) }
}

function comparableType(type: StructuredPropType): StructuredPropType {
  return type.kind === "enum" ? { kind: "enum", values: [...type.values].sort() } : type
}

export function createComponentPropSourceAnalyzer(config: ComponentPropSourceAnalyzerConfig) {
  const sharedRootNames = config.rootNames?.map(normalizedPath).sort()
  const sharedRootSet = new Set(sharedRootNames)
  let sharedProgram = sharedRootNames ? createProgramEntry(sharedRootNames, config.compilerOptions) : undefined
  const programs = new Map<string, ProgramEntry>()
  const programFor = (sourcePath: string) => {
    if (sharedProgram && sharedRootSet.has(sourcePath)) {
      if (!isProgramCurrent(sharedProgram)) sharedProgram = createProgramEntry(sharedRootNames!, config.compilerOptions)
      return sharedProgram.program
    }
    let program = programs.get(sourcePath)
    if (!program || !isProgramCurrent(program)) {
      program = createProgramEntry([sourcePath], config.compilerOptions)
      programs.delete(sourcePath)
      programs.set(sourcePath, program)
    }
    while (programs.size > 4) programs.delete(programs.keys().next().value!)
    return program.program
  }
  const analyzeComponentPropSource = (sourcePath: string, exportName: string): ComponentPropSourceAnalysis => {
    sourcePath = normalizedPath(sourcePath)
    const program = programFor(sourcePath)
    const checker = program.getTypeChecker()
    const source = program.getSourceFile(sourcePath)
    if (!source) return { props: [], localPropNames: [], unresolved: [{ sourcePath, start: 0, end: 0, expressionKind: "SourceFile", sourceText: exportName, reason: "Component source file is not in the TypeScript program." }] }
    const functionLike = sourceFunction(source, exportName)
    if (!functionLike) return { props: [], localPropNames: [], unresolved: [sourceIdentity(source, source, `Component function ${exportName} was not found.`)] }
    const parameter = functionLike.parameters[0]
    if (!parameter) return { props: [], localPropNames: [], unresolved: [sourceIdentity(functionLike, source, "Component has no props parameter.")] }
    const propsType = checker.getTypeAtLocation(parameter)
    if (propsType.flags & ts.TypeFlags.Any) return { props: [], localPropNames: [], unresolved: [sourceIdentity(parameter.type ?? parameter, source, "Component props type is any.")] }
    if (propsType.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return { props: [], localPropNames: [], unresolved: [sourceIdentity(parameter.type ?? parameter, source, "Component props type cannot be resolved.")] }

    const typeNode = propsTypeNode(functionLike)
    const authoredTypes = sourceLocalPropTypeNodes(typeNode, checker)
    let unsafeNode = unsafeAuthorityNode(typeNode, checker)
    if (!unsafeNode) {
      for (const [name, node] of authoredTypes) {
        const symbol = checker.getPropertyOfType(propsType, name)
        const type = symbol && checker.getTypeOfSymbolAtLocation(symbol, parameter)
        if (type && type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
          unsafeNode = node ?? typeNode ?? parameter
          break
        }
      }
    }
    if (unsafeNode) return { props: [], localPropNames: [], unresolved: [sourceIdentity(unsafeNode, source, "Component props type contains unsafe any or unknown authority.")] }
    const defaults = delegatedDefaults(functionLike, checker, new Set())
    for (const [name, value] of cvaDefaults(functionLike, source)) defaults.set(name, value)
    for (const [name, value] of directDefaults(functionLike)) defaults.set(name, value)
    const props = checker.getPropertiesOfType(propsType).map((symbol): ComponentPropSourceFact => {
      const type = checker.getTypeOfSymbolAtLocation(symbol, parameter)
      const value = defaults.get(symbol.name)
      return {
        name: symbol.name,
        required: !Boolean(symbol.flags & ts.SymbolFlags.Optional),
        type: (() => {
          const structured = structuredType(checker, type)
          const authored = authoredTypes.get(symbol.name)
          return structured.kind === "typescript" && authored
            ? { kind: "typescript", typeText: authored.getText(authored.getSourceFile()).replaceAll("React.", "") } as const
            : structured
        })(),
        ...(value !== undefined ? { default: value } : {}),
      }
    }).sort((left, right) => left.name.localeCompare(right.name))
    return { props, localPropNames: [...sourceLocalPropNames(typeNode, checker)].sort(), unresolved: [] }
  }

  return {
    analyzeComponentPropSource,
    compareComponentLocalProps(contracted: LocalPropContract[], analysis: ComponentPropSourceAnalysis): string[] {
      const errors = analysis.unresolved.map((finding) => `Unresolved component prop source: ${finding.reason}`)
      if (analysis.unresolved.length) return errors
      const localNames = new Set(analysis.localPropNames)
      const source = new Map(analysis.props.filter((prop) => localNames.has(prop.name)).map((prop) => [prop.name, prop]))
      const expected = new Map(contracted.map((prop) => [prop.name, prop]))
      for (const [name, fact] of source) {
        const contract = expected.get(name)
        if (!contract) { errors.push(`Source local prop ${name} is missing from the contract.`); continue }
        if (contract.required !== fact.required) errors.push(`Local prop ${name} requiredness does not match source evidence.`)
        if (JSON.stringify(comparableType(contract.type)) !== JSON.stringify(comparableType(fact.type))) errors.push(`Local prop ${name} type does not match source evidence.`)
        const contractHasDefault = Object.hasOwn(contract, "default")
        const sourceHasDefault = Object.hasOwn(fact, "default")
        if (contractHasDefault !== sourceHasDefault || contract.default !== fact.default) errors.push(`Local prop ${name} default does not match source evidence.`)
      }
      for (const name of expected.keys()) if (!source.has(name)) errors.push(`Contract local prop ${name} is absent from source evidence.`)
      return errors
    },
  }
}
