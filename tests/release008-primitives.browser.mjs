import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { contrastRatio, oklchToLinearSrgb } from "./helpers/oklch-contrast.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const storyFile = path.join(root, "src/components/ui/icon.stories.tsx")
const storyImportPath = "./src/components/ui/icon.stories.tsx"
const baseURL = (process.env.STORYBOOK_URL ?? "http://127.0.0.1:6008").replace(/\/$/, "")
const artifactDirectory = process.env.RELEASE008_BROWSER_OUTPUT ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser"
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

const response = await fetch(`${baseURL}/index.json`)
assert.equal(response.status, 200, `Storybook index request failed: ${response.status}`)
const index = await response.json()
for (const [exportName, id] of storyIds) {
  const entry = index.entries?.[id]
  assert.ok(entry, `Story ${exportName} was not found in Storybook index as ${id}`)
  assert.equal(entry.title, title)
  assert.equal(entry.importPath, storyImportPath)
  assert.equal(entry.exportName, exportName)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 1 })
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
  const file = path.join(artifactDirectory, `icon-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
const openStory = async exportName => {
  currentStoryId = storyIds.get(exportName)
  const url = new URL(`${baseURL}/iframe.html`)
  url.searchParams.set("id", currentStoryId)
  url.searchParams.set("viewMode", "story")
  await page.goto(url.toString(), { waitUntil: "networkidle" })
  await page.locator("svg[data-slot='icon']").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}
const colorToLinear = value => {
  if (/^oklch\(/i.test(value.trim())) return oklchToLinearSrgb(value)
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  assert.ok(match, `Unsupported computed color: ${value}`)
  return match.slice(1, 4).map(channel => {
    const encoded = Number(channel) / 255
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4
  })
}

const evidence = {
  run: "release008-primitives-icon-browser",
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
  const fontState = await page.evaluate(async () => {
    await document.fonts.load('16px "Geist Variable"')
    await document.fonts.ready
    return {
      check: document.fonts.check('16px "Geist Variable"'),
      faces: [...document.fonts].map(face => ({ family: face.family, status: face.status })),
      resources: performance.getEntriesByType("resource")
        .map(entry => entry.name)
        .filter(name => /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(name)),
    }
  })
  const geistFace = fontState.faces.find(face => face.family.replaceAll('"', "") === "Geist Variable" && face.status === "loaded")
  const fontResponse = fontResponses.find(item => item.status >= 200 && item.status < 300)
  assert.equal(fontState.check, true, "Geist Variable font must be available to the preview")
  assert.ok(geistFace, "A Geist Variable font face must finish loading")
  assert.ok(fontResponse && fontState.resources.length > 0, "A font resource must load successfully over the browser network")
  evidence.checks.fonts = { check: fontState.check, face: geistFace, successfulResponse: fontResponse, resources: fontState.resources }
  evidence.screenshots.default = await screenshot("default")

  await openStory("Sizes")
  const sizeMeasurements = await page.locator("svg[data-slot='icon']").evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }))
  assert.deepEqual(sizeMeasurements, [14, 16, 20].map(size => ({ width: size, height: size })))
  evidence.checks.sizes = sizeMeasurements
  evidence.screenshots.sizes = await screenshot("sizes")

  await openStory("Accessibility")
  const accessibility = await page.evaluate(() => {
    const icons = [...document.querySelectorAll("svg[data-slot='icon']")]
    const info = icons.find(icon => icon.getAttribute("aria-label") === "Information")
    const button = document.querySelector("button[aria-label='Search']")
    return {
      iconCount: icons.length,
      meaningful: info && { role: info.getAttribute("role"), label: info.getAttribute("aria-label"), hidden: info.getAttribute("aria-hidden") },
      decorative: icons.filter(icon => icon.getAttribute("aria-hidden") === "true").length,
      button: button && { name: button.getAttribute("aria-label"), decorativeIconHidden: button.querySelector("svg[data-slot='icon']")?.getAttribute("aria-hidden") },
    }
  })
  assert.equal(accessibility.iconCount, 3)
  assert.deepEqual(accessibility.meaningful, { role: "img", label: "Information", hidden: null })
  assert.equal(accessibility.decorative, 2)
  assert.deepEqual(accessibility.button, { name: "Search", decorativeIconHidden: "true" })
  assert.equal(await page.getByRole("img", { name: "Information" }).count(), 1)
  assert.equal(await page.getByRole("button", { name: "Search" }).count(), 1)
  evidence.checks.accessibility = accessibility
  evidence.screenshots.accessibility = await screenshot("accessibility")

  await openStory("InButtons")
  const buttons = await page.getByRole("button").evaluateAll(nodes => nodes.map(button => ({
    name: button.getAttribute("aria-label") || button.textContent?.trim(),
    busy: button.getAttribute("aria-busy"),
    disabled: button.disabled,
    iconVisible: Boolean(button.querySelector("svg[data-slot='icon']")?.getClientRects().length),
    iconCount: button.querySelectorAll("svg[data-slot='icon']").length,
    spinnerHidden: button.querySelector("[data-slot='spinner']")?.getAttribute("aria-hidden") === "true",
  })))
  const loadingButton = page.locator("button[aria-busy='true']")
  assert.equal(await loadingButton.count(), 1)
  assert.equal(await loadingButton.getAttribute("aria-label"), null)
  assert.equal((await loadingButton.innerText()).trim(), "Search")
  assert.equal(await loadingButton.isDisabled(), true)
  assert.equal(await loadingButton.locator("[data-slot='icon']").count(), 1)
  assert.equal(await loadingButton.locator("[data-slot='icon']").isVisible(), false, "Loading must hide the authored icon")
  assert.equal(await loadingButton.locator("[data-slot='icon']").getAttribute("aria-hidden"), "true")
  assert.equal(await loadingButton.locator("[data-slot='spinner']").getAttribute("aria-hidden"), "true")
  assert.equal(await page.getByRole("button", { name: "Search", exact: true }).count(), 2)
  assert.equal(await page.getByRole("button", { name: "Continue", exact: true }).count(), 1)
  assert.equal(await page.getByRole("button", { name: "Close", exact: true }).count(), 1)
  evidence.checks.buttons = buttons
  evidence.screenshots.buttons = await screenshot("buttons")

  await openStory("Rtl")
  const direction = await page.locator("svg[data-slot='icon']").evaluateAll(nodes => nodes.map((node, index) => ({
    index,
    rotate: getComputedStyle(node).rotate,
    direction: node.closest("[dir]")?.getAttribute("dir"),
  })))
  assert.deepEqual(direction.slice(0, 4).map(item => item.rotate), ["180deg", "180deg", "180deg", "180deg"])
  assert.deepEqual(direction.slice(4, 6).map(item => item.rotate), ["none", "none"])
  evidence.checks.rtlRotation = direction
  evidence.screenshots.rtl = await screenshot("rtl")

  await openStory("Dark")
  const darkState = await page.evaluate(() => {
    const themeRoot = document.querySelector(".dark")
    const meaningfulIcon = document.querySelector("svg[data-slot='icon'][aria-label='Information']")
    const button = document.querySelector("button[aria-label='Search']")
    const buttonIcon = button?.querySelector("svg[data-slot='icon']")
    const resolveToken = token => {
      const probe = document.createElement("span")
      probe.style.color = `var(${token})`
      document.body.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    return {
      darkThemeActive: Boolean(themeRoot),
      foregroundToken: resolveToken("--foreground"),
      bodyForeground: getComputedStyle(document.body).color,
      meaningfulIcon: meaningfulIcon && {
        role: meaningfulIcon.getAttribute("role"),
        label: meaningfulIcon.getAttribute("aria-label"),
        color: getComputedStyle(meaningfulIcon).color,
      },
      button: button && {
        name: button.getAttribute("aria-label"),
        foregroundToken: resolveToken("--primary-foreground"),
        color: getComputedStyle(button).color,
        iconColor: buttonIcon && getComputedStyle(buttonIcon).color,
        iconHidden: buttonIcon?.getAttribute("aria-hidden"),
      },
    }
  })
  assert.equal(darkState.darkThemeActive, true)
  assert.equal(darkState.bodyForeground, darkState.foregroundToken, "Dark body text must use the semantic foreground token")
  assert.deepEqual(darkState.meaningfulIcon, {
    role: "img",
    label: "Information",
    color: darkState.foregroundToken,
  })
  assert.equal(await page.getByRole("img", { name: "Information" }).count(), 1)
  assert.equal(darkState.button.name, "Search")
  assert.equal(darkState.button.color, darkState.button.foregroundToken, "Icon Button must use the dark primary-foreground token")
  assert.equal(darkState.button.iconColor, darkState.button.color, "Button Icon must inherit its button foreground")
  assert.equal(darkState.button.iconHidden, "true")
  assert.equal(await page.getByRole("button", { name: "Search", exact: true }).count(), 1)
  evidence.checks.darkSemanticForeground = darkState
  evidence.screenshots.dark = await screenshot("dark")

  const colorEvidence = {}
  const semanticTokens = {
    foreground: "--foreground",
    primary: "--primary",
    "muted-foreground": "--muted-foreground",
    destructive: "--destructive",
  }
  for (const [exportName, expectedDark] of [["Colors", false], ["ColorsDark", true], ["ColorsRtl", false]]) {
    await openStory(exportName)
    const measured = await page.evaluate(tokens => {
      const resolve = (property, value) => {
        const probe = document.createElement("span")
        probe.style[property] = value
        document.body.append(probe)
        const result = getComputedStyle(probe)[property]
        probe.remove()
        return result
      }
      const icons = [...document.querySelectorAll("svg[data-slot='icon']")]
      const examples = icons.filter(icon => icon.getAttribute("role") === "img").map(icon => {
        const style = getComputedStyle(icon)
        const computedTokens = Object.fromEntries(Object.entries(tokens).map(([name, variable]) => [name, resolve("color", `var(${variable})`)]))
        return {
          label: icon.getAttribute("aria-label"),
          accessibleRole: icon.getAttribute("role"),
          color: style.color,
          stroke: icon.getAttribute("stroke"),
          rotate: style.rotate,
          transform: style.transform,
          tokens: computedTokens,
        }
      })
      const button = document.querySelector("button[data-slot='button']")
      const buttonIcon = button?.querySelector("svg[data-slot='icon']")
      const background = resolve("backgroundColor", "var(--background)")
      const dark = Boolean(document.querySelector(".dark"))
      return {
        dark,
        direction: document.querySelector("[dir]")?.getAttribute("dir") ?? "ltr",
        background,
        examples,
        inherited: icons[0] && {
          label: icons[0].getAttribute("aria-label"),
          color: getComputedStyle(icons[0]).color,
          parentColor: getComputedStyle(icons[0].parentElement).color,
        },
        button: button && {
          name: button.textContent?.trim(),
          color: getComputedStyle(button).color,
          iconColor: buttonIcon && getComputedStyle(buttonIcon).color,
          iconStroke: buttonIcon?.getAttribute("stroke"),
          iconHidden: buttonIcon?.getAttribute("aria-hidden"),
        },
      }
    }, semanticTokens)
    assert.equal(measured.dark, expectedDark, `${exportName} must render its requested theme`)
    assert.equal(measured.examples.length, 5)
    assert.equal(measured.inherited.color, measured.inherited.parentColor, `${exportName} inherit must retain its surrounding foreground`)
    assert.deepEqual(measured.inherited, {
      label: "inherit information",
      color: measured.inherited.parentColor,
      parentColor: measured.inherited.parentColor,
    })
    for (const [index, [colorName, token]] of Object.entries(semanticTokens).entries()) {
      const icon = measured.examples[index + 1]
      const expectedColor = icon.tokens[colorName]
      assert.equal(icon.label, `${colorName} information`, `${exportName} must keep meaningful Icon names`)
      assert.equal(icon.accessibleRole, "img")
      assert.equal(icon.color, expectedColor, `${exportName} ${colorName} Icon must paint its semantic token`)
      assert.equal(icon.stroke, "currentColor", `${exportName} ${colorName} SVG stroke must follow currentColor`)
      const contrast = contrastRatio(colorToLinear(icon.color), colorToLinear(measured.background))
      assert.ok(contrast >= 3, `${exportName} ${colorName} icon contrast on the supplied background is ${contrast}:1`)
      icon.contrast = contrast
      icon.token = token
    }
    assert.equal(measured.button?.name, "Search — inherited button color")
    assert.equal(measured.button.color, measured.button.iconColor, `${exportName} Icon must inherit the Button foreground`)
    assert.equal(measured.button.iconStroke, "currentColor")
    assert.equal(measured.button.iconHidden, "true")
    if (exportName === "ColorsRtl") {
      assert.equal(measured.direction, "rtl")
      assert.ok(measured.examples.every(icon => icon.rotate === "none" && icon.transform === "none"), "RTL color examples must not rotate or mirror Icons")
      assert.deepEqual(measured.examples.map(icon => icon.color), colorEvidence.Colors.examples.map(icon => icon.color), "RTL must preserve the Light semantic colors")
    }
    colorEvidence[exportName] = measured
    evidence.screenshots[exportName] = await screenshot(exportName === "Colors" ? "colors-light" : exportName === "ColorsDark" ? "colors-dark" : "colors-rtl")
  }
  for (const colorName of ["foreground", "primary", "muted-foreground", "destructive"]) {
    assert.notEqual(colorEvidence.Colors.examples.find(icon => icon.label === `${colorName} information`)?.color,
      colorEvidence.ColorsDark.examples.find(icon => icon.label === `${colorName} information`)?.color,
      `${colorName} must follow its distinct Light/Dark token values`)
  }
  evidence.checks.semanticColors = colorEvidence

  assert.deepEqual(errors, [], "Icon stories must have no unexpected browser console or page errors")
  evidence.status = "passed"
} catch (error) {
  evidence.status = "failed"
  evidence.failure = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  evidence.consoleAndPageErrors = errors
  evidence.fontResponses = fontResponses
  evidence.screenshots = Object.fromEntries(Object.entries(evidence.screenshots).map(([name, file]) => [name, file]))
  writeFileSync(path.join(artifactDirectory, "icon-browser-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify(evidence, null, 2))
