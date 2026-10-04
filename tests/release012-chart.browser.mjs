// Release 012 chart determinism: each chart type, lazily loaded and animated, is captured as
// soon as it reports ready. Two fresh renders must give identical pixels in light and dark,
// and reduced motion must skip the drawing state.
import assert from "node:assert/strict"
import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
const out = process.env.RELEASE012_BROWSER_OUTPUT ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/release012-browser"
const kinds = ["bar", "bar-stacked", "bar-horizontal", "area", "area-stacked", "line", "donut", "radial"]
mkdirSync(out, { recursive: true })

const server = await createServer({ root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, realpathSync(new URL("../node_modules", import.meta.url))] } }, logLevel: "error" })
await server.listen()
const { port } = server.httpServer.address()
const browser = await chromium.launch({ headless: true })
const errors = []

// Loads the fixture in a fresh page, records every data-chart-state it passes through until
// ready, then screenshots the frame at once.
async function capture(kind, theme, reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 2, reducedMotion: reducedMotion ? "reduce" : "no-preference" })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on("pageerror", (error) => errors.push(`${kind}/${theme}: ${error.message}`))
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${kind}/${theme}: ${message.text()}`) })
  await page.addInitScript(() => {
    window.__chartStates = []
    new MutationObserver(() => {
      const state = document.querySelector('[data-slot="chart-plot"]')?.getAttribute("data-chart-state")
      if (state && window.__chartStates[window.__chartStates.length - 1] !== state) window.__chartStates.push(state)
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-chart-state"] })
  })
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/chart-determinism.html?kind=${kind}&theme=${theme}`)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[data-chart-state="ready"]').waitFor()
  const image = await page.locator("#frame").screenshot()
  const states = await page.evaluate(() => window.__chartStates)
  await context.close()
  return { image, states }
}

const report = []
try {
  for (const theme of ["light", "dark"]) {
    for (const kind of kinds) {
      const first = await capture(kind, theme)
      const second = await capture(kind, theme)
      assert.deepEqual(first.states, ["measuring", "drawing", "ready"], `${kind}/${theme} states`)
      assert.ok(first.image.equals(second.image), `${kind}/${theme}: two renders captured at ready differ`)
      writeFileSync(path.join(out, `${kind}-${theme}.png`), first.image)
      report.push({ kind, theme, states: first.states.join(" > "), bytes: first.image.length, identical: true })
    }
  }
  const reduced = await capture("bar", "light", true)
  assert.deepEqual(reduced.states, ["measuring", "ready"], "reduced motion skips drawing")
  report.push({ kind: "bar", theme: "light", reducedMotion: true, states: reduced.states.join(" > ") })
  assert.deepEqual(errors, [])
  writeFileSync(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`release012 chart determinism: ${report.length} checks passed; screenshots in ${out}`)
} finally {
  await browser.close()
  await server.close()
}
