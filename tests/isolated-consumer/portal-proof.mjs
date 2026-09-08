// Exact-tarball browser proof. The consumer installs and imports only package exports.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync, spawn } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [tarball, manifestPath, manifestSha256] = process.argv.slice(2)
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const manifestBytes = readFileSync(manifestPath)
assert.equal(sha(manifestBytes), manifestSha256)
const manifest = JSON.parse(manifestBytes)
assert.equal(sha(readFileSync(tarball)), manifest.tarball.sha256)
assert.equal(manifest.release.id, "shadcn-radix-release-003")
assert.equal(process.versions.node, "22.18.0")
assert.equal(execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(), "10.9.3")
const consumer = mkdtempSync(path.join(tmpdir(), "release003-portal-consumer-"))
writeFileSync(path.join(consumer, "package.json"), JSON.stringify({
  private: true, type: "module", dependencies: {
    "@adc/shadcn-design-system": `file:${path.resolve(tarball)}`,
    react: "18.3.1", "react-dom": "18.3.1", vite: "7.3.6", playwright: "1.58.2",
  },
}, null, 2))
execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: consumer, stdio: "pipe", timeout: 180000 })
writeFileSync(path.join(consumer, "index.html"), '<!doctype html><html lang="en"><body><main id="app"></main><section id="page-a"></section><section id="page-b"></section><script type="module" src="/app.js"></script></body></html>')
writeFileSync(path.join(consumer, "app.js"), `
import React from "react";
import {createRoot} from "react-dom/client";
import {Button,Label,Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription,TooltipProvider,Tooltip,TooltipTrigger,TooltipContent} from "@adc/shadcn-design-system";
import "@adc/shadcn-design-system/styles.css";
const h=React.createElement, params=new URLSearchParams(location.search);
const portalContainer=params.get("placement")==="contained"?document.querySelector("#page-a"):undefined;
function App(){
 const [value,setValue]=React.useState("one");
 const kind=params.get("kind");
 if(kind==="dialog") return h(Dialog,null,h(DialogTrigger,{asChild:true},h(Button,{id:"trigger"},"Open dialog")),h(DialogContent,{portalContainer},h(DialogTitle,null,"Page dialog"),h(DialogDescription,null,"Contained package content")));
 if(kind==="select") return h(React.Fragment,null,h(Label,{id:"view-label",htmlFor:"trigger"},"Choose view"),h(Select,{value,onValueChange:setValue},h(SelectTrigger,{id:"trigger","aria-label":"View","aria-labelledby":"view-label"},h(SelectValue)),h(SelectContent,{portalContainer},h(SelectItem,{value:"one"},"One"),h(SelectItem,{value:"two"},"Two"))),h("output",{id:"value"},value));
 if(kind==="dropdown-menu") return h(React.Fragment,null,h(DropdownMenu,null,h(DropdownMenuTrigger,{asChild:true},h(Button,{id:"trigger"},"Open menu")),h(DropdownMenuContent,{portalContainer},h(DropdownMenuItem,{onSelect:()=>setValue("picked")},"Choose item"))),h("output",{id:"value"},value));
 if(kind==="sheet") return h(Sheet,null,h(SheetTrigger,{asChild:true},h(Button,{id:"trigger"},"Open sheet")),h(SheetContent,{portalContainer},h(SheetTitle,null,"Page sheet"),h(SheetDescription,null,"Contained package sheet")));
 return h(TooltipProvider,null,h(Tooltip,null,h(TooltipTrigger,{asChild:true},h(Button,{id:"trigger"},"Show tooltip")),h(TooltipContent,{portalContainer},"Contained package tooltip")));
}
createRoot(document.querySelector("#app")).render(h(App));
`)
const { chromium } = await import(pathToFileURL(path.join(consumer, "node_modules/playwright/index.mjs")).href)
const server = spawn(process.execPath, [path.join(consumer, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4192", "--strictPort"], { cwd: consumer, stdio: "pipe" })
let serverOutput = ""
server.stdout.on("data", chunk => { serverOutput += chunk })
server.stderr.on("data", chunk => { serverOutput += chunk })
const browser = await chromium.launch({ headless: true })
const errors = [], cases = []
try {
  for (let attempt=0; attempt<100; attempt++) {
    if (serverOutput.includes("127.0.0.1:4192")) break
    if (server.exitCode !== null) throw new Error(serverOutput)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  for (const kind of ["dialog", "select", "dropdown-menu", "sheet", "tooltip"]) for (const placement of ["contained", "default"]) {
    const page = await browser.newPage()
    page.on("pageerror", error => errors.push(String(error)))
    page.on("console", message => { if (message.type()==="error") errors.push(message.text()) })
    await page.goto(`http://127.0.0.1:4192/?kind=${kind}&placement=${placement}`)
    if(kind==="select") assert.equal(await page.getByRole("combobox",{name:"Choose view"}).count(),1)
    if(kind==="tooltip") await page.locator("#trigger").hover()
    else await page.locator("#trigger").click()
    const role = ({dialog:"dialog",select:"listbox","dropdown-menu":"menu",sheet:"dialog",tooltip:"tooltip"})[kind]
    await page.getByRole(role).waitFor({ state: "visible" })
    const result = await page.evaluate(({role,placement,kind}) => {
      const content=document.querySelector(`[role="${role}"]`), host=document.querySelector("#page-a");
      return {
        contentExists:!!content,
        correctHost:placement==="contained"?host.contains(content):!host.contains(content)&&!document.querySelector("#app").contains(content),
        neighboringPageEmpty:!document.querySelector("#page-b").children.length,
        overlayCorrect:!["dialog","sheet"].includes(kind) || (placement==="contained"?host.contains(document.querySelector(`[data-slot="${kind}-overlay"]`)):!host.contains(document.querySelector(`[data-slot="${kind}-overlay"]`))),
        leakedProp:!!document.querySelector("[portalcontainer]"),
      }
    }, {role,placement,kind})
    assert.deepEqual(result,{contentExists:true,correctHost:true,neighboringPageEmpty:true,overlayCorrect:true,leakedProp:false})
    if(kind==="select") {
      await page.getByRole("option",{name:"Two",exact:true}).click()
      assert.equal(await page.locator("#value").textContent(),"two")
    } else if(kind==="dropdown-menu") {
      await page.getByRole("menuitem",{name:"Choose item",exact:true}).click()
      assert.equal(await page.locator("#value").textContent(),"picked")
      await page.getByRole("menu").waitFor({state:"hidden"})
    } else if(kind==="dialog" || kind==="sheet") {
      await page.keyboard.press("Escape")
      await page.getByRole("dialog").waitFor({state:"hidden"})
      await page.waitForFunction(()=>document.activeElement?.id==="trigger")
      assert.equal(await page.evaluate(()=>document.activeElement?.id),"trigger")
    }
    cases.push({kind,placement,...result,interaction:true})
    await page.close()
  }
  assert.deepEqual(errors,[])
  assert.equal(sha(readFileSync(tarball)),manifest.tarball.sha256)
  const evidence={success:true,consumer,releaseId:manifest.release.id,tarballSha256:manifest.tarball.sha256,manifestSha256,cases,errors}
  writeFileSync(path.join(consumer,"portal-evidence.json"),JSON.stringify(evidence,null,2))
  console.log(JSON.stringify(evidence,null,2))
} finally {
  await browser.close()
  server.kill()
}
