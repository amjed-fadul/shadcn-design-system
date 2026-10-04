import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { contrastRatio, oklchToLinearSrgb } from "./helpers/oklch-contrast.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const storyFile = path.join(root, "src/components/ui/link.stories.tsx")
const storyImportPath = "./src/components/ui/link.stories.tsx"
const baseURL = (process.env.STORYBOOK_URL ?? "http://127.0.0.1:6008").replace(/\/$/, "")
const artifactDirectory = process.env.RELEASE008_BROWSER_OUTPUT ?? path.join(homedir(), ".artifacts/shadcn-design-system/release008-browser")
mkdirSync(artifactDirectory, { recursive: true })

const source = readFileSync(storyFile, "utf8")
const title = source.match(/title:\s*["']([^"']+)["']/)?.[1]
assert.ok(title, `Story title missing from ${storyFile}`)
const storyExports = [...source.matchAll(/^export const (\w+): Story\s*=/gm)].map(match => match[1])
assert.ok(storyExports.length > 0, `No stories found in ${storyFile}`)
const slug = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
const storyIds = new Map(storyExports.map(exportName => [exportName, `${slug(title)}--${slug(exportName)}`]))
for (const expected of ["Default", "Destinations", "NewTab", "Keyboard", "Multiline", "Light", "Dark", "Rtl"]) {
  assert.ok(storyIds.has(expected), `Required Link story ${expected} is missing`)
}

const indexResponse = await fetch(`${baseURL}/index.json`)
assert.equal(indexResponse.status, 200, `Storybook index request failed: ${indexResponse.status}`)
const index = await indexResponse.json()
for (const [exportName, id] of storyIds) {
  const entry = index.entries?.[id]
  assert.ok(entry, `Story ${exportName} was not found in Storybook index as ${id}`)
  assert.equal(entry.title, title)
  assert.equal(entry.importPath, storyImportPath)
  assert.equal(entry.exportName, exportName)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(12000)
const errors = []
const fontResponses = []
let currentStoryId = "index"
page.on("pageerror", error => errors.push({ storyId: currentStoryId, kind: "pageerror", message: error.message }))
page.on("console", message => {
  if (message.type() === "error") errors.push({ storyId: currentStoryId, kind: "console", message: message.text() })
})
page.on("response", response => {
  if (/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(response.url())) {
    fontResponses.push({ url: response.url(), status: response.status() })
  }
})

const screenshot = async name => {
  const file = path.join(artifactDirectory, `link-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
const openStory = async exportName => {
  currentStoryId = storyIds.get(exportName)
  const url = new URL(`${baseURL}/iframe.html`)
  url.searchParams.set("id", currentStoryId)
  url.searchParams.set("viewMode", "story")
  await page.goto(url.toString(), { waitUntil: "networkidle" })
  await page.locator("a").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}
const computedColor = async (locator, property) => locator.evaluate((element, colorProperty) => getComputedStyle(element).getPropertyValue(colorProperty), property)
const colorToLinear = value => {
  if (/^oklch\(/i.test(value.trim())) return oklchToLinearSrgb(value)
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  assert.ok(match, `Unsupported computed color: ${value}`)
  return match.slice(1, 4).map(channel => {
    const encoded = Number(channel) / 255
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4
  })
}
const colorMetrics = async locator => {
  const values = await locator.evaluate(element => {
    const style = getComputedStyle(element)
    const parentStyle = getComputedStyle(element.parentElement)
    const backgroundProbe = document.createElement("span")
    backgroundProbe.style.backgroundColor = "var(--background)"
    const foregroundProbe = document.createElement("span")
    foregroundProbe.style.color = "var(--primary)"
    document.body.append(backgroundProbe, foregroundProbe)
    const background = getComputedStyle(backgroundProbe).backgroundColor
    const primary = getComputedStyle(foregroundProbe).color
    backgroundProbe.remove()
    foregroundProbe.remove()
    return {
      color: style.color,
      background: background === "rgba(0, 0, 0, 0)" ? parentStyle.backgroundColor : background,
      bodyBackground: background,
      primary,
      display: style.display,
      textDecorationLine: style.textDecorationLine,
      transform: style.transform,
      rotate: style.rotate,
    }
  })
  return {
    ...values,
    contrast: contrastRatio(colorToLinear(values.color), colorToLinear(values.background)),
  }
}
const evidence = {
  run: "release008-link-browser",
  baseURL,
  browser: null,
  storyFile: path.relative(root, storyFile),
  storyIds: Object.fromEntries(storyIds),
  status: "running",
  checks: {},
  screenshots: {},
  consoleAndPageErrors: errors,
}

try {
  evidence.browser = browser.version()

  await openStory("Default")
  const defaultLink = page.getByRole("link", { name: "Documentation", exact: true })
  assert.equal(await defaultLink.count(), 1)
  assert.equal(await defaultLink.evaluate(element => element.tagName), "A", "Link must render as a native anchor")
  assert.equal(await defaultLink.getAttribute("href"), "/docs")
  assert.equal(await defaultLink.getAttribute("target"), null)
  assert.equal(await defaultLink.getAttribute("rel"), null)
  assert.equal(await defaultLink.getAttribute("aria-disabled"), null)
  assert.equal(await defaultLink.getAttribute("disabled"), null)
  assert.equal(await defaultLink.evaluate(element => element.tabIndex), 0)
  assert.equal(await defaultLink.locator("svg").count(), 0, "Link must not add a forced external-link icon")
  const defaultColor = await colorMetrics(defaultLink)
  assert.equal(defaultColor.color, defaultColor.primary)
  assert.ok(defaultColor.contrast >= 4.5, `Link color contrast on its background is ${defaultColor.contrast}:1`)
  const fontState = await page.evaluate(async () => {
    await document.fonts.load('16px "Geist Variable"')
    await document.fonts.ready
    return {
      check: document.fonts.check('16px "Geist Variable"'),
      faces: [...document.fonts].map(face => ({ family: face.family, status: face.status })),
      resources: performance.getEntriesByType("resource").map(entry => entry.name).filter(name => /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(name)),
    }
  })
  const geistFace = fontState.faces.find(face => face.family.replaceAll('"', "") === "Geist Variable" && face.status === "loaded")
  const fontResponse = fontResponses.find(item => item.status >= 200 && item.status < 300)
  assert.equal(fontState.check, true)
  assert.ok(geistFace)
  assert.ok(fontResponse && fontState.resources.length > 0, "A font resource must load successfully over the browser network")
  evidence.checks.default = { href: await defaultLink.getAttribute("href"), color: defaultColor, fonts: { face: geistFace, response: fontResponse } }
  evidence.screenshots.default = await screenshot("default")

  await openStory("Destinations")
  const destinations = await page.getByRole("link").evaluateAll(links => links.map(link => ({
    name: link.getAttribute("aria-label") || link.textContent?.trim(),
    href: link.getAttribute("href"),
    target: link.getAttribute("target"),
    rel: link.getAttribute("rel"),
    disabled: link.hasAttribute("disabled") || link.getAttribute("aria-disabled") !== null,
    iconCount: link.querySelectorAll("svg").length,
  })))
  assert.ok(destinations.length >= 5, "Destination story must include multiple native link destinations")
  assert.ok(destinations.some(link => link.href?.startsWith("/")), "An internal path href must be preserved")
  assert.ok(destinations.some(link => link.href?.startsWith("#")), "A local fragment href must be preserved")
  assert.ok(destinations.some(link => /^https?:\/\//.test(link.href ?? "")), "An external URL href must be preserved")
  assert.ok(destinations.some(link => link.href?.startsWith("mailto:")), "A mailto href must be preserved")
  assert.ok(destinations.some(link => link.href?.startsWith("tel:")), "A tel href must be preserved")
  assert.ok(destinations.every(link => !link.disabled && link.target === null && link.rel === null && link.iconCount === 0))
  evidence.checks.destinationHrefPreservation = destinations

  await openStory("NewTab")
  const newTabLink = page.getByRole("link", { name: /opens in a new tab/i })
  assert.equal(await newTabLink.count(), 1)
  assert.equal(await newTabLink.getAttribute("target"), "_blank")
  assert.match(await newTabLink.getAttribute("rel") ?? "", /(?:^|\s)noopener(?:\s|$)/)
  const newTab = await newTabLink.evaluate(element => ({
    name: element.textContent?.trim(),
    href: element.getAttribute("href"),
    target: element.getAttribute("target"),
    rel: element.getAttribute("rel"),
    iconCount: element.querySelectorAll("svg").length,
  }))
  assert.ok(newTab.name?.includes("opens in a new tab"), "New-tab behavior must be announced in link text")
  assert.equal(newTab.iconCount, 0, "New-tab behavior must not force an icon into the child content")
  evidence.checks.newTabSafety = newTab
  evidence.screenshots.newTab = await screenshot("new-tab")

  await openStory("Keyboard")
  const keyboardLink = page.getByRole("link", { name: "Read details", exact: true })
  await page.keyboard.press("Tab")
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement
    && document.activeElement.matches("a:focus-visible"))
  const focusState = await keyboardLink.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      focused: element.matches(":focus-visible"),
      boxShadow: style.boxShadow,
      ringOffsetWidth: style.getPropertyValue("--tw-ring-offset-width").trim(),
      ringOffsetColor: style.getPropertyValue("--tw-ring-offset-color").trim(),
      ringColor: style.getPropertyValue("--tw-ring-color").trim(),
      semanticRing: (() => {
        const probe = document.createElement("span")
        probe.style.color = "var(--ring)"
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })(),
      semanticBackground: (() => {
        const probe = document.createElement("span")
        probe.style.backgroundColor = "var(--background)"
        document.body.append(probe)
        const color = getComputedStyle(probe).backgroundColor
        probe.remove()
        return color
      })(),
      href: element.getAttribute("href"),
      isActiveElement: element === document.activeElement,
    }
  })
  assert.equal(focusState.focused, true)
  assert.equal(focusState.isActiveElement, true)
  assert.notEqual(focusState.boxShadow, "none", "Keyboard focus must render a visible ring")
  assert.equal(focusState.ringOffsetWidth, "2px")
  assert.equal(focusState.ringOffsetColor, focusState.semanticBackground)
  assert.equal(focusState.ringColor, focusState.semanticRing)
  assert.equal(focusState.href, "#link-details")
  evidence.checks.keyboardFocusRing = focusState
  evidence.screenshots.focus = await screenshot("focus")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => location.hash === "#link-details")
  assert.equal(new URL(page.url()).hash, "#link-details", "Enter must follow the native local hash href")
  assert.equal(await page.locator("#link-details").count(), 1)
  evidence.checks.nativeHashNavigation = { url: page.url(), targetFound: true }

  await openStory("Multiline")
  const multiline = page.getByRole("link").first()
  const wrapping = await multiline.evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const lines = [...range.getClientRects()].map(rect => ({ top: rect.top, left: rect.left, right: rect.right, width: rect.width }))
    return {
      text: element.textContent?.trim(),
      display: getComputedStyle(element).display,
      lineCount: lines.length,
      lines,
      transform: getComputedStyle(element).transform,
    }
  })
  assert.equal(wrapping.display, "inline", "Link should remain inline with surrounding text")
  assert.ok(wrapping.lineCount > 1, "Long inline link should wrap naturally across lines")
  assert.equal(wrapping.transform, "none")
  evidence.checks.inlineWrapping = wrapping
  evidence.screenshots.multiline = await screenshot("multiline")

  const themeEvidence = {}
  for (const exportName of ["Light", "Dark"]) {
    await openStory(exportName)
    const link = page.getByRole("link").first()
    const state = await page.evaluate(() => ({
      dark: Boolean(document.querySelector(".dark")),
      background: (() => {
        const probe = document.createElement("span")
        probe.style.backgroundColor = "var(--background)"
        document.body.append(probe)
        const color = getComputedStyle(probe).backgroundColor
        probe.remove()
        return color
      })(),
      primary: (() => {
        const probe = document.createElement("span")
        probe.style.color = "var(--primary)"
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })(),
    }))
    const color = await colorMetrics(link)
    assert.equal(state.dark, exportName === "Dark")
    assert.equal(color.color, state.primary)
    assert.ok(color.contrast >= 4.5, `${exportName} Link contrast should be at least 4.5:1`)
    themeEvidence[exportName.toLowerCase()] = { ...state, color }
    evidence.screenshots[exportName.toLowerCase()] = await screenshot(exportName.toLowerCase())
  }
  assert.notEqual(themeEvidence.light.background, themeEvidence.dark.background)
  evidence.checks.themes = themeEvidence

  await openStory("Rtl")
  const rtlLink = page.getByRole("link").first()
  const rtl = await rtlLink.evaluate(element => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      text: element.textContent?.trim(),
      href: element.getAttribute("href"),
      direction: style.direction,
      display: style.display,
      transform: style.transform,
      rotate: style.rotate,
      left: rect.left,
      right: rect.right,
    }
  })
  assert.equal(rtl.direction, "rtl")
  assert.equal(rtl.transform, "none")
  assert.equal(rtl.rotate, "none")
  assert.ok(rtl.href)
  evidence.checks.rtl = rtl
  evidence.screenshots.rtl = await screenshot("rtl")

  assert.deepEqual(errors, [], "Link stories must have no unexpected browser console or page errors")
  evidence.status = "passed"
} catch (error) {
  evidence.status = "failed"
  evidence.failure = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  evidence.consoleAndPageErrors = errors
  evidence.fontResponses = fontResponses
  writeFileSync(path.join(artifactDirectory, "link-browser-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify(evidence, null, 2))
