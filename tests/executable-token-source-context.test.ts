import { describe, expect, test } from "vitest"

import { projectExecutableContract } from "../src/validator/projection"
import { createExecutableRelease, loadExecutableRelease } from "../src/validator/release"
import type { AuthoredUi, ExecutableContractSource } from "../src/validator/types"
import { validateAuthoredUi } from "../src/validator/validate"
import { createNeutralExecutableContractSource } from "./fixtures/executable-neutral-contract"

const context = {
  applicability: ["group-data-[state=open]/item"],
  target: { kind: "pseudo-element", name: "after" },
} as const

function contextualSource(): ExecutableContractSource {
  const source = structuredClone(createNeutralExecutableContractSource()) as unknown as ExecutableContractSource
  const dependency = source.componentContracts.families[0].exports[0].component!.tokenDependencies[0] as unknown as Record<string, unknown>
  dependency.sourceContext = structuredClone(context)
  return source
}

function authoredUi(): AuthoredUi {
  return {
    root: {
      kind: "component",
      id: "action",
      familyId: "action-button",
      exportName: "ActionButton",
      props: { tone: { kind: "literal", value: "quiet" } },
      children: [],
      location: { path: "action" },
    },
    tokenUses: [{ tokenId: "color.signal", location: { path: "action.color" } }],
  }
}

describe("token source context projection boundary", () => {
  test("preserves descriptive context through projection and deterministic release serialization", () => {
    const source = contextualSource()
    const projection = projectExecutableContract(source)
    const projectedDependency = projection.exports["action-button\u0000ActionButton"].component!.tokenDependencies[0]
    const first = createExecutableRelease(source)
    const second = createExecutableRelease(source)
    const loaded = loadExecutableRelease(first, { expectedProjection: projection })

    expect(projectedDependency.sourceContext).toEqual(context)
    expect(first.sha256).toBe(second.sha256)
    expect(loaded.projection.exports["action-button\u0000ActionButton"].component!.tokenDependencies[0].sourceContext).toEqual(context)
  })

  test("does not make descriptive source context validator-executable", () => {
    const baseline = projectExecutableContract(createNeutralExecutableContractSource())
    const contextual = projectExecutableContract(contextualSource())

    expect(validateAuthoredUi(authoredUi(), contextual)).toEqual(validateAuthoredUi(authoredUi(), baseline))
    expect(validateAuthoredUi(authoredUi(), contextual)).toEqual({ ok: true, errors: [] })
  })
})
