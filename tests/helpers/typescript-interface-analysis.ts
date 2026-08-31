import ts from "typescript"

import type { StructuredPropType } from "../../src/contracts/components/types"

export type InterfacePropEvidence = { name: string; required: boolean; typeText: string }

export function classifyTypeText(typeText: string): StructuredPropType {
  if (typeText === "boolean") return { kind: "boolean" }
  if (typeText === "string") return { kind: "string" }
  if (typeText === "number") return { kind: "number" }
  return { kind: "typescript", typeText }
}

export function analyzeIntrinsicReactInterface(tag: keyof React.JSX.IntrinsicElements): InterfacePropEvidence[] {
  const declarationPath = ts.resolveTypeReferenceDirective("react", import.meta.filename, { moduleResolution: ts.ModuleResolutionKind.Node10 }, ts.sys).resolvedTypeReferenceDirective?.resolvedFileName
  if (!declarationPath) throw new Error("Unable to resolve the pinned React declaration source.")
  const program = ts.createProgram([declarationPath], { target: ts.ScriptTarget.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10, skipLibCheck: true, types: [] })
  const checker = program.getTypeChecker(); const file = program.getSourceFile(declarationPath)!; let buttonType: ts.Type | undefined
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "IntrinsicElements") {
      const property = node.members.find((member): member is ts.PropertySignature => ts.isPropertySignature(member) && member.name && ts.isStringLiteral(member.name) ? member.name.text === tag : ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) && member.name.text === tag)
      if (property) buttonType = checker.getTypeAtLocation(property)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!buttonType) throw new Error(`Unable to resolve React.JSX.IntrinsicElements[${String(tag)}].`)
  return checker.getPropertiesOfType(buttonType).map((symbol) => { const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? file; const type = checker.getTypeOfSymbolAtLocation(symbol, declaration); return { name: symbol.getName(), required: !(symbol.getFlags() & ts.SymbolFlags.Optional), typeText: checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation) } }).sort((a, b) => a.name.localeCompare(b.name))
}
