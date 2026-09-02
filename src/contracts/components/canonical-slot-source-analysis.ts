import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"

import { analyzeConfiguredDelegatedHostFacts, type DelegatedHostSourceAnalysis } from "./delegated-host-source-analysis"

const requireFromCanonicalSource = createRequire(import.meta.url)

/** Canonical source ownership recognizes the repository's delegated-host implementation. */
function isCanonicalDelegatedHost(expression: ts.Expression): boolean {
  return ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === "Slot" && expression.name.text === "Root"
}

const canonicalDelegatedHostRuntimeSource = fileURLToPath(new URL("../../../node_modules/@radix-ui/react-slot/dist/index.js", import.meta.url))
const radixPrimitiveRuntimeSource = fileURLToPath(new URL("../../../node_modules/@radix-ui/react-primitive/dist/index.js", import.meta.url))
const radixUiRuntimeSource = fileURLToPath(new URL("../../../node_modules/radix-ui/dist/index.js", import.meta.url))
const radixSlottableRequirement = "multiple children require a Radix Slottable that resolves to one React element"
const packageMemberDelegationCache = new Map<string, { source: string; results: Map<string, boolean> }>()

/**
 * Only these canonical wrappers expose delegated-child facts in the component
 * artifact. The list is deliberately adapter-local: the generic analyzer does
 * not infer a design system's public slot convention from a prop name.
 */
const canonicalPackageDelegatedSlotExports: Readonly<Record<string, ReadonlySet<string>>> = {
  dialog: new Set(["DialogClose", "DialogContent", "DialogDescription", "DialogOverlay", "DialogTitle", "DialogTrigger"]),
  "dropdown-menu": new Set(["DropdownMenuCheckboxItem", "DropdownMenuContent", "DropdownMenuGroup", "DropdownMenuItem", "DropdownMenuLabel", "DropdownMenuRadioGroup", "DropdownMenuRadioItem", "DropdownMenuSeparator", "DropdownMenuSubContent", "DropdownMenuSubTrigger", "DropdownMenuTrigger"]),
  select: new Set(["SelectContent", "SelectGroup", "SelectItem", "SelectLabel", "SelectScrollDownButton", "SelectScrollUpButton", "SelectSeparator", "SelectTrigger", "SelectValue"]),
  sheet: new Set(["SheetClose", "SheetContent", "SheetDescription", "SheetTitle", "SheetTrigger"]),
}

const canonicalLocalDelegatedSlotExports: Readonly<Record<string, ReadonlySet<string>>> = {
  badge: new Set(["Badge"]),
  button: new Set(["Button"]),
  sidebar: new Set(["SidebarGroupLabel", "SidebarGroupAction", "SidebarMenuButton", "SidebarMenuAction", "SidebarMenuSubButton"]),
}

function isCanonicalPackageDelegatedSlotExport(sourcePath: string, exportName: string) {
  return canonicalPackageDelegatedSlotExports[basename(sourcePath).replace(/\.tsx?$/, "")]?.has(exportName) ?? false
}

/** The canonical adapter owns which public slot props must retain source evidence. */
export function canonicalSourceOwnedSlotPropNames(sourcePath: string, exportName: string): readonly string[] {
  const sourceId = basename(sourcePath).replace(/\.tsx?$/, "")
  return canonicalPackageDelegatedSlotExports[sourceId]?.has(exportName) || canonicalLocalDelegatedSlotExports[sourceId]?.has(exportName)
    ? ["asChild"]
    : []
}

type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
function sourceFile(sourcePath: string) {
  return ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function forwardRefCallback(initializer: ts.Expression | undefined): ts.ArrowFunction | ts.FunctionExpression | undefined {
  if (!initializer || !ts.isCallExpression(initializer)) return undefined
  return initializer.arguments.find((argument): argument is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
}

function sourceFunction(file: ts.SourceFile, exportName: string): SourceFunction | undefined {
  let result: SourceFunction | undefined
  const visit = (node: ts.Node) => {
    if (result) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === exportName) result = node
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === exportName) {
      if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) result = node.initializer
      else result = forwardRefCallback(node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

function restProps(declaration: SourceFunction) {
  const names = new Set<string>()
  const parameter = declaration.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return names
  for (const element of parameter.name.elements) if (element.dotDotDotToken && ts.isIdentifier(element.name)) names.add(element.name.text)
  return names
}

function importedRadixNamespaces(file: ts.SourceFile) {
  const imports = new Map<string, string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "radix-ui") continue
    for (const specifier of statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) ? statement.importClause.namedBindings.elements : []) {
      imports.set(specifier.name.text, specifier.propertyName?.text ?? specifier.name.text)
    }
  }
  return imports
}

function forwardsRestProps(opening: ts.JsxOpeningLikeElement, names: ReadonlySet<string>) {
  return opening.attributes.properties.some((attribute) => ts.isJsxSpreadAttribute(attribute) && ts.isIdentifier(attribute.expression) && names.has(attribute.expression.text))
}

function radixPackageRuntime(namespace: string): string | undefined {
  const runtime = readFileSync(radixUiRuntimeSource, "utf8")
  const match = runtime.match(new RegExp(`var ${namespace} = __toESM\\(require\\("([^"]+)"\\)\\);`))
  return match ? requireFromCanonicalSource.resolve(match[1]) : undefined
}

function packageMemberTarget(source: string, member: string): string | undefined {
  const match = source.match(new RegExp(`\\b${member}: \\(\\) => ([A-Za-z_$][\\w$]*)`))
  return match?.[1]
}

function packageMemberDelegatesToSlot(runtime: string, member: string, visitedMembers = new Set<string>(), importDepth = 0): boolean {
  const memberKey = `${runtime}\u0000${member}`
  if (visitedMembers.has(memberKey)) return false
  visitedMembers.add(memberKey)
  const source = readFileSync(runtime, "utf8")
  const cached = packageMemberDelegationCache.get(runtime)
  const entry = cached?.source === source
    ? cached
    : { source, results: new Map<string, boolean>() }
  packageMemberDelegationCache.set(runtime, entry)
  const known = entry.results.get(member)
  if (known !== undefined) return known
  const target = packageMemberTarget(source, member)
  if (!target) return false
  const file = sourceFile(runtime)
  const declarations = new Map<string, ts.VariableDeclaration>()
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, declaration)
  }
  const importedRuntime = (name: string) => {
    const initializer = declarations.get(name)?.initializer?.getText(file)
    const match = initializer?.match(/require\("([^"]+)"\)/)
    return match ? requireFromCanonicalSource.resolve(match[1]) : undefined
  }
  const reachesDelegatingHost = (name: string, visited = new Set<string>()): boolean => {
    if (visited.has(name)) return false
    visited.add(name)
    const declaration = declarations.get(name)
    if (!declaration?.initializer) return false
    const text = declaration.initializer.getText(file)
    if (text.includes("import_react_primitive.Primitive.") || /\basChild\s*:/.test(text)) return true
    if (ts.isIdentifier(declaration.initializer) && declarations.has(declaration.initializer.text)) return reachesDelegatingHost(declaration.initializer.text, visited)
    let delegated = false
    const visit = (node: ts.Node) => {
      if (delegated) return
      if (ts.isCallExpression(node)) {
        const host = node.arguments[0]
        const props = node.arguments[1]
        const forwardsProps = props && ts.isObjectLiteralExpression(props) && props.properties.some((property) => ts.isSpreadAssignment(property))
        if (importDepth === 0 && forwardsProps && host && ts.isPropertyAccessExpression(host) && ts.isIdentifier(host.expression)) {
          const imported = importedRuntime(host.expression.text)
          if (imported && packageMemberDelegatesToSlot(imported, host.name.text, visitedMembers, importDepth + 1)) delegated = true
        }
        if (forwardsProps && host && ts.isIdentifier(host) && declarations.has(host.text) && reachesDelegatingHost(host.text, visited)) delegated = true
      }
      ts.forEachChild(node, visit)
    }
    visit(declaration.initializer)
    return delegated
  }
  const result = reachesDelegatingHost(target)
  entry.results.set(member, result)
  return result
}

function resolvedSlotCardinality(runtimePath: string) {
  const runtime = readFileSync(runtimePath, "utf8")
  return runtime.includes("React.Children.count(children) === 1")
    && runtime.includes("createSlottable")
    && runtime.includes("if (!slottableElement)")
    && runtime.includes("throw new Error")
    ? { min: 0, max: 1 }
    : { min: 0, max: Number.MAX_SAFE_INTEGER }
}

function hasRadixSlotRuntimeEvidence() {
  const primitive = readFileSync(radixPrimitiveRuntimeSource, "utf8")
  const slot = readFileSync(canonicalDelegatedHostRuntimeSource, "utf8")
  return primitive.includes("const Comp = asChild ? Slot : node")
    && slot.includes("React.Children.count(children) === 1")
    && slot.includes("createSlottable")
    && slot.includes("if (!slottableElement)")
    && slot.includes("if (children || children === 0)")
}

/** Resolves package-exported Radix primitives through their installed runtime and Slot implementation. */
function analyzeCanonicalPackagePrimitiveFacts(sourcePath: string, exportName: string): DelegatedHostSourceAnalysis {
  if (!isCanonicalPackageDelegatedSlotExport(sourcePath, exportName)) return { facts: [], errors: [] }
  if (!hasRadixSlotRuntimeEvidence()) return { facts: [], errors: ["Unable to resolve Radix Slot runtime behavior."] }
  const file = sourceFile(sourcePath)
  const declaration = sourceFunction(file, exportName)
  if (!declaration) return { facts: [], errors: [] }
  const namespaces = importedRadixNamespaces(file)
  const publicRestProps = restProps(declaration)
  const facts: import("./source-reconciliation").SourceOwnedSlotFact[] = []
  const errors: string[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ts.isPropertyAccessExpression(node.tagName) && ts.isIdentifier(node.tagName.expression)) {
      const namespace = namespaces.get(node.tagName.expression.text)
      if (namespace && forwardsRestProps(node, publicRestProps)) {
        const runtime = radixPackageRuntime(namespace)
        const member = node.tagName.name.text
        if (!runtime || !packageMemberDelegatesToSlot(runtime, member)) {
          errors.push(`Unable to resolve delegated primitive behavior for ${node.tagName.getText()}.`)
        } else {
          facts.push({ propName: "asChild", replacesHost: true, forwardsProps: true, childCardinality: { min: 0, max: 1 }, childRequires: [radixSlottableRequirement] })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  if (declaration.body) visit(declaration.body)
  return { facts: facts.filter((fact, index, all) => all.findIndex((candidate) => candidate.propName === fact.propName) === index), errors }
}

/** The source file whose runtime child guard proves the selected host's cardinality. */
export function canonicalDelegatedHostEvidencePaths(): readonly string[] {
  const packageRuntimes = ["Dialog", "DropdownMenu", "Select"].flatMap((namespace) => {
    const runtime = radixPackageRuntime(namespace)
    return runtime ? [runtime] : []
  })
  return [...new Set([canonicalDelegatedHostRuntimeSource, radixPrimitiveRuntimeSource, radixUiRuntimeSource, ...packageRuntimes])]
}

export type CanonicalDelegatedHostAnalysisOptions = { localSlotRuntimePath?: string }

/** Extracts canonical delegated-host facts; generic reconciliation receives only these neutral facts. */
export function analyzeCanonicalDelegatedHostFacts(sourcePath: string, exportName: string, options: CanonicalDelegatedHostAnalysisOptions = {}): DelegatedHostSourceAnalysis {
  const localSlotRuntimePath = options.localSlotRuntimePath ?? canonicalDelegatedHostRuntimeSource
  const local = analyzeConfiguredDelegatedHostFacts(sourcePath, exportName, {
    matchesReplacementHost: isCanonicalDelegatedHost,
    resolveReplacementHostSource: (expression) => isCanonicalDelegatedHost(expression) ? localSlotRuntimePath : undefined,
  })
  const packagePrimitive = analyzeCanonicalPackagePrimitiveFacts(sourcePath, exportName)
  const localCardinality = resolvedSlotCardinality(localSlotRuntimePath)
  const localFacts = local.facts.map((fact) => ({ ...fact, childCardinality: localCardinality })).map((fact) => fact.childCardinality.max === 1
    ? { ...fact, childRequires: [radixSlottableRequirement] }
    : fact)
  return { facts: [...localFacts, ...packagePrimitive.facts], errors: [...local.errors, ...packagePrimitive.errors] }
}
