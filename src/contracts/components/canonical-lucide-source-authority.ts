import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import componentContractSource from "../../../provenance/component-contract-source.json"

// Resolve named SVG components from the pinned declaration, including aliases
// such as Loader2 and CheckCircle2. Factories and the generic Icon renderer do
// not satisfy this declaration shape and cannot authorize an SVG host.
const authority = componentContractSource.packages["lucide-react"]
const declarationPath = fileURLToPath(new URL(`../../../${authority.declarationPath}`, import.meta.url))
const declarationText = readFileSync(declarationPath, "utf8")
if (createHash("sha256").update(declarationText).digest("hex") !== authority.declarationSha256) {
  throw new Error("Canonical Lucide SVG authority declaration does not match its pinned source hash.")
}
const declaration = ts.createSourceFile(declarationPath, declarationText, ts.ScriptTarget.Latest, true)
const svgDeclarations = new Set<string>()
for (const statement of declaration.statements) {
  if (!ts.isVariableStatement(statement)) continue
  for (const variable of statement.declarationList.declarations) {
    if (!ts.isIdentifier(variable.name) || !variable.type || !ts.isTypeReferenceNode(variable.type) || variable.type.typeName.getText(declaration) !== "react.ForwardRefExoticComponent") continue
    const typeText = variable.type.getText(declaration)
    if (/ForwardRefExoticComponent</.test(typeText) && /Omit<LucideProps, ["']ref["']>/.test(typeText) && /RefAttributes<SVGSVGElement>/.test(typeText)) svgDeclarations.add(variable.name.text)
  }
}
const namedSvgExports = new Set<string>()
for (const statement of declaration.statements) {
  if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue
  for (const member of statement.exportClause.elements) {
    if (svgDeclarations.has(member.propertyName?.text ?? member.name.text)) namedSvgExports.add(member.name.text)
  }
}

export function isCanonicalLucideSvgExport(name: string): boolean {
  return namedSvgExports.has(name)
}
