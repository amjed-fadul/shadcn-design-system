import { expect, test } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { Spinner } from "../src/components/ui/spinner"

test("Spinner renders a real SVG with its wrapper defaults and forwarded SVG props", () => {
  const defaultMarkup = renderToStaticMarkup(<Spinner viewBox="0 0 32 32" />)
  expect(defaultMarkup).toMatch(/^<svg\b/)
  expect(defaultMarkup).toContain('role="status"')
  expect(defaultMarkup).toContain('aria-label="Loading"')
  expect(defaultMarkup).toContain('viewBox="0 0 32 32"')

  const overriddenMarkup = renderToStaticMarkup(<Spinner role="img" aria-label="Saving" />)
  expect(overriddenMarkup).toContain('role="img"')
  expect(overriddenMarkup).toContain('aria-label="Saving"')
})
