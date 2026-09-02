import tokenContract from "../../../contracts/tokens/token-contract.json"
import { createTokenSourceAnalyzer, type TokenCoverageFinding } from "./token-source-analysis"

const direct = new Map<string, string>()
for (const [utility, token] of [
  ["background", "color.background"], ["foreground", "color.foreground"], ["card", "color.card"], ["card-foreground", "color.card-foreground"],
  ["popover", "color.popover"], ["popover-foreground", "color.popover-foreground"], ["primary", "color.primary"], ["primary-foreground", "color.primary-foreground"],
  ["secondary", "color.secondary"], ["secondary-foreground", "color.secondary-foreground"], ["muted", "color.muted"], ["muted-foreground", "color.muted-foreground"],
  ["accent", "color.accent"], ["accent-foreground", "color.accent-foreground"], ["destructive", "color.destructive"], ["border", "color.border"], ["input", "color.input"], ["ring", "color.ring"],
  ["sidebar", "color.sidebar"], ["sidebar-foreground", "color.sidebar-foreground"], ["sidebar-primary", "color.sidebar-primary"], ["sidebar-primary-foreground", "color.sidebar-primary-foreground"], ["sidebar-accent", "color.sidebar-accent"], ["sidebar-accent-foreground", "color.sidebar-accent-foreground"], ["sidebar-border", "color.sidebar-border"], ["sidebar-ring", "color.sidebar-ring"],
] as const) for (const prefix of ["bg", "text", "border", "ring", "outline", "decoration", "fill", "stroke"]) direct.set(`${prefix}-${utility}`, token)
for (const [utility, token] of [["rounded-sm", "radius.sm"], ["rounded-md", "radius.md"], ["rounded-lg", "radius.lg"], ["rounded-xl", "radius.xl"], ["shadow-sm", "shadow.sm"], ["shadow-md", "shadow.md"], ["shadow-lg", "shadow.lg"], ["tracking-widest", "letter-spacing.widest"], ["font-heading", "font.heading"], ["font-sans", "font.sans"], ["text-xs", "font-size.xs"], ["text-sm", "font-size.sm"], ["text-base", "font-size.base"], ["text-lg", "font-size.lg"], ["font-medium", "font-weight.medium"], ["font-normal", "font-weight.normal"], ["font-semibold", "font-weight.semibold"]] as const) direct.set(utility, token)

const approvedTokenIds = new Set(tokenContract.tokens.map((token) => token.id))
const contractedNamespaces = new Set(tokenContract.coverage.contracted)
const tokenCategory = new Map(tokenContract.tokens.map((token) => [token.id, token.category]))
const spacingUtility = /^(?:size|h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-([0-9]+(?:\.[0-9]+)?)$/
const analyzer = createTokenSourceAnalyzer({
  classMergeFunctionNames: ["cn"],
  recipeFunctionNames: ["cva"],
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
  },
  resolveUtility: (utility) => {
    const tokenId = direct.get(utility)
    if (tokenId && approvedTokenIds.has(tokenId)) return { tokenId }
    const spacing = utility.match(spacingUtility)
    return spacing ? { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: Number(spacing[1]) } } : undefined
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

const implementationUtilities = new Set(["align-middle", "animate-pulse", "bg-clip-padding", "flex", "flex-col", "flex-row", "grid", "group/card", "group/badge", "group/button", "inline-flex", "items-center", "justify-center", "justify-self-end", "overflow-auto", "overflow-hidden", "outline-none", "pointer-events-none", "relative", "select-none", "self-start", "shrink-0", "table", "transition-all", "transition-colors", "underline", "underline-offset-4", "whitespace-nowrap", "w-fit", "w-full", "h-full", "text-left", "text-center", "text-right", "text-justify", "text-start", "text-end", "border-transparent", "bg-transparent"])
const notContractedUtilities = new Set(["border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-0", "border-2", "border-4", "border-8", "ring-3", "ring-0", "ring-2"])
const normalizedUtility = (utility: string) => utility.split(":").at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
function contractedNamespaceFor(utility: string): string | undefined {
  if (/^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(utility)) return "font-size"
  if (/^(?:bg|text|border|ring|outline|decoration|fill|stroke)-/.test(utility)) return "color"
  if (/^rounded-/.test(utility)) return "radius"
  if (/^font-/.test(utility)) return /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(utility) ? "font-weight" : "font-family"
  if (/^leading-/.test(utility)) return "line-height"; if (/^tracking-/.test(utility)) return "letter-spacing"; if (/^shadow-/.test(utility)) return "shadow"; if (spacingUtility.test(utility)) return "spacing"
}
const rawColor = (utility: string) => /^(?:bg|text|border|ring|outline|decoration|fill|stroke)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?$/.test(utility)
const recognizedNoToken = (utility: string, namespace: string | undefined) => /-\[[^\]]+\]$/.test(utility) || /-(?:inherit|initial|unset|revert|revert-layer)$/.test(utility) || (namespace === "color" && /-current$/.test(utility)) || utility === "leading-none" || utility === "rounded-full" || utility === "shadow-none"

/** Canonical-only coverage vocabulary layered over the configurable source analyzer. */
export function auditComponentTokenCoverage(sourcePath: string): TokenCoverageFinding[] {
  const findings: TokenCoverageFinding[] = []
  for (const source of analyzeComponentTokenSource(sourcePath).resolved) for (const rawUtility of source.classNames.split(/\s+/).filter(Boolean)) {
    const utility = normalizedUtility(rawUtility); const tokenId = direct.get(utility); const namespace = contractedNamespaceFor(utility)
    if (tokenId && approvedTokenIds.has(tokenId)) findings.push({ utility, classification: "resolved-approved-token", tokenId, namespace: tokenCategory.get(tokenId) })
    else if (spacingUtility.test(utility) && approvedTokenIds.has("spacing.unit")) findings.push({ utility, classification: "resolved-approved-token", tokenId: "spacing.unit", namespace: "spacing" })
    else if (rawColor(utility) || notContractedUtilities.has(utility) || /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility)) findings.push({ utility, classification: "known-not-contracted-namespace", namespace: rawColor(utility) || /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility) ? "primitive-color" : "border-width" })
    else if (recognizedNoToken(utility, namespace)) findings.push({ utility, classification: "recognized-no-approved-token", namespace })
    else if (implementationUtilities.has(utility) || utility.startsWith("data-") || utility.startsWith("has-") || utility.startsWith("in-data-")) findings.push({ utility, classification: "known-non-token-implementation" })
    else if (namespace && contractedNamespaces.has(namespace)) findings.push({ utility, classification: "suspicious-contracted-namespace", namespace })
    else findings.push({ utility, classification: "known-non-token-implementation" })
  }
  return findings.filter((finding, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(finding)) === index)
}
