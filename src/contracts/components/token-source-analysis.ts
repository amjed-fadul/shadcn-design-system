import { readFileSync } from "node:fs"
import ts from "typescript"

import type { SourceExpressionIdentity, TokenDependency } from "./types"

export type ClassSource = { classNames: string; propName?: string; equals?: string; source: SourceExpressionIdentity }
export type UnresolvedClassSource = SourceExpressionIdentity & { reason: string }
export type ComponentTokenSourceAnalysis = { resolved: ClassSource[]; unresolved: UnresolvedClassSource[] }
export type TokenUtilityResolution = Pick<TokenDependency, "tokenId" | "viaDerivedRule">
export type TokenCoverageFinding = { utility: string; classification: string; tokenId?: string; namespace?: string }
export type ImportedRecipeRequest = Readonly<{ sourcePath: string; moduleSpecifier: string; importedName: string }>
export type ImportedRecipeResolution = Readonly<{ sourcePath: string; exportName: string }>
export type RecipeUnresolvedReason = "dynamicConfiguration" | "configurationProperty" | "dynamicVariants" | "variantProperty" | "dynamicVariantValues" | "variantValueProperty" | "dynamicDefaultVariants" | "defaultVariantProperty" | "defaultVariantValue" | "dynamicCompoundVariants" | "compoundVariant" | "compoundVariantProperty" | "dynamicInvocation" | "invocationProperty" | "unknownVariant" | "importAuthority" | "importedExport"
export type TokenSourceAnalyzerConfig = Readonly<{
  resolveUtility: (utility: string) => TokenUtilityResolution | undefined
  classMergeFunctionNames?: readonly string[]
  recipeFunctionNames?: readonly string[]
  recipeVariantsProperty?: string
  recipeCompoundVariantsProperty?: string
  recipeClassPropertyNames?: readonly string[]
  recipeUnresolvedReasons?: Partial<Record<RecipeUnresolvedReason, string>>
  resolveImportedRecipe?: (request: ImportedRecipeRequest) => ImportedRecipeResolution | undefined
  readSource?: (sourcePath: string) => string
}>

type RecipeDefinition = { call: ts.CallExpression; sourcePath: string; sourceFile: ts.SourceFile }
type ImportedBinding = { importedName: string; moduleSpecifier: string }
type Scope = { recipes: Map<string, RecipeDefinition>; importedBindings: Map<string, ImportedBinding>; values: Map<string, ts.Expression>; publicPropBindings: Set<string>; publicClassBindings: Set<string> }
type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction

function unique<T>(items: T[]) { return items.filter((item, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index) }
function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return undefined
}
function literalValue(expression: ts.Expression): string | number | boolean | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}
function nestedScope(scope: Scope): Scope { return { recipes: new Map(scope.recipes), importedBindings: new Map(scope.importedBindings), values: new Map(scope.values), publicPropBindings: new Set(scope.publicPropBindings), publicClassBindings: new Set(scope.publicClassBindings) } }
function publicPropBindings(functionLike: Pick<ts.SignatureDeclarationBase, "parameters">) {
  const bindings = new Set<string>(); const parameter = functionLike.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return bindings
  for (const element of parameter.name.elements) {
    if (ts.isIdentifier(element.name)) bindings.add(element.name.text)
  }
  return bindings
}

/** Builds a source analyzer from caller-owned syntax and utility-token rules. */
export function createTokenSourceAnalyzer(config: TokenSourceAnalyzerConfig) {
  const classMergeNames = new Set(config.classMergeFunctionNames ?? [])
  const recipeNames = new Set(config.recipeFunctionNames ?? [])
  const variantsProperty = config.recipeVariantsProperty ?? "variants"
  const compoundVariantsProperty = config.recipeCompoundVariantsProperty ?? "compoundVariants"
  const classPropertyNames = new Set(config.recipeClassPropertyNames ?? ["class", "className"])
  const recipeUnresolvedReasons: Record<RecipeUnresolvedReason, string> = {
    dynamicConfiguration: "Unsupported dynamic recipe configuration.",
    configurationProperty: "Unsupported recipe configuration property.",
    dynamicVariants: "Unsupported dynamic recipe variants.",
    variantProperty: "Unsupported recipe variant property.",
    dynamicVariantValues: "Unsupported dynamic recipe variant values.",
    variantValueProperty: "Unsupported recipe variant value property.",
    dynamicDefaultVariants: "Unsupported dynamic recipe defaults.",
    defaultVariantProperty: "Unsupported recipe default property.",
    defaultVariantValue: "Unsupported dynamic recipe default value.",
    dynamicCompoundVariants: "Unsupported dynamic recipe compound variants.",
    compoundVariant: "Unsupported dynamic recipe compound variant.",
    compoundVariantProperty: "Unsupported recipe compound variant property.",
    dynamicInvocation: "Unsupported dynamic recipe invocation.",
    invocationProperty: "Unsupported recipe invocation property.",
    unknownVariant: "Recipe invocation references an unknown variant.",
    importAuthority: "Imported recipe source is not approved.",
    importedExport: "Imported recipe export is not a static CVA recipe.",
    ...config.recipeUnresolvedReasons,
  }
  const readSource = config.readSource ?? ((sourcePath: string) => readFileSync(sourcePath, "utf8"))
  const sourceFile = (sourcePath: string) => ts.createSourceFile(sourcePath, readSource(sourcePath), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const isNamedCall = (expression: ts.Expression, names: ReadonlySet<string>): expression is ts.CallExpression => ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && names.has(expression.expression.text)
  const sourceIdentity = (node: ts.Node, sourcePath: string, file: ts.SourceFile): SourceExpressionIdentity => ({ sourcePath, start: node.getStart(file), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(file) })
  const recordUnresolved = (node: ts.Node, sourcePath: string, file: ts.SourceFile, output: ComponentTokenSourceAnalysis, reason: string) => output.unresolved.push({ ...sourceIdentity(node, sourcePath, file), reason })

  const exportedLocalRecipeName = (source: ts.SourceFile, exportName: string): string | undefined => {
    const candidates: string[] = []
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) candidates.push(exportName)
      }
      if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier) continue
      for (const element of statement.exportClause.elements) if (element.name.text === exportName) candidates.push(element.propertyName?.text ?? element.name.text)
    }
    return candidates.length === 1 ? candidates[0] : undefined
  }

  const importedRecipe = (localName: string, invocation: ts.CallExpression, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope): RecipeDefinition | undefined => {
    const binding = scope.importedBindings.get(localName)
    if (!binding) return undefined
    const resolution = config.resolveImportedRecipe?.({ sourcePath, ...binding })
    if (!resolution || resolution.exportName !== binding.importedName) {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importAuthority)
      return undefined
    }
    let importedFile: ts.SourceFile
    try { importedFile = sourceFile(resolution.sourcePath) }
    catch {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importAuthority)
      return undefined
    }
    const declarationName = exportedLocalRecipeName(importedFile, resolution.exportName)
    const declarations = importedFile.statements.flatMap((statement) => ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.filter((declaration): declaration is ts.VariableDeclaration & { name: ts.Identifier; initializer: ts.CallExpression } => ts.isIdentifier(declaration.name) && declaration.name.text === declarationName && !!declaration.initializer && isNamedCall(declaration.initializer, recipeNames))
      : [])
    if (declarations.length !== 1) {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importedExport)
      return undefined
    }
    return { call: declarations[0].initializer, sourcePath: resolution.sourcePath, sourceFile: importedFile }
  }

  const isSafeSelectorExpression = (expression: ts.Expression, scope: Scope, visited = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return isSafeSelectorExpression(expression.expression, scope, visited)
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) return true
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return isSafeSelectorExpression(expression.left, scope, new Set(visited)) && isSafeSelectorExpression(expression.right, scope, new Set(visited))
    if (!ts.isIdentifier(expression)) return false
    if (scope.publicPropBindings.has(expression.text)) return true
    if (visited.has(expression.text)) return false
    const initializer = scope.values.get(expression.text)
    if (!initializer) return false
    visited.add(expression.text)
    return isSafeSelectorExpression(initializer, scope, visited)
  }

  const classSourcesFromExpression = (expression: ts.Expression | undefined, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, context: Pick<ClassSource, "propName" | "equals"> = {}, resolving = new Set<ts.CallExpression>()): void => {
    if (!expression) return
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) { output.resolved.push({ classNames: expression.text, ...context, source: sourceIdentity(expression, sourcePath, file) }); return }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) { classSourcesFromExpression(expression.expression, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isConditionalExpression(expression)) { classSourcesFromExpression(expression.whenTrue, output, sourcePath, file, scope, context, resolving); classSourcesFromExpression(expression.whenFalse, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { classSourcesFromExpression(expression.right, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, classMergeNames)) { for (const argument of expression.arguments) classSourcesFromExpression(argument, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, recipeNames)) { recipeClassSources({ call: expression, sourcePath, sourceFile: file }, output, scope, undefined, resolving); return }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      const definition = scope.recipes.get(expression.expression.text) ?? importedRecipe(expression.expression.text, expression, output, sourcePath, file, scope)
      if (definition) recipeClassSources(definition, output, scope, expression, resolving)
      else if (!scope.importedBindings.has(expression.expression.text)) recordUnresolved(expression, sourcePath, file, output, "Unsupported dynamic class expression.")
      return
    }
    if (ts.isIdentifier(expression) && scope.recipes.has(expression.text)) { recipeClassSources(scope.recipes.get(expression.text)!, output, scope, undefined, resolving); return }
    if (ts.isIdentifier(expression) && scope.publicClassBindings.has(expression.text)) return
    recordUnresolved(expression, sourcePath, file, output, ts.isTemplateExpression(expression) ? "Template interpolation prevents factual class resolution." : "Unsupported dynamic class expression.")
  }

  const recipeClassSources = (definitionRecord: RecipeDefinition, output: ComponentTokenSourceAnalysis, scope: Scope, invocation?: ts.CallExpression, resolving = new Set<ts.CallExpression>()): void => {
    const { call, sourcePath, sourceFile: file } = definitionRecord
    if (resolving.has(call)) return
    resolving.add(call); classSourcesFromExpression(call.arguments[0], output, sourcePath, file, scope, {}, resolving)
    const definition = call.arguments[1]
    if (!definition) { resolving.delete(call); return }
    if (!ts.isObjectLiteralExpression(definition)) { recordUnresolved(definition, sourcePath, file, output, recipeUnresolvedReasons.dynamicConfiguration); resolving.delete(call); return }
    for (const property of definition.properties) if (!ts.isPropertyAssignment(property)) recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.configurationProperty)
    for (const property of definition.properties) if (ts.isPropertyAssignment(property) && !staticPropertyName(property.name)) recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.configurationProperty)
    const assignment = (name: string) => definition.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && staticPropertyName(property.name) === name)?.initializer
    const variants = assignment(variantsProperty)
    if (variants && !ts.isObjectLiteralExpression(variants)) recordUnresolved(variants, sourcePath, file, output, recipeUnresolvedReasons.dynamicVariants)
    const variantNames = new Set<string>()
    const defaults = new Map<string, string | number | boolean>()
    const defaultVariants = assignment("defaultVariants")
    if (defaultVariants && !ts.isObjectLiteralExpression(defaultVariants)) recordUnresolved(defaultVariants, sourcePath, file, output, recipeUnresolvedReasons.dynamicDefaultVariants)
    if (defaultVariants && ts.isObjectLiteralExpression(defaultVariants)) for (const property of defaultVariants.properties) {
      if (!ts.isPropertyAssignment(property) || !staticPropertyName(property.name)) { recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.defaultVariantProperty); continue }
      const value = literalValue(property.initializer)
      if (value === undefined) { recordUnresolved(property.initializer, sourcePath, file, output, recipeUnresolvedReasons.defaultVariantValue); continue }
      defaults.set(staticPropertyName(property.name)!, value)
    }
    type Selection = { kind: "dynamic" } | { kind: "literal"; value: string | number | boolean }
    const selections = new Map<string, Selection>()
    let invocationValid = true
    if (invocation) {
      if (invocation.arguments.length > 1 || (invocation.arguments[0] && !ts.isObjectLiteralExpression(invocation.arguments[0]))) {
        recordUnresolved(invocation.arguments[0] ?? invocation, invocation.getSourceFile().fileName, invocation.getSourceFile(), output, recipeUnresolvedReasons.dynamicInvocation)
        invocationValid = false
      } else if (invocation.arguments[0] && ts.isObjectLiteralExpression(invocation.arguments[0])) {
        for (const property of invocation.arguments[0].properties) {
          if ((!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) || !staticPropertyName(property.name)) {
            recordUnresolved(property, invocation.getSourceFile().fileName, invocation.getSourceFile(), output, recipeUnresolvedReasons.invocationProperty)
            invocationValid = false
            continue
          }
          const name = staticPropertyName(property.name)!
          if (classPropertyNames.has(name)) continue
          const initializer = ts.isPropertyAssignment(property) ? property.initializer : property.name
          const value = literalValue(initializer)
          if (value === undefined && !isSafeSelectorExpression(initializer, scope)) {
            recordUnresolved(initializer, invocation.getSourceFile().fileName, invocation.getSourceFile(), output, recipeUnresolvedReasons.dynamicInvocation)
            invocationValid = false
          } else selections.set(name, value === undefined ? { kind: "dynamic" } : { kind: "literal", value })
        }
      }
    }
    if (variants && ts.isObjectLiteralExpression(variants)) for (const variant of variants.properties) {
      const variantName = ts.isPropertyAssignment(variant) ? staticPropertyName(variant.name) : undefined
      if (!ts.isPropertyAssignment(variant) || !variantName) { recordUnresolved(variant, sourcePath, file, output, recipeUnresolvedReasons.variantProperty); continue }
      variantNames.add(variantName)
      if (!ts.isObjectLiteralExpression(variant.initializer)) { recordUnresolved(variant.initializer, sourcePath, file, output, recipeUnresolvedReasons.dynamicVariantValues); continue }
      for (const value of variant.initializer.properties) {
        const valueName = ts.isPropertyAssignment(value) ? staticPropertyName(value.name) : undefined
        if (!ts.isPropertyAssignment(value) || !valueName) { recordUnresolved(value, sourcePath, file, output, recipeUnresolvedReasons.variantValueProperty); continue }
        if (!invocation) classSourcesFromExpression(value.initializer, output, sourcePath, file, scope, { propName: variantName, equals: valueName }, resolving)
        else if (invocationValid) {
          const selected = selections.get(variantName)
          if (selected?.kind === "dynamic") classSourcesFromExpression(value.initializer, output, sourcePath, file, scope, { propName: variantName, equals: valueName }, resolving)
          else {
            const selectedValue = selected?.value ?? defaults.get(variantName)
            if (String(selectedValue) === valueName) classSourcesFromExpression(value.initializer, output, sourcePath, file, scope, {}, resolving)
          }
        }
      }
    }
    if (invocation && invocationValid) for (const [name] of selections) if (!variantNames.has(name)) {
      recordUnresolved(invocation.arguments[0]!, invocation.getSourceFile().fileName, invocation.getSourceFile(), output, recipeUnresolvedReasons.unknownVariant)
      invocationValid = false
    }
    const compoundVariants = assignment(compoundVariantsProperty)
    if (compoundVariants && !ts.isArrayLiteralExpression(compoundVariants)) recordUnresolved(compoundVariants, sourcePath, file, output, recipeUnresolvedReasons.dynamicCompoundVariants)
    if (compoundVariants && ts.isArrayLiteralExpression(compoundVariants)) for (const variant of compoundVariants.elements) {
      if (!ts.isObjectLiteralExpression(variant)) { if (ts.isExpression(variant)) recordUnresolved(variant, sourcePath, file, output, recipeUnresolvedReasons.compoundVariant); continue }
      for (const property of variant.properties) {
        if (!ts.isPropertyAssignment(property)) { recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.compoundVariantProperty); continue }
        const name = staticPropertyName(property.name)
        if (!name) { recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.compoundVariantProperty); continue }
        if (classPropertyNames.has(name)) classSourcesFromExpression(property.initializer, output, sourcePath, file, scope, {}, resolving)
      }
    }
    resolving.delete(call)
  }

  const topLevelScope = (source: ts.SourceFile, sourcePath: string): Scope => {
    const recipes = new Map<string, RecipeDefinition>()
    const importedBindings = new Map<string, ImportedBinding>()
    const values = new Map<string, ts.Expression>()
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        values.set(declaration.name.text, declaration.initializer)
        if (isNamedCall(declaration.initializer, recipeNames)) recipes.set(declaration.name.text, { call: declaration.initializer, sourcePath, sourceFile: source })
      }
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue
      for (const element of statement.importClause.namedBindings.elements) importedBindings.set(element.name.text, { importedName: element.propertyName?.text ?? element.name.text, moduleSpecifier: statement.moduleSpecifier.text })
    }
    return { recipes, importedBindings, values, publicPropBindings: new Set(), publicClassBindings: new Set() }
  }
  const findTopLevelFunction = (source: ts.SourceFile, exportName: string): SourceFunction | undefined => {
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName) return statement
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName || !declaration.initializer) continue
        if (ts.isArrowFunction(declaration.initializer)) return declaration.initializer
        let nested: ts.ArrowFunction | undefined
        const findArrow = (node: ts.Node): void => {
          if (nested) return
          if (ts.isArrowFunction(node)) nested = node
          else ts.forEachChild(node, findArrow)
        }
        findArrow(declaration.initializer)
        if (nested) return nested
      }
    }
    return undefined
  }
  const analyze = (sourcePath: string, exportName?: string): ComponentTokenSourceAnalysis => {
    const source = sourceFile(sourcePath); const declaration = exportName ? findTopLevelFunction(source, exportName) : undefined
    if (exportName && !declaration?.body) return { resolved: [], unresolved: [{ sourcePath, start: 0, end: 0, expressionKind: "SourceFile", sourceText: exportName, reason: "No component source found." }] }
    const output: ComponentTokenSourceAnalysis = { resolved: [], unresolved: [] }
    const visit = (node: ts.Node, scope: Scope): void => {
      if (ts.isSourceFile(node) || ts.isBlock(node)) { const nested = nestedScope(scope); for (const statement of node.statements) visit(statement, nested); return }
      if (ts.isFunctionLike(node) && node !== declaration) { const nested = nestedScope(scope); for (const binding of publicPropBindings(node)) { nested.publicPropBindings.add(binding); if (binding === "className") nested.publicClassBindings.add(binding) } if ("body" in node && node.body) visit(node.body, nested); return }
      if (ts.isVariableStatement(node)) { for (const child of node.declarationList.declarations) if (ts.isIdentifier(child.name) && child.initializer) { scope.values.set(child.name.text, child.initializer); if (isNamedCall(child.initializer, recipeNames)) scope.recipes.set(child.name.text, { call: child.initializer, sourcePath, sourceFile: source }) } ts.forEachChild(node, (child) => visit(child, scope)); return }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) { if (ts.isStringLiteral(node.initializer)) output.resolved.push({ classNames: node.initializer.text, source: sourceIdentity(node.initializer, sourcePath, source) }); else if (ts.isJsxExpression(node.initializer)) classSourcesFromExpression(node.initializer.expression, output, sourcePath, source, scope); return }
      if (isNamedCall(node as ts.Expression, classMergeNames)) { classSourcesFromExpression(node as ts.CallExpression, output, sourcePath, source, scope); return }
      ts.forEachChild(node, (child) => visit(child, scope))
    }
    const scope = topLevelScope(source, sourcePath)
    if (declaration) { for (const binding of publicPropBindings(declaration)) { scope.publicPropBindings.add(binding); if (binding === "className") scope.publicClassBindings.add(binding) } visit(declaration.body!, scope) } else visit(source, scope)
    return { resolved: unique(output.resolved), unresolved: unique(output.unresolved) }
  }
  const analyzeTailwindTokenDependencies = (classNames: string, evidenceRefs: string[] = ["source"]): TokenDependency[] => unique(classNames.split(/\s+/).filter(Boolean).flatMap((rawUtility) => {
    const utility = rawUtility.split(":").at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
    const resolution = config.resolveUtility(utility)
    return resolution ? [{ ...resolution, evidenceRefs }] : []
  }))
  const dependencies = (sourcePath: string, exportName?: string) => unique(analyze(sourcePath, exportName).resolved.flatMap((recipe) => analyzeTailwindTokenDependencies(recipe.classNames).map((dependency) => recipe.propName && recipe.equals ? { ...dependency, when: { propName: recipe.propName, equals: recipe.equals } } : dependency)))
  const key = ({ tokenId, when, viaDerivedRule }: Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">) => JSON.stringify({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })
  const compare = (sourcePath: string, dependencies: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, exportName?: string, includeUnresolved = true, analysis = analyze(sourcePath, exportName)) => {
    const expected = new Set((exportName ? dependenciesForExport(sourcePath, exportName) : dependenciesForSource(sourcePath)).map(key)); const actual = new Set(dependencies.map(key)); const suffix = exportName ? ` for ${exportName}` : ""
    return [...(includeUnresolved ? analysis.unresolved.map((item) => `Unresolved class evidence at ${sourcePath}:${item.start}: ${item.reason} (${item.sourceText})`) : []), ...[...expected].filter((value) => !actual.has(value)).map((value) => `Missing source token dependency${suffix}: ${value}`), ...[...actual].filter((value) => !expected.has(value)).map((value) => `Invented token dependency${suffix}: ${value}`)]
  }
  const dependenciesForSource = (sourcePath: string) => dependencies(sourcePath)
  const dependenciesForExport = (sourcePath: string, exportName: string) => dependencies(sourcePath, exportName)
  return {
    analyzeTailwindTokenDependencies,
    analyzeComponentTokenSource: (sourcePath: string) => analyze(sourcePath),
    analyzeComponentTokenSourceForExport: (sourcePath: string, exportName: string) => analyze(sourcePath, exportName),
    analyzeComponentTokenDependencies: dependenciesForSource,
    analyzeComponentTokenDependenciesForExport: dependenciesForExport,
    compareComponentTokenDependencies: (sourcePath: string, contract: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, includeUnresolved = true) => compare(sourcePath, contract, undefined, includeUnresolved),
    compareComponentTokenDependenciesForExport: (sourcePath: string, exportName: string, contract: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, includeUnresolved = true, analysis = analyze(sourcePath, exportName)) => compare(sourcePath, contract, exportName, includeUnresolved, analysis),
  }
}
