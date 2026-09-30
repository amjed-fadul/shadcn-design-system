import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import references from "../contracts/knowledge/references.json"
import { lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const form = () => lookupComponentExport("field", "Form").component!
const facts = () => form().accessibility
const fact = (feature: string) => facts().find((item) => item.feature === feature)!
const factText = () => facts().map((item) => `${item.feature}: ${item.mechanism}`).join("\n")
const claims = (id: string) => {
  const knowledge = getComponentKnowledge(id)
  return [...(knowledge.whenToUse ?? []), ...(knowledge.howToUse ?? []), ...(knowledge.options ?? []), ...(knowledge.writing ?? [])]
}
const claimText = (id: string) => claims(id).map((claim) => claim.statement).join("\n")
const formClaims = () => claims("field").filter((claim) => /\bForm\b/.test(claim.statement))
const formInterface = JSON.parse(readFileSync("contracts/components/interfaces/html.form.json", "utf8")) as {
  id: string
  source: { symbol: string }
  props: Array<{ name: string }>
}

describe("Form contract", () => {
  test("Form is a governed authorable export of the field family", () => {
    const entry = lookupComponentExport("field", "Form")

    expect(entry.kind).toBe("component")
    expect(entry.authorableJsx).toBe(true)
    expect(form().inherits).toEqual(["html.form"])
  })

  test("renders a native form host with the form data slot and no local props", () => {
    const rendering = form().rendering as unknown as { nodes: Array<{ host: unknown; dataAttributes: unknown[] }> }
    const node = rendering.nodes[0]

    expect(node.host).toEqual({ kind: "inherited-interface", interfaceId: "html.form" })
    expect(node.dataAttributes).toEqual([expect.objectContaining({ name: "data-slot", value: "form" })])
    expect(form().localProps).toEqual([])
    expect(form().inheritedPropDefaults).toEqual([])
  })

  test("the inherited html.form interface is the React intrinsic form and exposes the native form props", () => {
    const names = formInterface.props.map((prop) => prop.name)

    expect(formInterface.id).toBe("html.form")
    expect(formInterface.source.symbol).toBe('React.JSX.IntrinsicElements["form"]')
    for (const name of ["onSubmit", "action", "method", "noValidate", "autoComplete", "encType", "target", "name"]) {
      expect(names).toContain(name)
    }
  })

  test("does not invent duplicate custom props for native form attributes", () => {
    expect(form().localProps.map((prop) => prop.name)).toEqual([])
    expect(fact("forwarded form props").mechanism).toMatch(/not duplicated as Form props/)
  })

  test("documents that Form renders a native <form> and must not get role=form", () => {
    const native = fact("native form semantics")

    expect(native.owner).toBe("native")
    expect(native.mechanism).toContain("native <form>")
    expect(native.mechanism).toMatch(/adds no role/)
    expect(native.mechanism).toContain('do not add role="form"')
    expect(native.mechanism).toMatch(/aria-label or aria-labelledby/)
  })

  test("documents submit behavior with Button type=submit and the caller-owned onSubmit", () => {
    const submit = fact("submit behavior")

    expect(submit.owner).toBe("native")
    expect(submit.mechanism).toContain('type="submit"')
    expect(submit.mechanism).toContain("onSubmit")
    expect(submit.mechanism).toContain("event.preventDefault()")
    expect(submit.mechanism).toMatch(/Form adds no submit handler of its own/)
    expect(submit.mechanism).toMatch(/non-submit Button type="button"/)
    expect(submit.mechanism).toMatch(/InputGroupButton already defaults to type="button"/)
  })

  test("describes Enter as native implicit submission without overclaiming edge cases", () => {
    const enter = fact("Enter key behavior")

    expect(enter.owner).toBe("native")
    expect(enter.mechanism).toMatch(/browser's implicit submission/)
    expect(enter.mechanism).toMatch(/Form adds no key handling/)
    expect(enter.mechanism).toMatch(/decided by the browser, not by Form/)
    expect(enter.mechanism).not.toMatch(/always|guarantee/i)
  })

  test("documents native validation, noValidate, and caller-owned application validation", () => {
    const validation = fact("native validation")

    expect(validation.owner).toBe("native")
    for (const token of ["required", 'type="email"', "pattern", "noValidate"]) expect(validation.mechanism).toContain(token)
    expect(validation.mechanism).toMatch(/submit event does not fire/)
    expect(validation.mechanism).toMatch(/Application-specific validation[^.]*caller-owned/)
  })

  test("documents Field, Select and InputGroup relationships", () => {
    const controls = fact("form controls and Field").mechanism

    expect(controls).toContain("aria-describedby")
    expect(controls).toContain("aria-invalid")
    expect(controls).toMatch(/Select contributes to the form data only when name is set on Select/)
  })

  test("says async work, validation state, error focus, requests and announcements stay with the caller", () => {
    const owner = fact("result and async ownership")

    expect(owner.owner).toBe("author")
    for (const denied of ["validation state", "focus invalid fields", "server requests", "async work", "announce results"]) {
      expect(owner.mechanism).toContain(denied)
    }
    expect(owner.mechanism).toMatch(/Form does not/)
    expect(owner.mechanism).toContain("<Status>")
    expect(owner.mechanism).toMatch(/never nested in another live region/)
  })

  test("never claims that Form manages async work, requests, validation state, focus or announcements", () => {
    const text = `${factText()}\n${formClaims().map((claim) => claim.statement).join("\n")}`

    expect(text).not.toMatch(/Form (?:manages(?! none)|handles|performs|runs|automatically)\b/i)
    expect(text).not.toMatch(/automatically (?:focus|announce)/i)
    expect(text).not.toMatch(/role="form"[^.]*(?:add|set) /i)
  })
})

describe("Form discoverability in knowledge", () => {
  test("Field knowledge tells agents when to use Form and why not a Button onClick", () => {
    const text = claimText("field")

    expect(text).toContain("Use Form when a set of controls submits together")
    expect(text).toContain("native <form>")
    expect(text).toMatch(/instead of building submission from a Button onClick/)
  })

  test("Field knowledge covers submit props, Enter, validation, noValidate and Status", () => {
    const text = formClaims().map((claim) => claim.statement).join("\n")

    expect(text).toContain("<Form onSubmit={...}>")
    for (const prop of ["onSubmit", "action", "method", "noValidate", "autoComplete"]) expect(text).toContain(prop)
    expect(text).toMatch(/native implicit submission/)
    expect(text).toMatch(/InputGroupButton[^.]*type="button"/)
    expect(text).toMatch(/Native constraint validation/)
    expect(text).toMatch(/Form manages none of them/)
    expect(text).toContain("<Status>")
  })

  test("Button knowledge explains type=submit and type=button inside a Form", () => {
    const text = claimText("button")

    expect(text).toContain('<Button type="submit">')
    expect(text).toMatch(/no type inside a form submits it/)
    expect(text).toContain('type="button"')
  })

  test("every Form claim cites known references", () => {
    const known = new Set(references.references.map((reference) => reference.id))
    const all = [...formClaims(), ...claims("button").filter((claim) => claim.statement.includes("Form"))]

    expect(all.length).toBeGreaterThanOrEqual(5)
    for (const claim of all) {
      const ids = "referenceIds" in claim.basis ? claim.basis.referenceIds : []
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) expect(known.has(id)).toBe(true)
    }
  })

  test("the new HTML standard references are official standards pinned to spec locations", () => {
    const byId = new Map(references.references.map((reference) => [reference.id, reference]))

    for (const id of ["whatwg.html.form-element", "whatwg.html.implicit-submission", "whatwg.html.constraint-validation"]) {
      expect(byId.get(id)).toMatchObject({ kind: "official-standard" })
      expect(byId.get(id)!.locator).toMatch(/^https:\/\/html\.spec\.whatwg\.org\/multipage\//)
    }
  })
})
