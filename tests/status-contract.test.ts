import { describe, expect, test } from "vitest"

import references from "../contracts/knowledge/references.json"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract } from "../src/validator/projection"
import { validateAuthoredUi } from "../src/validator/validate"

const executable = projectExecutableContract({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
})

const status = () => lookupComponentExport("alert", "Status").component!
const facts = () => status().accessibility
const fact = (feature: string) => facts().find((item) => item.feature === feature)!
const factText = () => facts().map((item) => `${item.feature}: ${item.mechanism}`).join("\n")
const claims = (id: string) => {
  const knowledge = getComponentKnowledge(id)
  return [...(knowledge.whenToUse ?? []), ...(knowledge.howToUse ?? []), ...(knowledge.options ?? []), ...(knowledge.writing ?? [])]
}
const claimText = (id: string) => claims(id).map((claim) => claim.statement).join("\n")

describe("Status contract", () => {
  test("Status is a governed authorable export of the alert family", () => {
    const entry = lookupComponentExport("alert", "Status")

    expect(entry.kind).toBe("component")
    expect(entry.authorableJsx).toBe(true)
    expect(status().inherits).toContain("html.div")
  })

  test("declares variant (default | error) and visuallyHidden (boolean, false)", () => {
    const props = status().localProps

    expect(props.find((prop) => prop.name === "variant")).toMatchObject({
      required: false,
      type: { kind: "enum", values: ["default", "error"] },
      default: "default",
    })
    expect(props.find((prop) => prop.name === "visuallyHidden")).toMatchObject({
      required: false,
      type: { kind: "boolean" },
      default: false,
    })
  })

  test("does not expose role or aria-live as authorable overrides", () => {
    const text = factText()

    expect(status().localProps.map((prop) => prop.name)).not.toContain("role")
    expect(status().inheritedPropOmissions).toEqual([
      { propName: "aria-live", evidenceRefs: ["source"] },
      { propName: "role", evidenceRefs: ["source"] },
    ])
    expect(text).toMatch(/role and aria-live are owned by Status and cannot be overridden/)
  })

  test.each(["role", "aria-live"])("removes inherited %s from the executable API", (propName) => {
    const projected = executable.exports["alert\u0000Status"].component!
    const validation = validateAuthoredUi({
      root: {
        kind: "component",
        id: "status",
        familyId: "alert",
        exportName: "Status",
        props: { [propName]: { kind: "literal", value: propName === "role" ? "alert" : "off" } },
        children: [],
        location: { path: "status" },
      },
    }, executable)

    expect(projected.props.map((prop) => prop.name)).not.toContain(propName)
    expect(validation.errors).toEqual([
      expect.objectContaining({ code: "INVALID_PROP", target: expect.objectContaining({ propName }) }),
    ])
  })

  test("documents polite status semantics for routine progress and success", () => {
    const polite = fact("polite status semantics")

    expect(polite.owner).toBe("component")
    expect(polite.mechanism).toContain('role="status"')
    expect(polite.mechanism).toContain('aria-live="polite"')
    expect(polite.mechanism).toMatch(/Saving…|Saved|Loading results…/)
  })

  test("documents assertive alert semantics for important errors only", () => {
    const urgent = fact("error alert semantics")

    expect(urgent.mechanism).toContain('role="alert"')
    expect(urgent.mechanism).toContain('aria-live="assertive"')
    expect(urgent.mechanism).toMatch(/not for routine loading or success/)
  })

  test("documents visually-hidden mode as sr-only on the live region, still in the accessibility tree", () => {
    const hidden = fact("visually hidden mode")

    expect(hidden.mechanism).toContain("sr-only")
    expect(hidden.mechanism).toMatch(/accessibility tree/)
    expect(hidden.mechanism).toMatch(/not display: none, hidden, or aria-hidden/)
  })

  test("tells authors to keep Status mounted and change its text", () => {
    const mounted = fact("dynamic updates")

    expect(mounted.owner).toBe("author")
    expect(mounted.mechanism).toMatch(/keep Status mounted/)
    expect(mounted.mechanism).toMatch(/may not be announced by every assistive technology/)
  })

  test("does not promise a re-announcement for identical text", () => {
    const text = fact("dynamic updates").mechanism

    expect(text).toMatch(/identical text/)
    expect(text).toMatch(/does not guarantee/)
    expect(text).not.toMatch(/always announce/i)
  })

  test("states the caller controls the message and Status manages no async work", () => {
    const owner = fact("message ownership")

    expect(owner.owner).toBe("author")
    expect(owner.mechanism).toMatch(/caller controls the message/)
    expect(owner.mechanism).toMatch(/does not start, track, or finish async work/)
  })

  test("forbids nested live regions and names the Spinner exception", () => {
    const nested = fact("nested live regions")

    expect(nested.owner).toBe("author")
    expect(nested.mechanism).toMatch(/do not nest/)
    expect(nested.mechanism).toContain("Alert")
    expect(nested.mechanism).toContain("FieldError")
    expect(nested.mechanism).toContain("Spinner")
    expect(nested.mechanism).toContain('aria-hidden="true"')
  })

  test("declares no inherited prop defaults, because role and aria-live are derived from variant", () => {
    expect(status().inheritedPropDefaults).toEqual([])
  })
})

describe("Status discoverability in knowledge", () => {
  test("Alert knowledge tells agents when to use polite Status", () => {
    const text = claimText("alert")

    expect(text).toContain("<Status>")
    expect(text).toMatch(/Saving…|Logging in…/)
    expect(text).toMatch(/polite/)
  })

  test("Alert knowledge tells agents when to use error semantics", () => {
    const text = claimText("alert")

    expect(text).toContain('<Status variant="error">')
    expect(text).toMatch(/assertive/)
    expect(text).toMatch(/not for routine/)
  })

  test("Alert knowledge covers visually-hidden usage, caller-owned messages and no async management", () => {
    const text = claimText("alert")

    expect(text).toContain("visuallyHidden")
    expect(text).toMatch(/caller/i)
    expect(text).toMatch(/does not manage async/)
  })

  test("Alert knowledge separates Status from Alert, FieldError, Spinner and Button loading", () => {
    const text = claimText("alert")

    expect(text).toMatch(/Alert[^.]*visible/)
    expect(text).toContain("FieldError")
    expect(text).toContain("Spinner")
    expect(text).toContain("Button loading")
  })

  test("Button, Spinner and Field knowledge point to Status for announcing results", () => {
    expect(claimText("button")).toContain("Status")
    expect(claimText("spinner")).toContain("Status")
    expect(claimText("field")).toContain("Status")
  })

  test("every Status claim is source-derived or standard-derived and cites known references", () => {
    const known = new Set(references.references.map((reference) => reference.id))
    const statusClaims = claims("alert").filter((claim) => claim.statement.includes("Status"))

    expect(statusClaims.length).toBeGreaterThan(0)
    for (const claim of statusClaims) {
      const ids = "referenceIds" in claim.basis ? claim.basis.referenceIds : []
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) expect(known.has(id)).toBe(true)
    }
  })

  test("Button loading contract points authors to Status for reporting the result", () => {
    const wording = lookupComponentExport("button", "Button").component!.accessibility.find((item) => item.feature === "loading label wording")!

    expect(wording.mechanism).toContain("Status")
    expect(wording.mechanism).toMatch(/does not announce completion or failure/)
  })

  test("warns that changing variant on a mounted Status flips role and aria-live without a guaranteed announcement", () => {
    const text = fact("dynamic updates").mechanism

    expect(text).toMatch(/changing variant on a mounted Status changes its role and aria-live/i)
    expect(text).toMatch(/announcement of that role change is not guaranteed/)
    expect(text).toMatch(/sibling <Status variant="error">/)
  })

  test("says an empty visible Status still occupies layout", () => {
    expect(fact("dynamic updates").mechanism).toMatch(/empty visible Status still occupies layout/)
  })

  test("keeps error out of per-keystroke validation and routine validation summaries", () => {
    expect(fact("error alert semantics").mechanism).toMatch(/per-keystroke validation/)
    expect(claimText("alert")).toMatch(/non-urgent validation summaries[^.]*default polite/i)
  })

  test("names the passthrough props that can still break the governed behaviour", () => {
    const text = fact("role ownership").mechanism

    expect(text).toMatch(/do not set hidden or aria-hidden/)
    expect(text).toMatch(/aria-atomic/)
  })
})
