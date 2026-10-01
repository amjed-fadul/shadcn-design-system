import { expect, test } from "vitest"
import { isCanonicalLucideSvgExport } from "../src/contracts/components/canonical-lucide-source-authority"

test("recognizes pinned named SVG aliases but rejects Lucide factories and opaque renderers", () => {
  expect(isCanonicalLucideSvgExport("Loader2")).toBe(true)
  expect(isCanonicalLucideSvgExport("CheckCircle2")).toBe(true)
  expect(isCanonicalLucideSvgExport("Search")).toBe(true)
  expect(isCanonicalLucideSvgExport("createLucideIcon")).toBe(false)
  expect(isCanonicalLucideSvgExport("Icon")).toBe(false)
  expect(isCanonicalLucideSvgExport("Unknown")).toBe(false)
})
