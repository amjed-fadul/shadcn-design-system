import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"

import tokenContract from "../../../contracts/tokens/token-contract.json"
import seedComponents from "../../../provenance/seed-components.json"
import { createTokenSourceAnalyzer, parseTailwindTokenUtility, type TokenCoverageFinding } from "./token-source-analysis"

const direct = new Map<string, string>()
for (const [utility, token] of [
  ["background", "color.background"], ["foreground", "color.foreground"], ["card", "color.card"], ["card-foreground", "color.card-foreground"],
  ["popover", "color.popover"], ["popover-foreground", "color.popover-foreground"], ["primary", "color.primary"], ["primary-foreground", "color.primary-foreground"],
  ["secondary", "color.secondary"], ["secondary-foreground", "color.secondary-foreground"], ["muted", "color.muted"], ["muted-foreground", "color.muted-foreground"],
  ["accent", "color.accent"], ["accent-foreground", "color.accent-foreground"], ["destructive", "color.destructive"],
  ["success", "color.success"], ["success-foreground", "color.success-foreground"], ["warning", "color.warning"], ["warning-foreground", "color.warning-foreground"], ["info", "color.info"], ["info-foreground", "color.info-foreground"],
  ["chart-1", "color.chart-1"], ["chart-2", "color.chart-2"], ["chart-3", "color.chart-3"], ["chart-4", "color.chart-4"], ["chart-5", "color.chart-5"], ["border", "color.border"], ["input", "color.input"], ["ring", "color.ring"],
  ["sidebar", "color.sidebar"], ["sidebar-foreground", "color.sidebar-foreground"], ["sidebar-primary", "color.sidebar-primary"], ["sidebar-primary-foreground", "color.sidebar-primary-foreground"], ["sidebar-accent", "color.sidebar-accent"], ["sidebar-accent-foreground", "color.sidebar-accent-foreground"], ["sidebar-border", "color.sidebar-border"], ["sidebar-ring", "color.sidebar-ring"],
] as const) for (const prefix of ["bg", "text", "border", "ring", "ring-offset", "outline", "decoration", "fill", "stroke"]) direct.set(`${prefix}-${utility}`, token)
for (const [utility, token] of [["rounded-sm", "radius.sm"], ["rounded-md", "radius.md"], ["rounded-lg", "radius.lg"], ["rounded-s-lg", "radius.lg"], ["rounded-e-lg", "radius.lg"], ["rounded-t-lg", "radius.lg"], ["rounded-b-lg", "radius.lg"], ["rounded-xl", "radius.xl"], ["rounded-full", "radius.full"], ["shadow-sm", "shadow.sm"], ["shadow-md", "shadow.md"], ["shadow-lg", "shadow.lg"], ["tracking-tight", "letter-spacing.tight"], ["tracking-widest", "letter-spacing.widest"], ["font-heading", "font.heading"], ["font-sans", "font.sans"], ["text-xs", "font-size.xs"], ["text-sm", "font-size.sm"], ["text-base", "font-size.base"], ["text-lg", "font-size.lg"], ["text-xl", "font-size.xl"], ["text-2xl", "font-size.2xl"], ["leading-relaxed", "line-height.relaxed"], ["leading-snug", "line-height.snug"], ["leading-normal", "line-height.normal"], ["leading-display", "line-height.display"], ["font-medium", "font-weight.medium"], ["font-normal", "font-weight.normal"], ["font-semibold", "font-weight.semibold"]] as const) direct.set(utility, token)

const approvedTokenIds = new Set(tokenContract.tokens.map((token) => token.id))
const contractedNamespaces = new Set(tokenContract.coverage.contracted)
const tokenCategory = new Map(tokenContract.tokens.map((token) => [token.id, token.category]))
const spacingUtility = /^(-?)(size|h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|ps|pe|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|ms|me|space-x|space-y|inset|inset-x|inset-y|inset-s|inset-e|top|right|bottom|left|start|end)-([0-9]+(?:\.[0-9]+)?)$/
const negativeSpacingNamespaces = new Set([
  "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me",
  "space-x", "space-y", "inset", "inset-x", "inset-y", "inset-s", "inset-e",
  "top", "right", "bottom", "left", "start", "end",
])
function spacingMultiplier(utility: string): number | undefined {
  const spacing = utility.match(spacingUtility)
  if (!spacing || (spacing[1] === "-" && !negativeSpacingNamespaces.has(spacing[2]))) return undefined
  return (spacing[1] === "-" ? -1 : 1) * Number(spacing[3])
}
const canonicalRecipeModules = new Map(Object.entries(seedComponents.components).map(([, component]) => {
  const canonicalPath = component.canonicalPath.replace(/\\/g, "/").replace(/\.[cm]?[jt]sx?$/, "")
  return [`@/${canonicalPath.replace(/^src\//, "")}`, component]
}))
function gitBlobSha(source: string): string {
  return createHash("sha1").update(`blob ${Buffer.byteLength(source)}\0${source}`).digest("hex")
}
function repositoryRootFor(sourcePath: string): string | undefined {
  let current = normalize(dirname(sourcePath))
  while (dirname(current) !== current) {
    if (current.endsWith(join("src", "components", "ui"))) return dirname(dirname(dirname(current)))
    current = dirname(current)
  }
}
const analyzer = createTokenSourceAnalyzer({
  classMergeFunctionNames: ["cn"],
  recipeFunctionNames: ["cva"],
  classifyCssVariable: (cssVariable) => /-(?:width|height|size|offset|inset)(?:-|$)/.test(cssVariable) ? "known-non-token" : undefined,
  recipeUnresolvedReasons: {
    dynamicConfiguration: "Unsupported dynamic CVA configuration.",
    configurationProperty: "Unsupported CVA configuration property.",
    dynamicVariants: "Unsupported dynamic CVA variants.",
    variantProperty: "Unsupported CVA variant property.",
    dynamicVariantValues: "Unsupported dynamic CVA variant values.",
    variantValueProperty: "Unsupported CVA variant value property.",
    dynamicCompoundVariants: "Unsupported dynamic CVA compound variants.",
    compoundVariant: "Unsupported dynamic CVA compound variant.",
    compoundVariantProperty: "Unsupported CVA compound variant property.",
    dynamicDefaultVariants: "Unsupported dynamic CVA defaults.",
    defaultVariantProperty: "Unsupported CVA default property.",
    defaultVariantValue: "Unsupported dynamic CVA default value.",
    dynamicInvocation: "Unsupported dynamic CVA invocation.",
    invocationProperty: "Unsupported CVA invocation property.",
    unknownVariant: "CVA invocation references an unknown variant.",
    unknownVariantValue: "CVA invocation references an unknown variant value.",
    importAuthority: "Imported CVA source is not approved.",
    importedExport: "Imported CVA export is not a static recipe.",
  },
  resolveImportedRecipe: ({ sourcePath, moduleSpecifier, importedName }) => {
    const component = canonicalRecipeModules.get(moduleSpecifier)
    const repositoryRoot = component && repositoryRootFor(sourcePath)
    if (!component || !repositoryRoot) return undefined
    const importedPath = join(repositoryRoot, component.canonicalPath)
    let source: string
    try { source = readFileSync(importedPath, "utf8") } catch { return undefined }
    if (gitBlobSha(source) !== component.canonicalBlobSha) return undefined
    return { sourcePath: importedPath, exportName: importedName }
  },
  resolveCssVariable: (cssVariable, multiplier) => cssVariable === "--spacing" && approvedTokenIds.has("spacing.unit")
    ? { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier } }
    : undefined,
  resolveDynamicCssVariable: (cssVariable) => cssVariable === "--spacing" && approvedTokenIds.has("spacing.unit")
    ? { tokenId: "spacing.unit" }
    : undefined,
  resolveUtility: (utility) => {
    const tokenId = direct.get(utility)
    if (tokenId && approvedTokenIds.has(tokenId)) return { tokenId }
    const multiplier = spacingMultiplier(utility)
    return multiplier !== undefined ? { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier } } : undefined
  },
})

export const {
  analyzeTailwindTokenDependencies,
  analyzeComponentTokenSource,
  analyzeComponentTokenSourceForExport,
  analyzeComponentTokenDependencies,
  analyzeComponentTokenDependenciesForExport,
  compareComponentTokenDependencies,
  compareComponentTokenDependenciesForExport,
} = analyzer

export type TokenCoverageClassification = "resolved-approved-token" | "known-non-token-implementation" | "known-not-contracted-namespace" | "recognized-no-approved-token" | "suspicious-contracted-namespace"
export type { TokenCoverageFinding }

const implementationUtilities = new Set(["align-middle", "animate-pulse", "bg-clip-padding", "flex", "flex-col", "flex-row", "grid", "group/card", "group/badge", "group/button", "inline-flex", "items-center", "justify-center", "justify-self-end", "overflow-auto", "overflow-hidden", "outline-none", "pointer-events-none", "relative", "select-none", "self-start", "shrink-0", "table", "text-balance", "transition-all", "transition-colors", "underline", "underline-offset-4", "whitespace-nowrap", "w-fit", "w-full", "h-full", "text-left", "text-center", "text-right", "text-justify", "text-start", "text-end", "border-transparent", "bg-transparent"])
const notContractedUtilities = new Set(["border", "border-t", "border-r", "border-b", "border-l", "border-s", "border-e", "border-x", "border-y", "border-0", "border-t-0", "border-r-0", "border-b-0", "border-l-0", "border-s-0", "border-e-0", "border-2", "border-4", "border-8", "ring-3", "ring-0", "ring-2"])
function contractedNamespaceFor(utility: string): string | undefined {
  if (/^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(utility)) return "font-size"
  if (/^(?:bg|text|border|ring|outline|decoration|fill|stroke)-/.test(utility)) return "color"
  if (/^rounded-/.test(utility)) return "radius"
  if (/^font-/.test(utility)) return /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(utility) ? "font-weight" : "font-family"
  if (/^leading-/.test(utility)) return "line-height"; if (/^tracking-/.test(utility)) return "letter-spacing"; if (/^shadow-/.test(utility)) return "shadow"; if (spacingMultiplier(utility) !== undefined) return "spacing"
}
const rawColor = (utility: string) => /^(?:bg|text|border|ring|outline|decoration|fill|stroke)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?$/.test(utility)
const recognizedNoToken = (utility: string, namespace: string | undefined) => /-\[[^\]]+\]$/.test(utility) || /-(?:inherit|initial|unset|revert|revert-layer)$/.test(utility) || (namespace === "color" && /-current$/.test(utility)) || utility === "leading-none" || utility === "rounded-none" || utility === "shadow-none"

/** Canonical-only coverage vocabulary layered over the configurable source analyzer. */
export function auditComponentTokenCoverage(sourcePath: string): TokenCoverageFinding[] {
  const findings: TokenCoverageFinding[] = []
  for (const source of analyzeComponentTokenSource(sourcePath).resolved) for (const rawUtility of source.classNames.split(/\s+/).filter(Boolean)) {
    const parsed = parseTailwindTokenUtility(rawUtility)
    if (!parsed) continue
    const utility = parsed.utility; const tokenId = direct.get(utility); const namespace = contractedNamespaceFor(utility)
    if (tokenId && approvedTokenIds.has(tokenId)) findings.push({ utility, classification: "resolved-approved-token", tokenId, namespace: tokenCategory.get(tokenId) })
    else if (spacingMultiplier(utility) !== undefined && approvedTokenIds.has("spacing.unit")) findings.push({ utility, classification: "resolved-approved-token", tokenId: "spacing.unit", namespace: "spacing" })
    else if ((utility === "ring-offset-0" || utility === "ring-offset-2")) findings.push({ utility, classification: "known-not-contracted-namespace", namespace: "ring-offset-width" })
    else if (utility === "ring-inset") findings.push({ utility, classification: "known-not-contracted-namespace", namespace: "ring-placement" })
    else if (/^border-(?:solid|dashed|dotted|double|hidden|none)$/.test(utility)) findings.push({ utility, classification: "known-not-contracted-namespace", namespace: "border-style" })
    else if (rawColor(utility) || notContractedUtilities.has(utility) || /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility)) findings.push({ utility, classification: "known-not-contracted-namespace", namespace: rawColor(utility) || /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility) ? "primitive-color" : "border-width" })
    else if (recognizedNoToken(utility, namespace)) findings.push({ utility, classification: "recognized-no-approved-token", namespace })
    else if (implementationUtilities.has(utility) || utility.startsWith("data-") || utility.startsWith("has-") || utility.startsWith("in-data-")) findings.push({ utility, classification: "known-non-token-implementation" })
    else if (namespace && contractedNamespaces.has(namespace)) findings.push({ utility, classification: "suspicious-contracted-namespace", namespace })
    else findings.push({ utility, classification: "known-non-token-implementation" })
  }
  return findings.filter((finding, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(finding)) === index)
}
