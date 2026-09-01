import { canonicalRenderSourceAnalysisConventions } from "../../src/contracts/components/canonical-render-source-conventions"
import { compareJsxRenderTree as compareProductionJsxRenderTree } from "../../src/contracts/components/render-source-analysis"

export * from "../../src/contracts/components/render-source-analysis"
export { extractButtonRenderingEvidence } from "../../src/contracts/components/canonical-render-source-evidence"

/** Binds canonical fixtures to the same production analyzer and canonical adapter used by the loader. */
export function compareJsxRenderTree(...[rendering, source, conventions]: Parameters<typeof compareProductionJsxRenderTree>) {
  return compareProductionJsxRenderTree(rendering, source, conventions ?? canonicalRenderSourceAnalysisConventions)
}
