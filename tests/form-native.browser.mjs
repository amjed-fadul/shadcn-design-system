import assert from "node:assert/strict"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

// Real-browser checks for native <form> behavior that jsdom cannot reproduce:
// implicit (Enter-key) submission with trusted key events, constraint
// validation blocking submit, and a native action/method navigation.
const root = fileURLToPath(new URL("../", import.meta.url))
const server = await createServer({ root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, realpathSync(new URL("../node_modules", import.meta.url))] } }, logLevel: "error" })
await server.listen()
const address = server.httpServer.address()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
page.setDefaultTimeout(10000)
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })

const submits = (id) => page.locator(`#${id}`).evaluate((form) => Number(form.dataset.submits ?? "0"))
const data = (id) => page.locator(`#${id}`).evaluate((form) => JSON.parse(form.dataset.data ?? "{}"))

try {
  await page.goto(`http://127.0.0.1:${address.port}/tests/fixtures/form-native.html`)
  await page.locator("#login").waitFor()

  // Real <form> elements, no explicit role, and one form landmark per named form.
  const tags = await page.locator("[data-slot='form']").evaluateAll((nodes) => nodes.map((node) => [node.tagName, node.getAttribute("role")]))
  assert.equal(tags.length, 4)
  for (const [tag, role] of tags) { assert.equal(tag, "FORM"); assert.equal(role, null) }
  assert.equal(await page.getByRole("form").count(), 4)
  assert.equal(await page.getByRole("button", { name: "Log in" }).count(), 1)

  // Enter with an invalid required field: constraint validation blocks submit.
  await page.getByLabel("Username", { exact: true }).focus()
  await page.keyboard.press("Enter")
  assert.equal(await submits("login"), 0, "Enter with empty required fields must not submit")
  assert.equal(await page.getByLabel("Username", { exact: true }).evaluate((input) => input.validity.valueMissing), true)

  // Trusted Enter in a valid form submits natively.
  await page.getByLabel("Username", { exact: true }).fill("ada")
  await page.getByLabel("Password", { exact: true }).fill("correct horse")
  await page.getByLabel("Username", { exact: true }).focus()
  await page.keyboard.press("Enter")
  assert.equal(await submits("login"), 1, "Enter in a text input must submit the form")
  assert.deepEqual(await data("login"), { username: "ada", password: "correct horse" })

  // Enter in the password control of the InputGroup submits too.
  await page.getByLabel("Password", { exact: true }).focus()
  await page.keyboard.press("Enter")
  assert.equal(await submits("login"), 2)

  // The inline Show/Hide InputGroupButton is type="button": clicking and pressing Enter/Space on it never submit.
  const toggle = page.getByRole("button", { name: "Show password" })
  assert.equal(await toggle.getAttribute("type"), "button")
  await toggle.click()
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "text")
  await page.getByRole("button", { name: "Hide password" }).focus()
  await page.keyboard.press("Enter")
  await page.keyboard.press("Space")
  assert.equal(await submits("login"), 2, "InputGroupButton must not submit the form")

  // The submit Button submits the surrounding Form and keeps its accessible name.
  const submit = page.getByRole("button", { name: "Log in" })
  assert.equal(await submit.getAttribute("type"), "submit")
  await submit.click()
  assert.equal(await submits("login"), 3)

  // noValidate is forwarded and lets an invalid form submit.
  assert.equal(await page.locator("#skip-validation").evaluate((form) => form.noValidate), true)
  assert.equal(await page.locator("#login").evaluate((form) => form.noValidate), false)
  await page.getByRole("button", { name: "Send" }).click()
  assert.equal(await submits("skip-validation"), 1, "noValidate must not block submit")
  assert.equal(await page.getByLabel("Email").evaluate((input) => input.validity.valueMissing), true)

  // Select participates in FormData through its named native control.
  assert.deepEqual(await page.locator("#plan").evaluate((form) => Object.fromEntries(new FormData(form).entries())), { plan: "starter" })
  await page.getByRole("combobox", { name: "Plan" }).click()
  await page.getByRole("option", { name: "Team" }).click()
  await page.getByRole("button", { name: "Choose" }).click()
  assert.equal(await submits("plan"), 1)
  assert.deepEqual(await data("plan"), { plan: "team" })

  // action, method and autoComplete are forwarded and navigate natively with no JS handler.
  assert.equal(await page.locator("#native-get").getAttribute("autocomplete"), "off")
  await page.getByLabel("Query").fill("hello world")
  await Promise.all([page.waitForURL(/form-native-target\.html\?q=hello\+world/), page.keyboard.press("Enter")])
  assert.match(await page.locator("main").textContent(), /Native form action target/)

  assert.deepEqual(errors, [], `unexpected browser errors: ${errors.join("; ")}`)
  console.log("form-native: all native form checks passed")
} finally {
  await browser.close()
  await server.close()
}
