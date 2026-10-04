import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { libraryLicenseNotices } from "../scripts/library-licenses"

const root = path.resolve(import.meta.dirname, "..")
const temporary: string[] = []
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }) })

// A bundled module id inside a throwaway package, so each case controls exactly what the package ships.
function fakePackage(name: string, license: string, files: Record<string, string>): string {
  const base = mkdtempSync(path.join(tmpdir(), "library-licenses-")); temporary.push(base)
  const directory = path.join(base, "node_modules", name)
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name, version: "1.0.0", license }))
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(directory, file), text)
  return path.join(directory, "index.js")
}

describe("libraryLicenseNotices", () => {
  test("ships NOTICE files alongside licence files", () => {
    const notices = libraryLicenseNotices(root, [fakePackage("with-notice", "MIT", { LICENSE: "MIT licence body", NOTICE: "Portions derived from Lodash" })])
    expect(notices).toContain("MIT licence body")
    expect(notices).toContain("Portions derived from Lodash")
  })

  test("fails when a package declaring a permissive licence ships no licence text", () => {
    for (const license of ["MIT", "ISC", "BSD-3-Clause", "0BSD"]) {
      expect(() => libraryLicenseNotices(root, [fakePackage(`no-text-${license.toLowerCase()}`, license, { "README.md": "readme only" })])).toThrow(/ships no licence text/)
    }
  })

  test("supplies react-remove-scroll-bar's upstream MIT text, which its package omits", () => {
    const notices = libraryLicenseNotices(root, [path.join(root, "node_modules/react-remove-scroll-bar/dist/es2015/index.js")])
    const entry = notices.slice(notices.indexOf("react-remove-scroll-bar@"))
    expect(entry).toContain("Copyright (c) 2025 Anton Korzunov")
    expect(entry).toContain("Permission is hereby granted, free of charge")
  })

  test("ships es-toolkit's NOTICE (its Lodash notice)", () => {
    const notices = libraryLicenseNotices(root, [path.join(root, "node_modules/es-toolkit/dist/index.mjs")])
    expect(notices.slice(notices.indexOf("es-toolkit@"))).toMatch(/lodash/i)
  })
})
