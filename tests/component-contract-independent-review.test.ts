import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

import * as ts from "typescript"
import { describe, expect, test } from "vitest"

import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = resolve(process.cwd())
const familyDirectory = join(root, "contracts/components/families")
const interfaceDirectory = join(root, "contracts/components/interfaces")
const approvedTokenIds = new Set<string>(readJson(join(root, "contracts/tokens/token-contract.json")).tokens.map((token: AnyRecord) => token.id))
const expectedFamilies = [...canonicalFamilyIds].sort()

type AnyRecord = Record<string, any>
type SourceFacts = {
  sourceFile: ts.SourceFile
  sourceText: string
  declaration: ts.Node
  functionLike: ts.FunctionLikeDeclaration | undefined
  bindings: Set<string>
  restBindings: Set<string>
  bindingDefaults: Map<string, unknown>
  typeFacts: Map<string, { typeText: string; values: string[] }>
  jsx: Array<ts.JsxElement | ts.JsxSelfClosingElement>
  dataAttributes: Array<{ name: string; value?: unknown; expressionKind: string }>
  portalCount: number
  propSpreadCount: number
  directUsesSlot: boolean
  returnCount: number
  conditionalSource: boolean
}

type DeclarationContext = {
  checker: ts.TypeChecker
  sourceFile: ts.SourceFile
  propsType: ts.Type
}

type DeclarationProgram = {
  program: ts.Program
  checker: ts.TypeChecker
}

const sourceCache = new Map<string, { sourceFile: ts.SourceFile; sourceText: string }>()
const declarationCache = new Map<string, DeclarationContext | undefined>()
let declarationProgramCache: DeclarationProgram | undefined

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"))
}

function jsonFiles(directory: string): string[] {
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort()
}

function loadArtifacts(): { families: AnyRecord[]; interfaces: AnyRecord[] } {
  return {
    families: jsonFiles(familyDirectory).map((file) => readJson(join(familyDirectory, file))),
    interfaces: jsonFiles(interfaceDirectory).map((file) => readJson(join(interfaceDirectory, file))),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function familyById(artifacts: { families: AnyRecord[] }, id: string): AnyRecord {
  const family = artifacts.families.find((item) => item.id === id)
  if (!family) throw new Error(`Missing family fixture ${id}`)
  return family
}

function exportByName(family: AnyRecord, name: string): AnyRecord {
  const exported = family.exports.find((item: AnyRecord) => item.name === name)
  if (!exported) throw new Error(`Missing export fixture ${family.id}.${name}`)
  return exported
}

function interfaceById(artifacts: { interfaces: AnyRecord[] }, id: string): AnyRecord {
  const artifact = artifacts.interfaces.find((item) => item.id === id)
  if (!artifact) throw new Error(`Missing interface fixture ${id}`)
  return artifact
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function sourceFacts(path: string): { sourceFile: ts.SourceFile; sourceText: string } {
  const cached = sourceCache.get(path)
  if (cached) return cached
  const sourceText = readFileSync(path, "utf8")
  const facts = {
    sourceFile: ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    sourceText,
  }
  sourceCache.set(path, facts)
  return facts
}

function propertyName(node: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return undefined
}

function exportedNames(sourceFile: ts.SourceFile): string[] {
  const names = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text)
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) names.add(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
      }
    }
  }
  return [...names].sort()
}

function declarationFor(sourceFile: ts.SourceFile, name: string): ts.Node | undefined {
  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) return statement
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find((item) => ts.isIdentifier(item.name) && item.name.text === name)
      if (declaration) return declaration
    }
  }
  return undefined
}

function functionLikeIn(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return node
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    for (const argument of node.arguments ?? []) {
      const found = functionLikeIn(argument)
      if (found) return found
    }
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return functionLikeIn(node.expression)
  return undefined
}

function functionLikeFor(declaration: ts.Node | undefined): ts.FunctionLikeDeclaration | undefined {
  if (!declaration) return undefined
  if (ts.isFunctionDeclaration(declaration)) return declaration
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) return functionLikeIn(declaration.initializer)
  return undefined
}

function literalValue(node: ts.Expression | undefined): unknown {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  return undefined
}

function collectTypeFacts(node: ts.TypeNode | undefined, sourceFile: ts.SourceFile, facts: Map<string, { typeText: string; values: string[] }>): void {
  if (!node) return
  if (ts.isTypeLiteralNode(node)) {
    for (const member of node.members) {
      if (!ts.isPropertySignature(member)) continue
      const name = propertyName(member.name)
      if (!name || !member.type) continue
      const values = ts.isUnionTypeNode(member.type)
        ? member.type.types.flatMap((type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? [type.literal.text] : [])
        : ts.isLiteralTypeNode(member.type) && ts.isStringLiteral(member.type.literal)
          ? [member.type.literal.text]
          : []
      facts.set(name, { typeText: member.type.getText(sourceFile), values })
    }
  }
  ts.forEachChild(node, (child) => {
    if (ts.isTypeNode(child)) collectTypeFacts(child, sourceFile, facts)
  })
}

function walkComponent(node: ts.Node, callback: (node: ts.Node) => void): void {
  const visit = (current: ts.Node): void => {
    if (current !== node && (ts.isFunctionLike(current) || ts.isClassDeclaration(current))) return
    callback(current)
    current.forEachChild(visit)
  }
  visit(node)
}

function jsxTag(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText()
}

function jsxAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttributes {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
}

function jsxNodes(functionLike: ts.FunctionLikeDeclaration): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
  const nodes: Array<ts.JsxElement | ts.JsxSelfClosingElement> = []
  const body = functionLike.body
  if (!body) return nodes
  walkComponent(body, (node) => {
    if (ts.isJsxElement(node)) nodes.push(node)
    if (ts.isJsxSelfClosingElement(node)) nodes.push(node)
  })
  return nodes
}

function returnExpressions(functionLike: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!functionLike.body) return []
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const expressions: ts.Expression[] = []
  walkComponent(functionLike.body, (node) => {
    if (ts.isReturnStatement(node) && node.expression) expressions.push(node.expression)
  })
  return expressions
}

function componentSourceFacts(sourceFile: ts.SourceFile, declaration: ts.Node): SourceFacts {
  const functionLike = functionLikeFor(declaration)
  const bindings = new Set<string>()
  const restBindings = new Set<string>()
  const bindingDefaults = new Map<string, unknown>()
  const typeFacts = new Map<string, { typeText: string; values: string[] }>()
  if (functionLike?.parameters[0]) {
    const parameter = functionLike.parameters[0]
    collectTypeFacts(parameter.type, sourceFile, typeFacts)
    if (ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          bindings.add(element.name.text)
          if (element.dotDotDotToken) restBindings.add(element.name.text)
          const value = literalValue(element.initializer)
          if (value !== undefined) bindingDefaults.set(element.name.text, value)
        }
      }
    }
  }
  if (functionLike?.body) {
    walkComponent(functionLike.body, (node) => {
      if (!ts.isBinaryExpression(node) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) return
      const leftName = ts.isIdentifier(node.left) ? node.left.text : undefined
      const rightValue = literalValue(node.right)
      const rightName = ts.isIdentifier(node.right) ? node.right.text : undefined
      const leftValue = literalValue(node.left)
      const name = leftName ?? rightName
      const value = leftName ? rightValue : leftValue
      if (!name || typeof value !== "string") return
      const previous = typeFacts.get(name)
      const values = [...new Set([...(previous?.values ?? []), value])].sort()
      typeFacts.set(name, { typeText: previous?.typeText ?? "string", values })
    })
  }
  const jsx = functionLike ? jsxNodes(functionLike) : []
  const dataAttributes: SourceFacts["dataAttributes"] = []
  let propSpreadCount = 0
  let directUsesSlot = false
  for (const node of jsx) {
    if (jsxTag(node).includes("Portal")) {
      // A Portal JSX element is a render boundary in the source, regardless of its package owner.
    }
    for (const attribute of jsxAttributes(node).properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        if (ts.isIdentifier(attribute.expression) && restBindings.has(attribute.expression.text)) propSpreadCount++
        continue
      }
      if (!ts.isJsxAttribute(attribute)) continue
      const name = attribute.name.getText(sourceFile)
      if (!name.startsWith("data-")) continue
      const value = attribute.initializer
      if (!value) {
        dataAttributes.push({ name, expressionKind: "boolean" })
      } else if (ts.isStringLiteral(value)) {
        dataAttributes.push({ name, value: value.text, expressionKind: "literal" })
      } else if (ts.isJsxExpression(value) && value.expression) {
        const expression = value.expression
        dataAttributes.push({
          name,
          value: literalValue(expression),
          expressionKind: ts.isConditionalExpression(expression) ? "conditional" : ts.isIdentifier(expression) ? "identifier" : "other",
        })
      }
    }
  }
  const bodyText = functionLike?.getText(sourceFile) ?? declaration.getText(sourceFile)
  directUsesSlot ||= bodyText.includes("Slot.Root")
  return {
    sourceFile,
    sourceText: bodyText,
    declaration,
    functionLike,
    bindings,
    restBindings,
    bindingDefaults,
    typeFacts,
    jsx,
    dataAttributes,
    portalCount: jsx.filter((node) => jsxTag(node).includes("Portal")).length,
    propSpreadCount,
    directUsesSlot,
    returnCount: functionLike ? returnExpressions(functionLike).length : 0,
    conditionalSource: /\bif\s*\(|\?|&&/.test(bodyText),
  }
}

function cvaFacts(sourceFile: ts.SourceFile, bodyText: string): { variants: Map<string, string[]>; defaults: Map<string, unknown>; texts: string[] } {
  const variants = new Map<string, string[]>()
  const defaults = new Map<string, unknown>()
  const texts: string[] = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
      if (declaration.initializer.expression.getText(sourceFile) !== "cva" || !bodyText.includes(declaration.name.text)) continue
      texts.push(declaration.initializer.getText(sourceFile))
      const options = declaration.initializer.arguments[1]
      if (!options || !ts.isObjectLiteralExpression(options)) continue
      for (const property of options.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        const name = propertyName(property.name)
        if (!name || !ts.isObjectLiteralExpression(property.initializer)) continue
        if (name === "variants") {
          for (const variant of property.initializer.properties) {
            if (!ts.isPropertyAssignment(variant) || !ts.isObjectLiteralExpression(variant.initializer)) continue
            const variantName = propertyName(variant.name)
            if (!variantName) continue
            variants.set(variantName, variant.initializer.properties
              .filter((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item))
              .map((item) => propertyName(item.name))
              .filter((item): item is string => !!item))
          }
        }
        if (name === "defaultVariants") {
          for (const defaultVariant of property.initializer.properties) {
            if (!ts.isPropertyAssignment(defaultVariant)) continue
            const defaultName = propertyName(defaultVariant.name)
            if (!defaultName) continue
            const value = literalValue(defaultVariant.initializer)
            if (value !== undefined) defaults.set(defaultName, value)
          }
        }
      }
    }
  }
  return { variants, defaults, texts }
}

function renderings(component: AnyRecord): AnyRecord[] {
  const rendering = component.rendering
  if (!rendering) return []
  if (Array.isArray(rendering.alternatives)) return rendering.alternatives.map((alternative: AnyRecord) => alternative.rendering)
  return [rendering]
}

function renderingNodes(component: AnyRecord): AnyRecord[] {
  return renderings(component).flatMap((rendering) => rendering?.nodes ?? [])
}

function renderingAttributes(component: AnyRecord): AnyRecord[] {
  return renderingNodes(component).flatMap((node) => node.dataAttributes ?? [])
}

function renderingHostTags(component: AnyRecord): string[] {
  return renderingNodes(component)
    .map((node) => node.host)
    .filter((host) => host?.kind === "intrinsic" && typeof host.tag === "string")
    .map((host) => host.tag)
}

function collectChildIds(node: AnyRecord, ids: string[]): void {
  for (const child of node.children ?? []) {
    if (typeof child.nodeId === "string") ids.push(child.nodeId)
  }
}

function directTokenEvidence(text: string, tokenIds: Set<string>): Set<string> {
  const result = new Set<string>()
  const hasClass = (value: string): boolean => {
    const index = text.indexOf(value)
    if (index < 0) return false
    const before = text[index - 1]
    const after = text[index + value.length]
    return !before || !/[A-Za-z0-9_-]/.test(before) ? (!after || !/[A-Za-z0-9_-]/.test(after)) : false
  }
  for (const tokenId of tokenIds) {
    const [category, name] = tokenId.split(".")
    let found = false
    if (category === "color") {
      found = ["bg-", "text-", "border-", "ring-", "fill-", "stroke-", "outline-", "placeholder:text-"]
        .some((prefix) => hasClass(`${prefix}${name}`))
    } else if (tokenId === "font.heading") {
      found = hasClass("font-heading")
    } else if (category === "font-size") {
      found = hasClass(`text-${name}`)
    } else if (category === "font-weight") {
      found = hasClass(`font-${name}`)
    } else if (category === "letter-spacing") {
      found = hasClass(`tracking-${name}`)
    } else if (category === "radius") {
      found = hasClass(`rounded-${name}`)
    } else if (category === "shadow") {
      found = hasClass(`shadow-${name}`)
    } else if (category === "spacing") {
      found = /(?:^|[^A-Za-z0-9_-])(?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy]|inset|top|right|bottom|left|h|w|size|translate)-(?:\d+(?:\.\d+)?|\[[^\]]+\]|\([^)]*\))(?:$|[^A-Za-z0-9_-])/.test(text)
    }
    if (found) result.add(tokenId)
  }
  return result
}

function sourceDeclarationContext(artifact: AnyRecord): DeclarationContext | undefined {
  const declarationPath = artifact.source?.declarationPath
  if (typeof declarationPath !== "string") return undefined
  const cacheKey = `${declarationPath}:${artifact.source.symbol}`
  if (declarationCache.has(cacheKey)) return declarationCache.get(cacheKey)
  const absolutePath = resolve(root, declarationPath)
  const sourceFile = declarationProgramCache?.program.getSourceFile(absolutePath)
  const checker = declarationProgramCache?.checker
  if (!sourceFile) {
    declarationCache.set(cacheKey, undefined)
    return undefined
  }
  let propsType: ts.Type | undefined
  if (artifact.source.kind === "package-declaration") {
    const moduleSymbol = (sourceFile as ts.SourceFile & { symbol?: ts.Symbol }).symbol
    const [exportName, ...members] = artifact.source.symbol.split(".") as string[]
    let symbol = moduleSymbol && checker!.getExportsOfModule(moduleSymbol).find((item) => item.name === exportName)
    let componentType = symbol && checker!.getTypeOfSymbolAtLocation(symbol, sourceFile)
    for (const member of members) {
      symbol = componentType && checker!.getPropertyOfType(componentType, member)
      componentType = symbol && checker!.getTypeOfSymbolAtLocation(symbol, sourceFile)
    }
    const signature = componentType && checker!.getSignaturesOfType(componentType, ts.SignatureKind.Call)[0]
    const propsParameter = signature?.parameters[0]
    if (propsParameter) propsType = checker!.getTypeOfSymbolAtLocation(propsParameter, sourceFile)
    else if (symbol) propsType = checker!.getDeclaredTypeOfSymbol(symbol)
  } else {
    const tagMatch = /\["([^\"]+)"\]$/.exec(artifact.source.symbol ?? "")
    const visit = (node: ts.Node): void => {
      if (propsType || !ts.isInterfaceDeclaration(node) || node.name.text !== "IntrinsicElements" || !tagMatch) {
        node.forEachChild(visit)
        return
      }
      const member = node.members.find((item): item is ts.PropertySignature => ts.isPropertySignature(item) && propertyName(item.name) === tagMatch[1])
      if (member) propsType = checker!.getTypeAtLocation(member)
    }
    sourceFile.forEachChild(visit)
  }
  const result = propsType ? { checker: checker!, sourceFile, propsType } : undefined
  declarationCache.set(cacheKey, result)
  return result
}

function normalizeTypeText(value: string): string {
  return value.replace(/\s+/g, "")
}

function propertySymbols(checker: ts.TypeChecker, type: ts.Type, name: string): ts.Symbol[] {
  if (type.isUnionOrIntersection()) return type.types.flatMap((member) => propertySymbols(checker, member, name))
  const symbol = checker.getPropertyOfType(type, name)
  return symbol ? [symbol] : []
}

function uniqueSymbols(symbols: ts.Symbol[]): ts.Symbol[] {
  return symbols.filter((symbol, index) => symbols.findIndex((candidate) => candidate === symbol) === index)
}

function stringLiteralValues(type: ts.Type): string[] {
  if (type.isUnion()) return type.types.flatMap(stringLiteralValues)
  return type.isStringLiteral() ? [type.value] : []
}

function createDeclarationProgram(interfaces: AnyRecord[]): DeclarationProgram {
  const declarationPaths = [...new Set(interfaces.map((artifact) => artifact.source?.declarationPath))]
    .filter((path): path is string => typeof path === "string")
    .map((path) => resolve(root, path))
  const program = ts.createProgram(declarationPaths, {
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  })
  return { program, checker: program.getTypeChecker() }
}

function directDeclarationErrors(interfaces: AnyRecord[]): string[] {
  const errors: string[] = []
  if (!declarationProgramCache) declarationProgramCache = createDeclarationProgram(interfaces)
  for (const artifact of interfaces) {
    const declarationPath = resolve(root, artifact.source.declarationPath)
    if (!existsSync(declarationPath)) errors.push(`${artifact.id}: declaration file cannot be read`)
    if (hashFile(declarationPath) !== artifact.source.declarationSha256) errors.push(`${artifact.id}: declaration hash mismatch`)
    const context = sourceDeclarationContext(artifact)
    if (!context) {
      errors.push(`${artifact.id}: declaration symbol cannot be resolved independently`)
      continue
    }
    for (const prop of artifact.props ?? []) {
      const actual = uniqueSymbols(propertySymbols(context.checker, context.propsType, prop.name))
      if (!actual.length) {
        errors.push(`${artifact.id}: declared property ${prop.name} is missing from the source type`)
        continue
      }
      const actualTypes = actual.map((symbol) => context.checker.getTypeOfSymbolAtLocation(symbol, context.sourceFile))
      if (prop.type?.kind === "enum") {
        const actualValues = [...new Set(actualTypes.flatMap(stringLiteralValues))].sort()
        if (JSON.stringify(actualValues) !== JSON.stringify([...prop.type.values].sort())) errors.push(`${artifact.id}: enum type mismatch for ${prop.name}`)
      }
      if (["boolean", "string", "number"].includes(prop.type?.kind) && !actualTypes.some((type) => context.checker.typeToString(type) === prop.type.kind)) {
        errors.push(`${artifact.id}: primitive type mismatch for ${prop.name}`)
      }
      const actualRequired = actual.every((symbol) => !Boolean(symbol.flags & ts.SymbolFlags.Optional))
      if (typeof prop.required === "boolean" && actualRequired !== prop.required) errors.push(`${artifact.id}: requiredness mismatch for ${prop.name}`)
    }
    for (const event of artifact.events ?? []) {
      const actual = uniqueSymbols(propertySymbols(context.checker, context.propsType, event.propName))
      if (!actual.length) {
        errors.push(`${artifact.id}: declared event ${event.propName} is missing from the source type`)
        continue
      }
      const payloadTypes = actual.flatMap((symbol) => context.checker.getSignaturesOfType(context.checker.getTypeOfSymbolAtLocation(symbol, context.sourceFile), ts.SignatureKind.Call)[0]?.parameters[0] ?? [])
        .map((parameter) => context.checker.getTypeOfSymbolAtLocation(parameter, context.sourceFile))
      if (!payloadTypes.length) errors.push(`${artifact.id}: event ${event.propName} has no source payload`)
      const actualRequired = actual.every((symbol) => !Boolean(symbol.flags & ts.SymbolFlags.Optional))
      if (typeof event.required === "boolean" && actualRequired !== event.required) errors.push(`${artifact.id}: event requiredness mismatch for ${event.propName}`)
    }
  }
  return errors
}

function directSourceErrors(families: AnyRecord[], interfaces: AnyRecord[]): string[] {
  const errors: string[] = []
  const interfaceById = new Map(interfaces.map((artifact) => [artifact.id, artifact]))

  for (const family of families) {
    const sourcePath = resolve(root, family.source.canonicalPath)
    const { sourceFile } = sourceFacts(sourcePath)
    const actualExports = exportedNames(sourceFile)
    const expectedExports = (family.exports ?? []).map((item: AnyRecord) => item.name).sort()
    if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) {
      errors.push(`${family.id}: public export set differs from the canonical AST`)
    }
    for (const exported of family.exports ?? []) {
      const declaration = declarationFor(sourceFile, exported.name)
      if (!declaration) {
        errors.push(`${family.id}.${exported.name}: exported declaration is missing from the canonical AST`)
        continue
      }
      const hasJsx = !!functionLikeFor(declaration) && jsxNodes(functionLikeFor(declaration)!).length > 0
      const expectedKind = hasJsx ? "component" : /^use[A-Z]/.test(exported.name) ? "hook" : "helper"
      if (exported.kind !== expectedKind || exported.authorableJsx !== hasJsx) {
        errors.push(`${family.id}.${exported.name}: independent export classification differs`)
      }
      if (!exported.component) continue
      const source = componentSourceFacts(sourceFile, declaration)
      const variants = cvaFacts(sourceFile, source.sourceText)
      const sourceProps = new Set([...source.bindings, ...source.typeFacts.keys(), ...variants.variants.keys()])
      for (const localProp of exported.component.localProps ?? []) {
        if (!sourceProps.has(localProp.name)) errors.push(`${family.id}.${exported.name}: local prop ${localProp.name} is not in the source signature`)
        const sourceType = source.typeFacts.get(localProp.name)
        const sourceValues = variants.variants.get(localProp.name) ?? sourceType?.values ?? []
        if (localProp.type?.kind === "enum" && JSON.stringify([...localProp.type.values].sort()) !== JSON.stringify([...sourceValues].sort())) {
          errors.push(`${family.id}.${exported.name}: enum values for ${localProp.name} differ from source literals`)
        }
        if (localProp.default !== undefined) {
          const sourceDefault = source.bindingDefaults.get(localProp.name) ?? variants.defaults.get(localProp.name)
          if (sourceDefault !== localProp.default) errors.push(`${family.id}.${exported.name}: default for ${localProp.name} differs from source`)
        }
        if (localProp.type?.kind === "boolean" && sourceType && normalizeTypeText(sourceType.typeText) !== "boolean") {
          errors.push(`${family.id}.${exported.name}: boolean prop ${localProp.name} differs from source type`)
        }
      }

      const inheritedProps = new Set<string>()
      for (const interfaceId of exported.component.inherits ?? []) {
        const inherited = interfaceById.get(interfaceId)
        for (const prop of inherited?.props ?? []) inheritedProps.add(prop.name)
      }
      const hasAsChild = inheritedProps.has("asChild") || sourceProps.has("asChild")
      const slots = exported.component.slots ?? []
      if (source.directUsesSlot && !slots.some((slot: AnyRecord) => slot.propName === "asChild")) {
        errors.push(`${family.id}.${exported.name}: source uses Slot.Root without an asChild slot fact`)
      }
      for (const slot of slots) {
        if (slot.propName !== "asChild") errors.push(`${family.id}.${exported.name}: unsupported slot prop ${slot.propName}`)
        if (!hasAsChild) errors.push(`${family.id}.${exported.name}: asChild slot lacks independent interface/signature evidence`)
        if (slot.childCardinality?.min !== 0 || slot.childCardinality?.max !== 1) errors.push(`${family.id}.${exported.name}: invalid asChild child cardinality`)
        if (slot.forwardsProps !== true || !slot.evidenceRefs?.includes("source")) errors.push(`${family.id}.${exported.name}: incomplete asChild forwarding evidence`)
        if (source.propSpreadCount === 0) errors.push(`${family.id}.${exported.name}: asChild slot has no public props spread in source`)
      }

      const contractTokenIds = new Set<string>((exported.component.tokenDependencies ?? []).map((dependency: AnyRecord) => dependency.tokenId))
      const tokenText = `${source.sourceText}\n${variants.texts.join("\n")}`
      const sourceTokenIds = directTokenEvidence(tokenText, approvedTokenIds)
      for (const tokenId of contractTokenIds) {
        if (!sourceTokenIds.has(tokenId)) errors.push(`${family.id}.${exported.name}: token ${tokenId} has no direct source expression`)
      }
      for (const tokenId of sourceTokenIds) {
        if (!contractTokenIds.has(tokenId)) errors.push(`${family.id}.${exported.name}: source token ${tokenId} is omitted from the contract`)
      }
      for (const token of exported.component.tokenDependencies ?? []) {
        if (!token.evidenceRefs?.includes("source") || !token.evidenceRefs?.includes("tokens")) errors.push(`${family.id}.${exported.name}: token evidence is incomplete`)
      }

      const directDataAttributes = source.dataAttributes
      const directAttributeNames = [...new Set(directDataAttributes.map((attribute) => attribute.name))].sort()
      const contractAttributes = renderingAttributes(exported.component)
      const contractAttributeNames = [...new Set(contractAttributes.map((attribute) => attribute.name))].sort()
      if (JSON.stringify(directAttributeNames) !== JSON.stringify(contractAttributeNames)) {
        errors.push(`${family.id}.${exported.name}: data attribute names differ from the canonical JSX`)
      }
      for (const attribute of directDataAttributes) {
        const matching = contractAttributes.filter((candidate) => candidate.name === attribute.name)
        if (!matching.length) continue
        if (attribute.expressionKind === "literal" && !matching.some((candidate) => candidate.value === attribute.value)) {
          errors.push(`${family.id}.${exported.name}: literal ${attribute.name} value is omitted`)
        }
        if (attribute.expressionKind === "conditional" && !matching.some((candidate) => ["conditional-value", "derived-condition"].includes(candidate.source))) {
          errors.push(`${family.id}.${exported.name}: conditional ${attribute.name} fact is omitted`)
        }
        if (attribute.expressionKind === "identifier" && !matching.some((candidate) => ["prop", "primitive-state"].includes(candidate.source))) {
          errors.push(`${family.id}.${exported.name}: derived ${attribute.name} target is omitted`)
        }
        if (attribute.expressionKind === "other" && !matching.some((candidate) => candidate.source === "derived-condition")) errors.push(`${family.id}.${exported.name}: unresolved data attribute expression ${attribute.name}`)
      }
      const directSlotValues = [...new Set(directDataAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.value))].sort()
      const contractSlotValues = [...new Set(contractAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.value))].sort()
      if (JSON.stringify(directSlotValues) !== JSON.stringify(contractSlotValues)) {
        errors.push(`${family.id}.${exported.name}: data-slot values differ from the canonical JSX`)
      }

      const variantsToCheck = renderings(exported.component)
      if (!variantsToCheck.length) errors.push(`${family.id}.${exported.name}: render tree is missing`)
      if (variantsToCheck.length > 1 && (source.returnCount < 2 || !source.conditionalSource)) errors.push(`${family.id}.${exported.name}: render alternatives lack source branching`)
      const expectedPortalCount = source.portalCount
      const actualPortalCount = variantsToCheck.reduce((count, rendering) => count + (rendering.portalBoundaries ?? []).length, 0)
      if (expectedPortalCount !== actualPortalCount) errors.push(`${family.id}.${exported.name}: portal count differs from canonical JSX`)
      for (const rendering of variantsToCheck) {
        const nodes = rendering.nodes ?? []
        const nodeIds = new Set(nodes.map((node: AnyRecord) => node.id))
        if (!nodeIds.has(rendering.rootNodeId) || !nodeIds.has(rendering.publicPropsTargetNodeId)) {
          errors.push(`${family.id}.${exported.name}: render root or props target is dangling`)
        }
        const target = nodes.find((node: AnyRecord) => node.id === rendering.publicPropsTargetNodeId)
        if (!target?.receivesPublicProps) errors.push(`${family.id}.${exported.name}: public props target does not receive props`)
        for (const node of nodes) {
          const childIds: string[] = []
          collectChildIds(node, childIds)
          if (childIds.some((childId) => !nodeIds.has(childId))) errors.push(`${family.id}.${exported.name}: render child target is dangling`)
        }
        for (const boundary of rendering.portalBoundaries ?? []) {
          if (!nodeIds.has(boundary.nodeId)) errors.push(`${family.id}.${exported.name}: portal boundary target is dangling`)
        }
        const knownHostTags = renderingHostTags(exported.component)
        for (const tag of knownHostTags) {
          if (!source.jsx.some((node) => jsxTag(node) === tag) && !source.sourceText.includes(`: "${tag}"`) && !source.sourceText.includes(`: \"${tag}\"`)) {
            errors.push(`${family.id}.${exported.name}: intrinsic host ${tag} is absent from source`)
          }
        }
      }
      if (source.propSpreadCount === 0) errors.push(`${family.id}.${exported.name}: public props spread is absent from source`)
    }
    if ((family.unresolved ?? []).length !== 0) errors.push(`${family.id}: contract contains unresolved source facts the direct audit did not find`)
  }
  return errors
}

function independentAudit(artifacts: { families: AnyRecord[]; interfaces: AnyRecord[] }): string[] {
  const errors: string[] = []
  const familyIds = artifacts.families.map((family) => family.id).sort()
  if (JSON.stringify(familyIds) !== JSON.stringify(expectedFamilies)) errors.push("physical family artifacts do not match the independently approved release scope")
  if (artifacts.families.length !== expectedFamilies.length) errors.push(`expected ${expectedFamilies.length} family artifacts, found ${artifacts.families.length}`)
  if (!["candidate", "approved"].includes(readJson(join(root, "contracts/components/component-contract-set.json")).status)) errors.push("component contract set has an invalid lifecycle status")
  errors.push(...directDeclarationErrors(artifacts.interfaces))
  errors.push(...directSourceErrors(artifacts.families, artifacts.interfaces))

  const evidenceReferences = collectEvidenceReferences(artifacts)
  for (const [kind, artifactList] of [["family", artifacts.families], ["interface", artifacts.interfaces]] as const) {
    for (const artifact of artifactList) {
      const availableEvidence = new Set(Object.keys(artifact.evidence ?? {}).filter((key) => artifact.evidence[key]))
      if (kind === "interface") availableEvidence.add("declaration")
      const localReferences = new Set<string>()
      collectEvidenceReferences(artifact, localReferences)
      for (const reference of localReferences) {
        if (!availableEvidence.has(reference)) errors.push(`${kind}:${artifact.id}:${reference} evidence reference has no authority record`)
      }
      for (const key of Object.keys(artifact.evidence ?? {})) {
        if (!evidenceReferences.has(key)) errors.push(`${kind}:${artifact.id}:${key} is unreferenced evidence`)
      }
    }
  }
  return errors
}

function collectEvidenceReferences(value: unknown, references: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceReferences(item, references)
    return references
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "evidenceRefs" && Array.isArray(child)) {
        for (const reference of child) references.add(String(reference))
      } else {
        collectEvidenceReferences(child, references)
      }
    }
  }

  return references
}

function findUnreferencedEvidence(): string[] {
  const artifacts = [
    ...readdirSync(familyDirectory).filter((file) => file.endsWith(".json")).map((file) => ["family", file] as const),
    ...readdirSync(interfaceDirectory).filter((file) => file.endsWith(".json")).map((file) => ["interface", file] as const),
  ]
  const references = new Set<string>()
  const records: string[] = []

  for (const [kind, file] of artifacts) {
    const artifact = readJson(join(kind === "family" ? familyDirectory : interfaceDirectory, file))
    const artifactReferences = collectEvidenceReferences(artifact)
    for (const reference of artifactReferences) references.add(reference)

    for (const evidenceKey of Object.keys(artifact.evidence ?? {})) {
      if (!artifactReferences.has(evidenceKey)) records.push(`${file}:${evidenceKey}`)
    }
  }

  return records
}

declarationProgramCache = createDeclarationProgram(loadArtifacts().interfaces)

describe("Phase 3 Task 10 independent review", () => {
  test("matches the independent 38-family oracle to the manifest and physical artifacts", () => {
    const manifest = readJson(join(root, "contracts/components/component-contract-set.json"))
    const manifestIds = manifest.familyFiles.map((path: string) => path.split("/").at(-1)!.replace(/\.json$/, "")).sort()
    const physicalIds = loadArtifacts().families.map((family) => family.id).sort()

    expect(manifest.familyCount).toBe(expectedFamilies.length)
    expect(manifestIds).toEqual(expectedFamilies)
    expect(physicalIds).toEqual(expectedFamilies)
  })

  test("audits every inherited interface through independent declaration access", () => {
    expect(directDeclarationErrors(loadArtifacts().interfaces)).toEqual([])
  })

  test.each(["empty", "group", "input", "item", "list", "separator"])("independently resolves the cmdk Command.%s declaration", (member) => {
    const artifact = interfaceById(loadArtifacts(), `cmdk.command.${member}`)
    const context = sourceDeclarationContext(artifact)
    expect(context).toBeDefined()
    expect(directDeclarationErrors([artifact])).toEqual([])
  })

  test("rejects missing cmdk static members instead of resolving them as Command", () => {
    const artifact = clone(interfaceById(loadArtifacts(), "cmdk.command.input"))
    artifact.source.symbol = "Command.Missing"
    expect(sourceDeclarationContext(artifact)).toBeUndefined()
  })

  test.each([["content", 274], ["overlay", 267], ["portal", 3]])("independently resolves Vaul %s props through its React default import", (member, count) => {
    const context = sourceDeclarationContext(interfaceById(loadArtifacts(), `vaul.drawer.${member}`))!
    expect(context.checker.getPropertiesOfType(context.propsType)).toHaveLength(count as number)
  })

  test("has no unreferenced evidence records", () => {
    expect(findUnreferencedEvidence()).toEqual([])
  })

  test("audits the independently approved 38-family scope through direct AST and declaration access", () => {
    expect(independentAudit(loadArtifacts())).toEqual([])
  })

  test("does not share the production analyzer oracle", () => {
    const testSource = readFileSync(__filename, "utf8")
    expect(testSource).not.toMatch(/src\/contracts\/components\/(?:canonical|render|inherited|.*analysis|.*reconciliation)/)
    expect(testSource).not.toMatch(/component-(?:source|token)-analysis/)
  })

  test("fails on adversarial omissions and mutations", () => {
    const cases: Array<[string, (artifacts: { families: AnyRecord[]; interfaces: AnyRecord[] }) => void]> = [
      ["public export", (artifacts) => {
        const family = familyById(artifacts, "button")
        family.exports = family.exports.filter((item: AnyRecord) => item.name !== "Button")
      }],
      ["declaration hash", (artifacts) => {
        interfaceById(artifacts, "radix.dialog.content").source.declarationSha256 = "0".repeat(64)
      }],
      ["local enum", (artifacts) => {
        exportByName(familyById(artifacts, "button"), "Button").component.localProps[0].type.values = ["mutated"]
      }],
      ["slot cardinality", (artifacts) => {
        exportByName(familyById(artifacts, "button"), "Button").component.slots[0].childCardinality.max = 2
      }],
      ["token dependency", (artifacts) => {
        const component = exportByName(familyById(artifacts, "button"), "Button").component
        component.tokenDependencies = component.tokenDependencies.filter((item: AnyRecord) => item.tokenId !== "color.primary")
      }],
      ["render attribute", (artifacts) => {
        const component = exportByName(familyById(artifacts, "button"), "Button").component
        component.rendering.nodes[0].dataAttributes = component.rendering.nodes[0].dataAttributes.filter((item: AnyRecord) => item.name !== "data-size")
      }],
      ["unresolved omission", (artifacts) => {
        familyById(artifacts, "button").unresolved = [{ topic: "mutated", scope: "test", reason: "mutated", evidenceAttempted: [], evidenceRefs: ["source"] }]
      }],
      ["evidence reference", (artifacts) => {
        familyById(artifacts, "button").evidence.source = undefined
      }],
    ]
    for (const [label, mutate] of cases) {
      const artifacts = clone(loadArtifacts())
      mutate(artifacts)
      expect(independentAudit(artifacts), label).not.toEqual([])
    }
  })
})
