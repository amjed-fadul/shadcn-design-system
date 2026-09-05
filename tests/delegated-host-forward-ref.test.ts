import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import ts from "typescript"
import { expect, test } from "vitest"
import { analyzeConfiguredDelegatedHostFacts } from "../src/contracts/components/delegated-host-source-analysis"

for (const [factory, accepted] of [["React.forwardRef", true], ["untrustedFactory", false]] as const) {
  test(`delegated host analysis ${accepted ? "recognizes React.forwardRef render" : "does not trust an arbitrary factory"}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "ref-analysis-"))
    const file = join(directory, "fixture.tsx")
    try {
      writeFileSync(file, `import * as React from "react";
        const Surface = ${factory}(({ asChild = false, ...props }, ref) => {
          const Host = asChild ? Delegate : "button";
          return <Host ref={ref} {...props} />;
        });`)
      const result = analyzeConfiguredDelegatedHostFacts(file, "Surface", { matchesReplacementHost: expression => ts.isIdentifier(expression) && expression.text === "Delegate" })
      expect(result.errors).toEqual([])
      if (accepted) expect(result.facts).toEqual([expect.objectContaining({ propName: "asChild", forwardsProps: true })])
      else expect(result.facts).toEqual([])
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
}
