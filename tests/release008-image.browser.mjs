import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const root = fileURLToPath(new URL("../", import.meta.url))
const storyFile = path.join(root, "src/components/ui/image.stories.tsx")
const storyImportPath = "./src/components/ui/image.stories.tsx"
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
const page = await browser.newPage({ viewport: { width: 900, height: 680 }, deviceScaleFactor: 1 })
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
  const file = path.join(artifactDirectory, `image-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
const openStory = async exportName => {
  currentStoryId = storyIds.get(exportName)
  const url = new URL(`${baseURL}/iframe.html`)
  url.searchParams.set("id", currentStoryId)
  url.searchParams.set("viewMode", "story")
  await page.goto(url.toString(), { waitUntil: "networkidle" })
  await page.locator("img[data-slot='image']").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}
const loadedImages = async () => {
  await page.waitForFunction(() => [...document.querySelectorAll("img[data-slot='image']")]
    .every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0))
  return page.locator("img[data-slot='image']").evaluateAll(images => images.map(image => {
    const rect = image.getBoundingClientRect()
    const parentRect = image.parentElement.getBoundingClientRect()
    return {
      alt: image.getAttribute("alt"),
      widthAttribute: image.getAttribute("width"),
      heightAttribute: image.getAttribute("height"),
      loading: image.getAttribute("loading"),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      parentWidth: parentRect.width,
      parentHeight: parentRect.height,
      objectFit: getComputedStyle(image).objectFit,
      transform: getComputedStyle(image).transform,
      rotate: getComputedStyle(image).rotate,
      src: image.currentSrc,
    }
  }))
}

const evidence = {
  run: "release008-image-browser",
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
  const defaultImage = (await loadedImages())[0]
  assert.equal(defaultImage.alt, "Mountain landscape under a bright sun")
  assert.equal(defaultImage.widthAttribute, "640")
  assert.equal(defaultImage.heightAttribute, "360")
  assert.equal(defaultImage.loading, "eager")
  assert.equal(defaultImage.naturalWidth, 640)
  assert.equal(defaultImage.naturalHeight, 360)
  assert.equal(defaultImage.renderedWidth, 640)
  assert.equal(defaultImage.renderedHeight, 360)
  assert.equal(await page.getByRole("img", { name: "Mountain landscape under a bright sun" }).count(), 1)
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
  assert.equal(fontState.check, true)
  assert.ok(geistFace, "Geist Variable must finish loading")
  assert.ok(fontResponse && fontState.resources.length > 0, "A font resource must load successfully over the browser network")
  evidence.checks.defaultAndFonts = { image: defaultImage, font: { check: fontState.check, face: geistFace, successfulResponse: fontResponse, resources: fontState.resources } }
  evidence.screenshots.default = await screenshot("default")

  await openStory("Logo")
  const logo = (await loadedImages())[0]
  assert.equal(logo.alt, "Example company")
  assert.equal(logo.widthAttribute, "240")
  assert.equal(logo.heightAttribute, "80")
  assert.equal(logo.naturalWidth, 240)
  assert.equal(logo.naturalHeight, 80)
  assert.equal(await page.getByRole("img", { name: "Example company" }).count(), 1)
  evidence.checks.logo = logo

  await openStory("Decorative")
  const decorative = (await loadedImages())[0]
  assert.equal(decorative.alt, "")
  assert.equal(await page.locator("img[data-slot='image']").getAttribute("role"), null)
  assert.equal(await page.getByRole("img").count(), 0, "An empty-alt image must not enter the image role query")
  evidence.checks.decorative = decorative
  evidence.screenshots.decorative = await screenshot("decorative")

  await openStory("Constrained")
  const constrained = (await loadedImages())[0]
  assert.equal(constrained.widthAttribute, "640")
  assert.equal(constrained.heightAttribute, "360")
  assert.equal(constrained.naturalWidth, 640)
  assert.equal(constrained.naturalHeight, 360)
  assert.equal(constrained.renderedWidth, 192)
  assert.equal(constrained.renderedHeight, 108)
  assert.equal(constrained.renderedWidth / constrained.renderedHeight, 640 / 360)
  evidence.checks.intrinsicResponsiveRatio = constrained
  evidence.screenshots.constrained = await screenshot("constrained")

  await openStory("Fill")
  const fill = await loadedImages()
  assert.equal(fill.length, 2)
  for (const image of fill) {
    assert.equal(image.widthAttribute, "640")
    assert.equal(image.heightAttribute, "360")
    assert.equal(image.naturalWidth, 640)
    assert.equal(image.naturalHeight, 360)
    assert.equal(image.renderedWidth, 192)
    assert.equal(image.renderedHeight, 192)
    assert.equal(image.parentWidth, 192)
    assert.equal(image.parentHeight, 192)
  }
  assert.deepEqual(fill.map(image => image.objectFit), ["contain", "cover"])
  evidence.checks.fill = fill
  evidence.screenshots.fill = await screenshot("fill")

  await openStory("Lazy")
  const lazy = (await loadedImages())[0]
  assert.equal(lazy.loading, "lazy", "The native loading attribute must be forwarded")
  assert.equal(lazy.alt, "Mountain landscape under a bright sun")
  assert.equal(await page.getByRole("img", { name: "Mountain landscape under a bright sun" }).count(), 1)
  evidence.checks.lazyLoading = lazy

  const themeEvidence = {}
  for (const exportName of ["Light", "Dark"]) {
    await openStory(exportName)
    const image = (await loadedImages())[0]
    const theme = await page.evaluate(() => {
      const darkRoot = document.querySelector(".dark")
      const backgroundProbe = document.createElement("span")
      backgroundProbe.style.backgroundColor = "var(--background)"
      document.body.append(backgroundProbe)
      const tokenBackground = getComputedStyle(backgroundProbe).backgroundColor
      backgroundProbe.remove()
      return {
        darkThemeActive: Boolean(darkRoot),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        tokenBackground,
      }
    })
    assert.equal(theme.darkThemeActive, exportName === "Dark")
    assert.equal(theme.bodyBackground, theme.tokenBackground, `${exportName} preview must use semantic background`)
    assert.equal(image.alt, "Example company")
    assert.equal(image.naturalWidth, 240)
    assert.equal(image.naturalHeight, 80)
    themeEvidence[exportName.toLowerCase()] = { ...theme, image }
    evidence.screenshots[exportName.toLowerCase()] = await screenshot(exportName.toLowerCase())
  }
  assert.notEqual(themeEvidence.light.bodyBackground, themeEvidence.dark.bodyBackground, "Light and dark surroundings must visibly differ")
  evidence.checks.themes = themeEvidence

  await openStory("Rtl")
  const rtl = (await loadedImages())[0]
  assert.equal(rtl.alt, "منظر جبلي")
  assert.equal(rtl.widthAttribute, "640")
  assert.equal(rtl.heightAttribute, "360")
  assert.equal(rtl.naturalWidth, 640)
  assert.equal(rtl.naturalHeight, 360)
  assert.equal(rtl.renderedWidth, 192)
  assert.equal(rtl.transform, "none")
  assert.equal(rtl.rotate, "none")
  assert.equal(await page.getByRole("img", { name: "منظر جبلي" }).count(), 1)
  evidence.checks.rtl = rtl
  evidence.screenshots.rtl = await screenshot("rtl")

  assert.deepEqual(errors, [], "Image stories must have no unexpected browser console or page errors")
  evidence.status = "passed"
} catch (error) {
  evidence.status = "failed"
  evidence.failure = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  evidence.consoleAndPageErrors = errors
  evidence.fontResponses = fontResponses
  writeFileSync(path.join(artifactDirectory, "image-browser-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify(evidence, null, 2))
