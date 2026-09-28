import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, runnerImport, type Plugin, type UserConfig } from "vite"
import type * as PackageData from "./scripts/library-data"
import { libraryLicenseNotices } from "./scripts/library-licenses"

const root = path.dirname(fileURLToPath(import.meta.url))
const packageBuildIsolation = { server: { fs: { allow: [root] } }, css: { postcss: { plugins: [] } } }
const isReact = (id: string) => /^(react|react-dom)(\/|$)/.test(id)
const virtualId = "virtual:shadcn-package-data"

export default defineConfig(async (): Promise<UserConfig> => {
  const { module: data } = await runnerImport<typeof PackageData>(path.join(root, "scripts/library-data.ts"), { configFile: false, ...packageBuildIsolation })
  const sourcePaths = data.componentContracts.families.map((family) => family.source.canonicalPath)
  const utilityPrefixes: Record<string, string> = {
    "font-size": "text", "font-weight": "font", "letter-spacing": "tracking",
    "line-height": "leading",
  }
  // Keep every contracted Tailwind binding available, including tokens not
  // currently used by a component. Candidates reuse the pinned theme values.
  const tokenCandidates = data.tokenContract.tokens.filter((token) => token.sourceId === "tailwind-theme").map((token) => {
    if (token.id === "spacing.unit") return "p-1"
    // Named shadow utilities inline values, so retain their contracted
    // custom properties through explicit variable references instead.
    if (token.category === "shadow") return `[box-shadow:var(${token.binding.cssVariable})]`
    const prefix = utilityPrefixes[token.category]
    if (!prefix) throw new Error(`No package CSS candidate for contracted token: ${token.id}`)
    return `${prefix}-${token.id.split(".")[1]}`
  })
  const tokenSource = JSON.parse(readFileSync(path.join(root, "provenance/token-contract-source.json"), "utf8"))
  const cssPath = path.join(root, "src/index.css")
  const css = readFileSync(cssPath)
  const cssBlob = createHash("sha1").update(`blob ${css.byteLength}\0`).update(css).digest("hex")
  if (cssBlob !== tokenSource.sources.canonicalTheme.blobSha) throw new Error("Canonical theme differs from approved provenance")
  for (const [file, expected] of [
    [tokenSource.sources.tailwindTheme.path, tokenSource.sources.tailwindTheme.themeCssSha256],
    [tokenSource.sources.tailwindTheme.spacingFunction.path, tokenSource.sources.tailwindTheme.spacingFunction.sha256],
  ]) {
    if (createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex") !== expected) throw new Error(`Tailwind source differs from approved provenance: ${file}`)
  }

  const packageBoundary: Plugin = {
    name: "approved-package-boundary",
    enforce: "pre",
    resolveId(id) { if (id === virtualId) return `\0${virtualId}` },
    load(id) {
      if (id !== `\0${virtualId}`) return
      return ["componentContracts", "tokenContract", "executableRelease"].map((key) =>
        `export const ${key} = JSON.parse(${JSON.stringify(JSON.stringify(data[key as keyof typeof data]))});`
      ).join("\n")
    },
    transform(code, id) {
      if (id === path.join(root, "src/package/index.ts")) return `import "../index.css";\n${code}`
      if (id !== cssPath) return
      // Transform only the build input. Approved CSS bytes and values stay intact.
      // Static emission preserves existing token bindings unused by components.
      return code.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace("@theme inline {", "@theme inline static {")
        + sourcePaths.map((file) => `\n@source ${JSON.stringify(`./${path.relative(path.join(root, "src"), path.join(root, file))}`)};`).join("")
        + `\n@source inline(${JSON.stringify(tokenCandidates.join(" "))});`
    },
    generateBundle(_options, bundle) {
      const bundledModules = new Set<string>()
      for (const entry of Object.values(bundle)) {
        if (entry.type !== "chunk") continue
        for (const id of Object.keys(entry.modules)) {
          if (/[/\\]node_modules[/\\](react|react-dom)[/\\]/.test(id)) throw new Error(`React runtime was bundled: ${id}`)
          if (entry.modules[id].renderedLength > 0) bundledModules.add(id)
        }
        for (const id of [...entry.imports, ...entry.dynamicImports]) {
          if (!(id in bundle) && !isReact(id)) throw new Error(`Unexpected library runtime external: ${id}`)
        }
      }
      this.emitFile({ type: "asset", fileName: "THIRD_PARTY_LICENSES.txt", source: libraryLicenseNotices(root, [...bundledModules]) })
    },
  }

  return {
    plugins: [packageBoundary, react(), tailwindcss()],
    ...packageBuildIsolation,
    resolve: { alias: { "@": path.join(root, "src") } },
    build: {
      outDir: "dist-library",
      emptyOutDir: true,
      copyPublicDir: false,
      sourcemap: false,
      cssCodeSplit: false,
      lib: {
        entry: { index: path.join(root, "src/package/index.ts"), release: path.join(root, "src/package/release.ts") },
        formats: ["es"],
        fileName: (_format, name) => `${name}.js`,
        cssFileName: "styles",
      },
      rollupOptions: {
        external: isReact,
        onwarn(warning, warn) {
          // Client directives describe React framework boundaries; this package
          // targets a client-side consumer, not React Server Components.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes('"use client"')) return
          warn(warning)
        },
      },
    },
  }
})
