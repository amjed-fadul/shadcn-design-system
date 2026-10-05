// Release 013 chart determinism: every chart variant, lazily loaded and animated, is captured as soon as
// it reports ready. Two fresh renders must give identical pixels in light and dark; a chart without a
// locale must render the same pixels whatever the browser's language; reduced motion skips drawing.
// Ready must mean drawn on a slow CPU too: with the CPU throttled, nothing in the plot changes after
// the chart reports ready, on first draw and after an update.
import assert from "node:assert/strict"
import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
const out = process.env.RELEASE013_BROWSER_OUTPUT ?? path.join(homedir(), ".artifacts/shadcn-design-system/release013-browser")
// Each frame has 24px padding and a 1px border, so a width of 230 gives the 180px plot Canvas reported.
const variants = [
  ["bar"], ["bar-stacked"], ["bar-horizontal"], ["area"], ["area-stacked"], ["line"], ["donut"], ["radial"],
  ["radial-total"], ["donut-currency", 230], ["bar-lg"], ["line-raised"], ["sparkline", 240], ["bar-de"],
]
mkdirSync(out, { recursive: true })

const server = await createServer({ root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, realpathSync(new URL("../node_modules", import.meta.url))] } }, logLevel: "error" })
await server.listen()
const { port } = server.httpServer.address()
const browser = await chromium.launch({ headless: true })
const errors = []

// Loads the fixture in a fresh page, records every data-chart-state it passes through until ready,
// then screenshots the frame at once.
async function capture({ kind, width = 480, theme = "light", reducedMotion = false, locale = "en-US" }) {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 2, reducedMotion: reducedMotion ? "reduce" : "no-preference", locale })
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
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/chart-determinism.html?kind=${kind}&theme=${theme}&width=${width}`)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[data-chart-state="ready"]').waitFor()
  const image = await page.locator("#frame").screenshot()
  const states = await page.evaluate(() => window.__chartStates)
  await context.close()
  return { image, states }
}

// Loads the fixture with the CPU slowed by `rate` and records, every animation frame, the chart state
// and the whole plot surface. Each time the chart reports ready, the surface must already be final:
// it may not change again until the chart starts a new drawing.
async function settleTimeline({ kind, update, rate, width = 480 }) {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 } })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on("pageerror", (error) => errors.push(`${kind}/${update ?? "mount"}@${rate}x: ${error.message}`))
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate })
  await page.addInitScript(() => {
    window.__frames = []
    const sample = () => {
      const plot = document.querySelector('[data-slot="chart-plot"]')
      window.__frames.push({ state: plot?.getAttribute("data-chart-state") ?? null, surface: plot?.querySelector("svg.recharts-surface")?.innerHTML ?? "" })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/chart-determinism.html?kind=${kind}&width=${width}${update ? `&update=${update}` : ""}`)
  await page.waitForFunction((drawings) => {
    const states = window.__frames.map((frame) => frame.state).filter((state, index, all) => state !== all[index - 1])
    return states.filter((state) => state === "ready").length >= drawings
  }, update ? 2 : 1)
  await page.waitForTimeout(1000)
  const frames = await page.evaluate(() => window.__frames)
  await context.close()
  const states = frames.map((frame) => frame.state).filter((state, index, all) => state !== all[index - 1])
  const moved = []
  frames.forEach((frame, index) => {
    if (frame.state !== "ready" || frames[index - 1]?.state === "ready") return
    for (let later = index + 1; later < frames.length && frames[later].state === "ready"; later += 1) {
      if (frames[later].surface !== frame.surface) { moved.push(later - index); break }
    }
  })
  return { states, moved }
}

const report = []
try {
  for (const theme of ["light", "dark"]) {
    for (const [kind, width] of variants) {
      const first = await capture({ kind, width, theme })
      const second = await capture({ kind, width, theme })
      assert.deepEqual(first.states, ["measuring", "drawing", "ready"], `${kind}/${theme} states`)
      assert.ok(first.image.equals(second.image), `${kind}/${theme}: two renders captured at ready differ`)
      writeFileSync(path.join(out, `${kind}-${theme}.png`), first.image)
      report.push({ kind, theme, states: first.states.join(" > "), bytes: first.image.length, identical: true })
    }
  }
  // Without a locale prop the chart formats as en-US, so the browser's language changes nothing.
  for (const kind of ["bar", "donut-currency"]) {
    const english = await capture({ kind, width: kind === "donut-currency" ? 230 : 480, locale: "en-US" })
    for (const locale of ["de-DE", "ar-EG", "ja-JP"]) {
      const other = await capture({ kind, width: kind === "donut-currency" ? 230 : 480, locale })
      assert.ok(english.image.equals(other.image), `${kind}: a ${locale} browser renders different pixels from en-US`)
      report.push({ kind, browserLocale: locale, identicalToEnUS: true })
    }
  }
  // Ready means drawn on a slow CPU: on first draw for every variant, and after updates that move
  // the marks (new values) or only relabel them (a new locale on a line).
  for (const rate of [1, 6]) {
    for (const [kind, width] of variants) {
      const { states, moved } = await settleTimeline({ kind, width, rate })
      assert.deepEqual(states.filter(Boolean), ["measuring", "drawing", "ready"], `${kind}@${rate}x states`)
      assert.deepEqual(moved, [], `${kind}@${rate}x: the plot changed ${moved.join(", ")} frames after ready`)
      report.push({ kind, cpuSlowdown: rate, drawnAtReady: true })
    }
    for (const [kind, update] of [["bar", "data"], ["area", "data"], ["line", "data"], ["line", "locale"], ["donut", "data"], ["radial", "data"]]) {
      const { states, moved } = await settleTimeline({ kind, update, rate })
      assert.deepEqual(states.filter(Boolean), ["measuring", "drawing", "ready", "drawing", "ready"], `${kind} ${update} update@${rate}x states`)
      assert.deepEqual(moved, [], `${kind} ${update} update@${rate}x: the plot changed ${moved.join(", ")} frames after ready`)
      report.push({ kind, update, cpuSlowdown: rate, drawnAtReady: true })
    }
  }
  const reduced = await capture({ kind: "bar", reducedMotion: true })
  assert.deepEqual(reduced.states, ["measuring", "ready"], "reduced motion skips drawing")
  report.push({ kind: "bar", theme: "light", reducedMotion: true, states: reduced.states.join(" > ") })
  assert.deepEqual(errors, [])
  writeFileSync(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`release013 chart determinism: ${report.length} checks passed; screenshots in ${out}`)
} finally {
  await browser.close()
  await server.close()
}
