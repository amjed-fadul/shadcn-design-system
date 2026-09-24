import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"

import { FieldError } from "../src/components/ui/field"
import { Slider } from "../src/components/ui/slider"

test("FieldError omits output when it has no usable content", () => {
  expect(renderToStaticMarkup(<FieldError />)).toBe("")
  expect(renderToStaticMarkup(<FieldError errors={[{ message: "" }]} />)).toBe("")
  expect(renderToStaticMarkup(<FieldError errors={[{ message: undefined }]} />)).toBe("")
})

test("FieldError renders authored children before supplied errors", () => {
  const markup = renderToStaticMarkup(
    <FieldError errors={[{ message: "Ignored error" }]}>Authored content</FieldError>
  )

  expect(markup).toContain('role="alert"')
  expect(markup).toContain("Authored content")
  expect(markup).not.toContain("Ignored error")
})

test("FieldError renders one unique message as direct content", () => {
  const markup = renderToStaticMarkup(<FieldError errors={[{ message: "Required" }]} />)

  expect(markup).toContain('role="alert"')
  expect(markup).toContain('data-slot="field-error"')
  expect(markup).toContain(">Required</div>")
  expect(markup).not.toContain("<ul")
})

test("FieldError deduplicates duplicate messages", () => {
  const markup = renderToStaticMarkup(
    <FieldError errors={[{ message: "Required" }, { message: "Required" }]} />
  )

  expect(markup).toContain(">Required</div>")
  expect(markup).not.toContain("<ul")
})

test("FieldError renders multiple unique messages as list items", () => {
  const markup = renderToStaticMarkup(
    <FieldError errors={[{ message: "Required" }, { message: "Too short" }]} />
  )

  expect(markup.match(/<li>/g)).toHaveLength(2)
  expect(markup).toContain("Required")
  expect(markup).toContain("Too short")
})

test("FieldError counts unique falsy messages before choosing list output, then filters falsy items", () => {
  const markup = renderToStaticMarkup(
    <FieldError errors={[{ message: "" }, { message: "Required" }]} />
  )

  expect(markup).toContain("<ul")
  expect(markup.match(/<li>/g)).toHaveLength(1)
  expect(markup).toContain("Required")
  expect(markup).not.toContain("><li></li>")
})

test("FieldError can render an empty alert list when distinct deduplicated keys are both falsy", () => {
  const markup = renderToStaticMarkup(
    <FieldError errors={[undefined, { message: "" }]} />
  )

  expect(markup).toContain('role="alert"')
  expect(markup).toContain("<ul")
  expect(markup).not.toContain("<li")
})

test("Slider renders no thumbs for an explicitly empty value array", () => {
  const markup = renderToStaticMarkup(<Slider value={[]} aria-label="Volume" />)

  expect(markup.match(/data-slot="slider-thumb"/g) ?? []).toHaveLength(0)
})

test("Slider renders one thumb for a single value", () => {
  const markup = renderToStaticMarkup(<Slider value={[25]} aria-label="Volume" />)

  expect(markup.match(/data-slot="slider-thumb"/g)).toHaveLength(1)
})

test("Slider renders one thumb per value for multiple values", () => {
  const markup = renderToStaticMarkup(<Slider value={[25, 75]} aria-label="Volume" />)

  expect(markup.match(/data-slot="slider-thumb"/g)).toHaveLength(2)
})

test("Slider uses defaultValue collection cardinality when value is not an array", () => {
  const markup = renderToStaticMarkup(
    <Slider defaultValue={[20, 40, 60]} aria-label="Volume" />
  )

  expect(markup.match(/data-slot="slider-thumb"/g)).toHaveLength(3)
})

test("Slider falls back to one thumb for min when neither value prop is an array", () => {
  const markup = renderToStaticMarkup(<Slider min={12} aria-label="Volume" />)

  expect(markup.match(/data-slot="slider-thumb"/g)).toHaveLength(1)
  expect(markup).toContain('aria-valuemin="12"')
})
