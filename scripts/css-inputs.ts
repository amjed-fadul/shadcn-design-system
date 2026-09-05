import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/** Resolve the static CSS/font chain; actual build reads separately check coverage. */
export function cssImplementationInputs(root: string, entry = "src/index.css"): string[] {
  const files = new Set<string>()
  const add = (file: string) => {
    file = path.relative(root, path.resolve(root, file)).split(path.sep).join("/")
    if (file.startsWith("../") || !existsSync(path.join(root, file))) throw new Error(`CSS_INPUT_UNRESOLVED: ${file}`)
    if (files.has(file)) return
    files.add(file)
    if (!file.endsWith(".css")) return
    const css = readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
    const resolve = (specifier: string) => {
      if (specifier.startsWith("data:")) return
      if (/^(?:[a-z]+:|\/)/i.test(specifier)) throw new Error(`CSS_INPUT_NOT_LOCAL: ${specifier}`)
      specifier = specifier.split(/[?#]/)[0]
      if (specifier.startsWith(".")) return add(path.join(path.dirname(file), specifier))
      const segments = specifier.split("/")
      const packageName = segments.splice(0, specifier.startsWith("@") ? 2 : 1).join("/")
      const packagePath = `node_modules/${packageName}`
      const metadataPath = `${packagePath}/package.json`
      files.add(metadataPath)
      const metadata = JSON.parse(readFileSync(path.join(root, metadataPath), "utf8"))
      const key = segments.length ? `./${segments.join("/")}` : "."
      const exported = metadata.exports?.[key]
      const target = typeof exported === "string" ? exported : exported?.style ?? exported?.default ?? (key === "." ? metadata.style ?? metadata.main : segments.join("/"))
      if (typeof target !== "string" || !target.endsWith(".css")) throw new Error(`CSS_EXPORT_UNRESOLVED: ${specifier}`)
      add(`${packagePath}/${target}`)
    }
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/g)) resolve(match[1])
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
      const specifier = match[1]
      if (specifier.startsWith("data:")) continue
      if (/^(?:[a-z]+:|\/)/i.test(specifier)) throw new Error(`CSS_INPUT_NOT_LOCAL: ${specifier}`)
      add(path.join(path.dirname(file), specifier.split(/[?#]/)[0]))
    }
  }
  add(entry)
  return [...files].sort()
}
