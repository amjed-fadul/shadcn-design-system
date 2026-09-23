import { readFileSync } from "node:fs"
import ts from "typescript"

import type { SourceEvidenceResult } from "./source-reconciliation"

type Limitation = { familyId: string; exportName: string; topic: string; scope: string; reason: string; kind: ts.SyntaxKind; startsWith: string; requiredSnippets: readonly string[] }

// These expressions are fully understood by the JSX analyzer, but their dynamic
// structure cannot be expressed by the current render contract. Anchor each
// boundary to one exact canonical AST node so source changes fail closed.
export const canonicalModelLimitations: readonly Limitation[] = [
  {
    familyId: "field", exportName: "FieldError", topic: "FieldError conditional render shape", scope: "FieldError internal rendering", kind: ts.SyntaxKind.IfStatement, startsWith: "if (!content) return null", requiredSnippets: ["useMemo(", "if (!errors?.length) return null", "uniqueErrors.length === 1", "uniqueErrors.map(", "error?.message && <li"],
    reason: "The render-contract model does not represent FieldError's null/absent render, computed useMemo content, single-message branch, deduplicated list branch, or conditional repeated li children. The recorded div and role=alert describe only the rendered container, not an unconditional render or complete child tree.",
  },
  {
    familyId: "slider", exportName: "Slider", topic: "dynamic Slider Thumb rendering", scope: "Slider internal render tree and Thumb cardinality", kind: ts.SyntaxKind.CallExpression, startsWith: "values.map((_, index) => (", requiredSnippets: ["Array.isArray(value)", "Array.isArray(defaultValue)", ": [min]", "<SliderPrimitive.Thumb"],
    reason: "The render-contract model has no repeated-child or dynamic-cardinality field. Slider maps values derived from value, otherwise defaultValue, otherwise [min] to Thumb JSX; the single thumb edge records a template only and does not assert one rendered Thumb.",
  },
  {
    familyId: "toggle-group", exportName: "ToggleGroupItem", topic: "context-derived Toggle Group item data attributes", scope: "ToggleGroupItem render facts", kind: ts.SyntaxKind.VariableDeclaration, startsWith: "resolvedVariant = context.variant ?? variant", requiredSnippets: ["context.size ?? size", "data-variant={resolvedVariant}", "data-size={resolvedSize}", "data-spacing={context.spacing}", "{...props}"],
    reason: "The render-contract model cannot express data-variant, data-size, and data-spacing as parent ToggleGroupContext-derived values with local variant/size fallbacks and later forwarded-prop overrides. The primitive-state labels record local expression targets only; they do not establish the final attribute values or make item-local variant/size authoritative.",
  },
]

export function analyzeCanonicalModelLimitations(path: string, sourcePath: string, familyId: string): { analyses: SourceEvidenceResult[]; errors: string[] } {
  const sourceText = readFileSync(path, "utf8")
  const sourceFile = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const analyses: SourceEvidenceResult[] = []
  const errors: string[] = []
  for (const limitation of canonicalModelLimitations.filter((item) => item.familyId === familyId)) {
    const declaration = sourceFile.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === limitation.exportName)
    if (!declaration || limitation.requiredSnippets.some((snippet) => !declaration.getText(sourceFile).includes(snippet))) {
      errors.push(`Family ${familyId} model limitation ${limitation.topic} no longer has its complete canonical source shape.`)
      continue
    }
    const matches: ts.Node[] = []
    const visit = (node: ts.Node) => {
      if (node.kind === limitation.kind && node.getText(sourceFile).startsWith(limitation.startsWith)) matches.push(node)
      ts.forEachChild(node, visit)
    }
    visit(declaration)
    if (matches.length !== 1) {
      errors.push(`Family ${familyId} model limitation ${limitation.topic} has ${matches.length} canonical source anchors.`)
      continue
    }
    const node = matches[0]
    analyses.push({ topic: limitation.topic, scope: limitation.scope, unresolved: [{
      sourcePath, start: node.getStart(sourceFile), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(sourceFile), reason: limitation.reason,
    }] })
  }
  return { analyses, errors }
}
