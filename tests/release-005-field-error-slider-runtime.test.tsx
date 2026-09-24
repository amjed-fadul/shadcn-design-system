import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"

import { FieldError } from "../src/components/ui/field"
import { Slider } from "../src/components/ui/slider"
// @ts-expect-error jsdom is present as a test dependency without bundled declarations.
import { JSDOM } from "jsdom"

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

function sliderThumbs(markup: string) {
  return [...new JSDOM(markup).window.document.querySelectorAll<HTMLElement>('[role="slider"]')]
}

test.each([
  { values: [25], labels: ["Volume"] },
  { values: [20, 80], labels: ["Minimum price", "Maximum price"] },
  { values: [10, 50, 90], labels: ["Low", "Middle", "High"] },
])("Slider applies each aria label to its generated thumb by index", ({ values, labels }) => {
  const thumbs = sliderThumbs(renderToStaticMarkup(<Slider value={values} thumbAriaLabels={labels} />))

  expect(thumbs).toHaveLength(values.length)
  expect(thumbs.map((thumb) => thumb.getAttribute("aria-label"))).toEqual(labels)
})

test.each([
  { values: [25], ids: ["volume-label"] },
  { values: [20, 80], ids: ["minimum-label", "maximum-label"] },
  { values: [10, 50, 90], ids: ["low-label", "middle-label", "high-label"] },
])("Slider applies each aria labelledby reference to its generated thumb by index", ({ values, ids }) => {
  const thumbs = sliderThumbs(renderToStaticMarkup(<Slider value={values} thumbAriaLabelledBy={ids} />))

  expect(thumbs).toHaveLength(values.length)
  expect(thumbs.map((thumb) => thumb.getAttribute("aria-labelledby"))).toEqual(ids)
})

test("Slider preserves per-thumb names when disabled, RTL, and vertical", () => {
  const thumbs = sliderThumbs(renderToStaticMarkup(
    <Slider value={[20, 80]} thumbAriaLabels={["Lower bound", "Upper bound"]} disabled dir="rtl" orientation="vertical" />
  ))

  expect(thumbs.map((thumb) => thumb.getAttribute("aria-label"))).toEqual(["Lower bound", "Upper bound"])
  expect(thumbs.every((thumb) => thumb.hasAttribute("data-disabled"))).toBe(true)
})

test("Slider keeps Radix fallback naming when thumb names are omitted", () => {
  const one = sliderThumbs(renderToStaticMarkup(<Slider value={[25]} aria-label="Root label" />))
  const two = sliderThumbs(renderToStaticMarkup(<Slider value={[20, 80]} />))

  expect(one[0].getAttribute("aria-label")).toBeNull()
  expect(two.map((thumb) => thumb.getAttribute("aria-label"))).toEqual([null, null])
})

test("Slider accepts empty thumb names only when it renders zero thumbs", () => {
  const thumbs = sliderThumbs(renderToStaticMarkup(<Slider value={[]} thumbAriaLabels={[]} />))

  expect(thumbs).toHaveLength(0)
})

test.each([
  { value: [20, 80], names: ["Only one"] },
  { value: [20], names: ["First", "Extra"] },
  { value: [20], names: ["   "] },
])("Slider rejects invalid thumb label arrays", ({ value, names }) => {
  expect(() => renderToStaticMarkup(<Slider value={value} thumbAriaLabels={names} />)).toThrow(/thumbAriaLabels/)
})

test.each([
  { value: [20, 80], ids: ["only-one"] },
  { value: [20], ids: ["first", "extra"] },
  { value: [20], ids: ["  "] },
])("Slider rejects invalid thumb label reference arrays", ({ value, ids }) => {
  expect(() => renderToStaticMarkup(<Slider value={value} thumbAriaLabelledBy={ids} />)).toThrow(/thumbAriaLabelledBy/)
})

test("Slider rejects two naming mechanisms supplied together", () => {
  expect(() => renderToStaticMarkup(
    <Slider value={[20]} thumbAriaLabels={["Value"]} thumbAriaLabelledBy={["value-label"]} />
  )).toThrow(/only one/)
})
