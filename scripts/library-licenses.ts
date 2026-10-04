import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const NOTICE_FILE = /^(LICEN[CS]E(?:\.|$)|COPYING|CopyrightNotice|NOTICE(?:\.|$))/i
// Licences whose terms require their text to travel with the code.
const TEXT_REQUIRED = /\b(MIT|ISC)\b|BSD/

// Upstream licence text for packages that declare a licence but publish no licence file.
function overrideNotice(root: string, name: string): string | undefined {
  const file = path.join(root, "scripts/license-overrides", name, "LICENSE")
  if (!existsSync(file)) return undefined
  const { source, gitBlob } = JSON.parse(readFileSync(path.join(path.dirname(file), "source.json"), "utf8")) as { source: string; gitBlob: string }
  return `Licence text supplied from ${source} (git blob ${gitBlob}); the published package omits it.\n\n${readFileSync(file, "utf8")}`
}

/** Preserve upstream notices for the code and CSS/font inputs we redistribute. */
export function libraryLicenseNotices(root: string, moduleIds: readonly string[]): string {
  const directories = new Set<string>()
  for (const id of moduleIds) {
    const marker = "/node_modules/"
    const offset = id.lastIndexOf(marker)
    if (offset < 0) continue
    const segments = id.slice(offset + marker.length).split("/")
    const name = segments.slice(0, segments[0].startsWith("@") ? 2 : 1).join("/")
    directories.add(path.join(id.slice(0, offset).replace(/^\0/, ""), "node_modules", name))
  }
  for (const name of ["tailwindcss", "tw-animate-css", "@fontsource-variable/geist"]) {
    directories.add(path.join(root, "node_modules", name))
  }
  // Vendored upstream files keep their package's original notice (Release 011: the shadcn stylesheet).
  const vendored = ["src/vendor/shadcn/vendored.json"].map((record) => {
    const { package: metadata, files } = JSON.parse(readFileSync(path.join(root, record), "utf8")) as {
      package: { name: string; version: string; license: string; author?: unknown; repository?: unknown }
      files: Array<{ path: string }>
    }
    const licenses = files.map((file) => file.path).filter((file) => /^(LICEN[CS]E(?:\.|$)|COPYING|CopyrightNotice)/i.test(path.basename(file))).sort()
    if (!licenses.length || !metadata.license) throw new Error(`Vendored source has no license notice: ${metadata.name}`)
    const attribution = JSON.stringify({ license: metadata.license, author: metadata.author, repository: metadata.repository }, null, 2)
    return { name: `${metadata.name}@${metadata.version}`, text: [attribution, ...licenses.map((file) => readFileSync(path.join(root, file), "utf8"))].join("\n\n") }
  })
  const notices = [...vendored, ...[...directories].map((directory) => {
    const metadata = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"))
    const entries = readdirSync(directory)
    const files = entries.filter((name) => NOTICE_FILE.test(name)).sort()
    const override = files.length ? undefined : overrideNotice(root, metadata.name)
    if (!files.length && !override) {
      // A permissive licence is only honoured if its text ships, so a package that declares one
      // without publishing it needs an upstream override in scripts/license-overrides.
      if (TEXT_REQUIRED.test(String(metadata.license))) throw new Error(`Bundled dependency ${metadata.name} declares ${metadata.license} but ships no licence text; add scripts/license-overrides/${metadata.name}/LICENSE`)
      // Otherwise preserve its supplied metadata and README instead of silently dropping the notice.
      files.push(...entries.filter((name) => /^readme(?:\.|$)/i.test(name)))
    }
    if ((!files.length && !override) || !metadata.license) throw new Error(`Bundled dependency has no license notice: ${metadata.name}`)
    const attribution = JSON.stringify({ license: metadata.license, author: metadata.author, repository: metadata.repository }, null, 2)
    const bodies = override ? [override] : files.map((file) => readFileSync(path.join(directory, file), "utf8"))
    return { name: `${metadata.name}@${metadata.version}`, text: [attribution, ...bodies].join("\n\n") }
  })].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  return notices.map(({ name, text }) => `${name}\n${"=".repeat(name.length)}\n${text}`).join("\n\n")
}
