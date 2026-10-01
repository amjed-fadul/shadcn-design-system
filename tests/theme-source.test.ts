import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")

describe("canonical shadcn theme source", () => {
  test("keeps the neutral semantic token sets with the brand blue layer", () => {
    expect(css).toContain(":root")
    expect(css).toContain(".dark")
    expect(css).toContain("--background: oklch(1 0 0)")
    expect(css).toContain("--primary: oklch(0.488 0.243 264.376)")
    expect(css).toContain("--radius: 0.5rem")
    expect(css).toContain("--background: oklch(0.145 0 0)")
    expect(css).toContain("--primary: oklch(0.707 0.165 254.624)")
  })

  test("does not import Canvas host-specific tokens into the design system", () => {
    expect(css).not.toContain("--host-chrome-surface")
    expect(css).not.toContain("--canvas-surface")
    expect(css).not.toContain("--canvas-status-ready")
    expect(css).not.toContain("--canvas-status-experiment")
  })
})
