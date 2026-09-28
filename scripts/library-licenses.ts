import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

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
  for (const name of ["tailwindcss", "shadcn", "tw-animate-css", "@fontsource-variable/geist"]) {
    directories.add(path.join(root, "node_modules", name))
  }
  const notices = [...directories].map((directory) => {
    const metadata = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"))
    const entries = readdirSync(directory)
    const files = entries.filter((name) => /^(LICEN[CS]E(?:\.|$)|COPYING|CopyrightNotice)/i.test(name)).sort()
    // Some published packages omit a standalone license. Preserve their
    // supplied metadata and README instead of silently dropping the notice.
    if (!files.length) files.push(...entries.filter((name) => /^readme(?:\.|$)/i.test(name)))
    if (!files.length || !metadata.license) throw new Error(`Bundled dependency has no license notice: ${metadata.name}`)
    const attribution = JSON.stringify({ license: metadata.license, author: metadata.author, repository: metadata.repository }, null, 2)
    return { name: `${metadata.name}@${metadata.version}`, text: [attribution, ...files.map((file) => readFileSync(path.join(directory, file), "utf8"))].join("\n\n") }
  }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  return notices.map(({ name, text }) => `${name}\n${"=".repeat(name.length)}\n${text}`).join("\n\n")
}
