import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { contrastRatio, oklchToLinearSrgb } from "./helpers/oklch-contrast.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const storyFile = path.join(root, "src/components/ui/toggle-group.stories.tsx")
const storyImportPath = "./src/components/ui/toggle-group.stories.tsx"
const standaloneStoryFile = path.join(root, "src/components/ui/toggle.stories.tsx")
const baseURL = (process.env.STORYBOOK_URL ?? "http://127.0.0.1:6008").replace(/\/$/, "")
const artifactDirectory = process.env.RELEASE008_BROWSER_OUTPUT ?? path.join(homedir(), ".artifacts/shadcn-design-system/release008-browser")
mkdirSync(artifactDirectory, { recursive: true })

const storySource = readFileSync(storyFile, "utf8")
const title = storySource.match(/title:\s*["']([^"']+)["']/)?.[1]
assert.ok(title, `Story title missing from ${storyFile}`)
const storyExports = [...storySource.matchAll(/^export const (\w+): Story\s*=/gm)].map(match => match[1])
assert.ok(storyExports.length > 0, `No stories found in ${storyFile}`)
const slug = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
const storyIds = new Map(storyExports.map(exportName => [exportName, `${slug(title)}--${slug(exportName)}`]))
for (const expected of ["SingleLight", "SingleDark", "MultipleLight", "MultipleDark", "Disabled", "Rtl"]) {
  assert.ok(storyIds.has(expected), `Required Toggle Group story ${expected} is missing`)
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
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
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
  const file = path.join(artifactDirectory, `toggle-group-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
const openStory = async exportName => {
  currentStoryId = storyIds.get(exportName)
  const url = new URL(`${baseURL}/iframe.html`)
  url.searchParams.set("id", currentStoryId)
  url.searchParams.set("viewMode", "story")
  await page.goto(url.toString(), { waitUntil: "networkidle" })
  await page.locator("[data-slot='toggle-group']").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}
const items = page.locator("[data-slot='toggle-group-item']")
const paint = locator => locator.evaluate(element => {
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return {
    state: element.getAttribute("data-state"),
    ariaChecked: element.getAttribute("aria-checked"),
    ariaPressed: element.getAttribute("aria-pressed"),
    background: style.backgroundColor,
    color: style.color,
    width: rect.width,
    height: rect.height,
  }
})
const cssColorToLinear = value => {
  if (/^oklch\(/i.test(value.trim())) return oklchToLinearSrgb(value)
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/][\s]*([\d.]+))?\s*\)$/i)
  assert.ok(match, `Expected a computed RGB color, received ${value}`)
  const channels = match.slice(1, 4).map(channel => Number(channel) / 255)
  return channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
}
const contrastOf = paintValue => contrastRatio(cssColorToLinear(paintValue.background), cssColorToLinear(paintValue.color))
const backgroundContrast = (first, second) => contrastRatio(cssColorToLinear(first.background), cssColorToLinear(second.background))
const waitForHoverPaint = async locator => page.waitForFunction(element => {
  if (!(element instanceof HTMLElement) || !element.matches(":hover")) return false
  const probe = document.createElement("span")
  probe.style.backgroundColor = "var(--muted)"
  document.body.append(probe)
  const muted = getComputedStyle(probe).backgroundColor
  probe.remove()
  return getComputedStyle(element).backgroundColor === muted
}, await locator.elementHandle())
const themeState = () => page.evaluate(() => {
  const resolveColor = variable => {
    const probe = document.createElement("span")
    probe.style.color = `var(${variable})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }
  const darkRoot = document.querySelector(".dark")
  const face = [...document.fonts].find(item => item.family.replaceAll('"', "") === "Geist Variable" && item.status === "loaded")
  return {
    dark: Boolean(darkRoot),
    primary: resolveColor("--primary"),
    primaryForeground: resolveColor("--primary-foreground"),
    foreground: resolveColor("--foreground"),
    background: resolveColor("--background"),
    ring: resolveColor("--ring"),
    geistLoaded: Boolean(face),
    fontCheck: document.fonts.check('16px "Geist Variable"'),
  }
})

const evidence = {
  run: "release008-toggle-group-browser",
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

  await openStory("SingleLight")
  const singleLightTheme = await themeState()
  const singleGroup = page.locator("[data-slot='toggle-group']").first()
  assert.equal(await singleGroup.getAttribute("aria-label"), "Text formatting")
  const bold = page.getByRole("radio", { name: "Bold", exact: true })
  const italic = page.getByRole("radio", { name: "Italic", exact: true })
  const underline = page.getByRole("radio", { name: "Underline", exact: true })
  assert.equal(await bold.getAttribute("aria-checked"), "true")
  assert.equal(await italic.getAttribute("aria-checked"), "false")
  const selectedLight = await paint(bold)
  const selectedContrastLight = contrastOf(selectedLight)
  assert.ok(Math.abs(selectedContrastLight - 6.824) < 0.08, `Light selected primary contrast should be 6.824, got ${selectedContrastLight}`)
  assert.equal(selectedLight.background, singleLightTheme.primary)
  assert.equal(selectedLight.color, singleLightTheme.primaryForeground)
  await bold.hover()
  const selectedHovered = await paint(bold)
  assert.equal(selectedHovered.background, selectedLight.background, "Hover must not change the selected primary background")
  assert.equal(selectedHovered.color, selectedLight.color, "Hover must not change the selected primary foreground")
  await italic.hover()
  await waitForHoverPaint(italic)
  const unselectedHoveredLight = await paint(italic)
  const unselectedContrastLight = contrastOf(unselectedHoveredLight)
  const selectedToHoverContrastLight = backgroundContrast(selectedLight, unselectedHoveredLight)
  assert.notEqual(unselectedHoveredLight.background, selectedLight.background)
  assert.ok(Math.abs(selectedToHoverContrastLight - 6.256) < 0.02, `Light selected-to-unselected-hover contrast should be 6.256, got ${selectedToHoverContrastLight}`)
  assert.ok(unselectedContrastLight >= 4.5, "Unselected hover text must meet 4.5:1 contrast")
  assert.equal(singleLightTheme.dark, false)
  assert.equal(singleLightTheme.geistLoaded, true)
  assert.equal(singleLightTheme.fontCheck, true)
  evidence.checks.singleLightContrastAndHover = { theme: singleLightTheme, selected: selectedLight, selectedContrast: selectedContrastLight, selectedHovered, unselectedHovered: unselectedHoveredLight, unselectedTextContrast: unselectedContrastLight, selectedToHoverContrast: selectedToHoverContrastLight }
  evidence.screenshots.light = await screenshot("light")

  await openStory("SingleDark")
  const singleDarkTheme = await themeState()
  const darkBold = page.getByRole("radio", { name: "Bold", exact: true })
  const darkSelected = await paint(darkBold)
  const selectedContrastDark = contrastOf(darkSelected)
  assert.equal(singleDarkTheme.dark, true)
  assert.equal(darkSelected.background, singleDarkTheme.primary)
  assert.equal(darkSelected.color, singleDarkTheme.primaryForeground)
  assert.ok(Math.abs(selectedContrastDark - 7.506) < 0.08, `Dark selected primary contrast should be 7.506, got ${selectedContrastDark}`)
  await darkBold.hover()
  const darkSelectedHovered = await paint(darkBold)
  assert.equal(darkSelectedHovered.background, darkSelected.background)
  assert.equal(darkSelectedHovered.color, darkSelected.color)
  const darkItalic = page.getByRole("radio", { name: "Italic", exact: true })
  await darkItalic.hover()
  await waitForHoverPaint(darkItalic)
  const unselectedHoveredDark = await paint(darkItalic)
  const unselectedContrastDark = contrastOf(unselectedHoveredDark)
  const selectedToHoverContrastDark = backgroundContrast(darkSelected, unselectedHoveredDark)
  assert.notEqual(unselectedHoveredDark.background, darkSelected.background)
  assert.ok(Math.abs(selectedToHoverContrastDark - 5.732) < 0.02, `Dark selected-to-unselected-hover contrast should be 5.732, got ${selectedToHoverContrastDark}`)
  assert.ok(unselectedContrastDark >= 4.5)
  evidence.checks.singleDarkContrastAndHover = { theme: singleDarkTheme, selected: darkSelected, selectedContrast: selectedContrastDark, selectedHovered: darkSelectedHovered, unselectedHovered: unselectedHoveredDark, unselectedTextContrast: unselectedContrastDark, selectedToHoverContrast: selectedToHoverContrastDark }
  evidence.screenshots.dark = await screenshot("dark")

  const fontResponse = fontResponses.find(item => item.status >= 200 && item.status < 300)
  assert.ok(fontResponse, "A font resource must load successfully over the browser network")
  evidence.checks.fontNetwork = { successfulResponse: fontResponse, responses: fontResponses }

  await openStory("SingleLight")
  await page.waitForFunction(() => document.activeElement instanceof HTMLElement
    && document.activeElement.matches("[data-slot='toggle-group-item']:focus-visible"))
  const focusTheme = await themeState()
  const focus = await page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement)) return null
    const style = getComputedStyle(element)
    const probe = document.createElement("span")
    probe.style.backgroundColor = "var(--background)"
    document.body.append(probe)
    const background = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      label: element.getAttribute("aria-label") || element.textContent?.trim(),
      focused: element.matches(":focus-visible"),
      boxShadow: style.boxShadow,
      outline: style.outline,
      outlineOffset: style.outlineOffset,
      ringOffsetWidth: style.getPropertyValue("--tw-ring-offset-width").trim(),
      ringOffsetColor: style.getPropertyValue("--tw-ring-offset-color").trim(),
      ringColor: style.getPropertyValue("--tw-ring-color").trim(),
      semanticBackground: background,
    }
  })
  assert.ok(focus, "A keyboard focus target must exist")
  assert.equal(focus.label, "Bold")
  assert.equal(focus.focused, true)
  assert.notEqual(focus.boxShadow, "none", "Keyboard focus must display a ring")
  assert.equal(focus.ringOffsetWidth, "2px", "Focus ring must have a 2px gap")
  assert.equal(focus.ringOffsetColor, focus.semanticBackground, "Focus gap must use the semantic background token")
  assert.equal(focus.ringColor, focusTheme.ring, "Focus ring must use the semantic ring token")
  evidence.checks.keyboardFocusRing = { theme: focusTheme, ...focus }
  evidence.screenshots.focus = await screenshot("focus")

  await openStory("MultipleLight")
  const multipleGroup = page.locator("[data-slot='toggle-group']").first()
  assert.equal(await multipleGroup.getAttribute("aria-label"), "Text formatting")
  const multipleBold = page.getByRole("button", { name: "Bold", exact: true })
  const multipleItalic = page.getByRole("button", { name: "Italic", exact: true })
  const multipleUnderline = page.getByRole("button", { name: "Underline", exact: true })
  assert.equal(await multipleBold.getAttribute("aria-pressed"), "true")
  assert.equal(await multipleItalic.getAttribute("aria-pressed"), "false")
  assert.equal(await multipleUnderline.getAttribute("aria-pressed"), "true")
  await multipleItalic.click()
  assert.deepEqual(await items.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))), ["true", "true", "true", "false"])
  await multipleBold.click()
  assert.deepEqual(await items.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))), ["false", "true", "true", "false"])
  evidence.checks.multipleSelection = await items.evaluateAll(nodes => nodes.map(node => ({ name: node.getAttribute("aria-label") || node.textContent?.trim(), pressed: node.getAttribute("aria-pressed") })))

  await openStory("SingleLight")
  await page.getByRole("radio", { name: "Italic", exact: true }).click()
  await page.waitForFunction(() => {
    const selected = document.querySelector("[data-slot='toggle-group-item'][data-state='on']")
    if (!(selected instanceof HTMLElement)) return false
    const probe = document.createElement("span")
    probe.style.backgroundColor = "var(--primary)"
    document.body.append(probe)
    const primary = getComputedStyle(probe).backgroundColor
    probe.remove()
    return getComputedStyle(selected).backgroundColor === primary
  })
  assert.equal(await page.getByRole("radio", { name: "Bold", exact: true }).getAttribute("aria-checked"), "false")
  assert.equal(await page.getByRole("radio", { name: "Italic", exact: true }).getAttribute("aria-checked"), "true")
  assert.equal(await page.locator("[data-slot='toggle-group-item'][data-state='on']").count(), 1)
  evidence.checks.singleSelection = { selectedAfterClick: await paint(page.getByRole("radio", { name: "Italic", exact: true })) }

  await openStory("Disabled")
  const disabledItems = await items.evaluateAll(nodes => nodes.map(node => ({
    label: node.textContent?.trim(),
    disabled: node.matches(":disabled"),
    ariaDisabled: node.getAttribute("aria-disabled"),
    opacity: getComputedStyle(node).opacity,
    state: node.getAttribute("data-state"),
  })))
  assert.ok(disabledItems.length > 0)
  assert.ok(disabledItems.every(item => item.disabled && (item.ariaDisabled === null || item.ariaDisabled === "true") && Number(item.opacity) < 1))
  const disabledBold = page.locator("[data-slot='toggle-group-item']").first()
  const disabledBefore = await disabledBold.getAttribute("data-state")
  await disabledBold.click({ force: true })
  assert.equal(await disabledBold.getAttribute("data-state"), disabledBefore, "A disabled item must not change its selection")
  evidence.checks.disabledSemantics = disabledItems

  await openStory("SingleDark")
  evidence.checks.singleDarkSelectionState = await page.evaluate(() => ({
    darkActive: Boolean(document.querySelector(".dark")),
    selectedState: [...document.querySelectorAll("[data-slot='toggle-group-item']")].map(item => item.getAttribute("data-state")),
  }))
  assert.equal(evidence.checks.singleDarkSelectionState.darkActive, true)
  await openStory("MultipleDark")
  const multipleDarkTheme = await themeState()
  const multipleDarkItems = await items.evaluateAll(nodes => nodes.map(node => ({
    label: node.getAttribute("aria-label") || node.textContent?.trim(),
    pressed: node.getAttribute("aria-pressed"),
    background: getComputedStyle(node).backgroundColor,
    color: getComputedStyle(node).color,
  })))
  assert.equal(multipleDarkTheme.dark, true)
  assert.deepEqual(multipleDarkItems.map(item => item.pressed), ["true", "false", "true", "false"])
  evidence.checks.multipleDark = { theme: multipleDarkTheme, items: multipleDarkItems }

  await openStory("Rtl")
  const rtlGroup = page.locator("[data-slot='toggle-group']").first()
  const rtlButtons = page.locator("[data-slot='toggle-group-item']")
  const rtlShape = await rtlButtons.evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    return {
      text: node.textContent?.trim(),
      left: rect.left,
      right: rect.right,
      topRight: style.borderTopRightRadius,
      topLeft: style.borderTopLeftRadius,
      bottomRight: style.borderBottomRightRadius,
      bottomLeft: style.borderBottomLeftRadius,
      transform: style.transform,
    }
  }))
  assert.equal(await rtlGroup.getAttribute("dir"), "rtl")
  assert.ok(rtlShape[0].left > rtlShape.at(-1).left, "RTL visual order must begin at the right edge")
  assert.notEqual(rtlShape[0].topRight, "0px", "First RTL item must round its logical start corners on the right")
  assert.notEqual(rtlShape.at(-1).topLeft, "0px", "Last RTL item must round its logical end corners on the left")
  assert.ok(rtlShape.every(item => item.transform === "none"), "Toggle items must not be physically transformed in RTL")
  const rtlBold = page.getByRole("radio", { name: "عريض", exact: true })
  await rtlBold.focus()
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "عريض"
    && document.activeElement?.closest("[data-slot='toggle-group']")?.getAttribute("dir") === "rtl")
  await page.keyboard.press("ArrowLeft")
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "مائل")
  const rtlKeyboard = await page.evaluate(() => ({
    label: document.activeElement?.textContent?.trim(),
    checked: document.activeElement?.getAttribute("aria-checked"),
    focusVisible: document.activeElement?.matches(":focus-visible"),
  }))
  assert.equal(rtlKeyboard.label, "مائل", "RTL ArrowLeft must move focus in the visual left direction")
  assert.equal(rtlKeyboard.focusVisible, true)
  evidence.checks.rtl = { direction: await rtlGroup.getAttribute("dir"), shape: rtlShape, keyboard: rtlKeyboard }
  evidence.screenshots.rtl = await screenshot("rtl")

  const standaloneStorySource = readFileSync(standaloneStoryFile, "utf8")
  const standaloneTitle = standaloneStorySource.match(/title:\s*["']([^"']+)["']/)?.[1]
  const standaloneId = `${slug(standaloneTitle)}--playground`
  const standaloneEntry = index.entries?.[standaloneId]
  assert.ok(standaloneEntry, `Standalone Toggle story must be indexed as ${standaloneId}`)
  assert.equal(standaloneEntry.importPath, "./src/components/ui/toggle.stories.tsx")
  currentStoryId = standaloneId
  const standaloneURL = new URL(`${baseURL}/iframe.html`)
  standaloneURL.searchParams.set("id", standaloneId)
  standaloneURL.searchParams.set("viewMode", "story")
  await page.goto(standaloneURL.toString(), { waitUntil: "networkidle" })
  const standalone = page.getByRole("button", { name: "Toggle bold", exact: true })
  assert.equal(await standalone.getAttribute("aria-pressed"), "false")
  await standalone.click()
  const standalonePaint = await standalone.evaluate(element => {
    const style = getComputedStyle(element)
    const probe = document.createElement("span")
    probe.style.backgroundColor = "var(--muted)"
    document.body.append(probe)
    const muted = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { pressed: element.getAttribute("aria-pressed"), background: style.backgroundColor, muted }
  })
  assert.equal(standalonePaint.pressed, "true")
  assert.equal(standalonePaint.background, standalonePaint.muted, "Standalone Toggle pressed paint must remain muted")
  evidence.checks.standaloneToggle = standalonePaint

  assert.deepEqual(errors, [], "Toggle Group stories must have no unexpected browser console or page errors")
  evidence.status = "passed"
} catch (error) {
  evidence.status = "failed"
  evidence.failure = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  evidence.consoleAndPageErrors = errors
  evidence.fontResponses = fontResponses
  writeFileSync(path.join(artifactDirectory, "toggle-group-browser-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify(evidence, null, 2))
