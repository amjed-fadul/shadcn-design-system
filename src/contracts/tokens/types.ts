export type TokenMode = "light" | "dark"

export type TokenCategory =
  | "color"
  | "radius"
  | "font-family"
  | "font-size"
  | "font-weight"
  | "letter-spacing"
  | "line-height"
  | "spacing"
  | "shadow"

export type TokenSourceId = "canonical-theme" | "tailwind-theme"

export type TokenBinding = {
  cssVariable: `--${string}`
  tailwindThemeVariable?: `--${string}`
  tailwindExpression?: string
  companionVariables?: Record<string, `--${string}`>
}

export type LiteralTokenValue = {
  kind: "literal"
  value: string | number
}

export type ModeTokenValue = {
  kind: "modes"
  values: {
    light: string
    dark: string
  }
}

export type AliasTokenValue = {
  kind: "alias"
  tokenId: string
}

export type DerivedTokenValue = {
  kind: "derived"
  expression: string
  dependencies: string[]
}

export type TypographySizeTokenValue = {
  kind: "typography-size"
  fontSize: string
  lineHeight: string
}

export type TokenValue =
  | LiteralTokenValue
  | ModeTokenValue
  | AliasTokenValue
  | DerivedTokenValue
  | TypographySizeTokenValue

export type TokenDefinition = {
  id: string
  category: TokenCategory
  sourceId: TokenSourceId
  binding: TokenBinding
  value: TokenValue
}

export type DerivedTokenRule = {
  id: "spacing.multiplier"
  category: "spacing"
  baseTokenId: "spacing.unit"
  parameter: {
    name: "multiplier"
    type: "number"
  }
  expression: "calc(var(--spacing) * <multiplier>)"
  tailwindSyntax: "--spacing(<multiplier>)"
  producesTokenIds: false
}

export type TokenContract = {
  schemaVersion: 1
  id: "shadcn-radix-token-contract-003"
  status: "candidate" | "approved"
  baselineSnapshotId: "shadcn-radix-bootstrap-000"
  sourceBaselineCommit: string
  sourceProvenancePath: "provenance/token-contract-source.json"
  modes: ["light", "dark"]
  coverage: {
    contracted: TokenCategory[]
    representedElsewhere: Array<{
      namespace: string
      tokenIds: string[]
      reason: string
    }>
    notContracted: Array<{
      namespace: string
      reason: string
    }>
  }
  derivedRules: DerivedTokenRule[]
  tokens: TokenDefinition[]
}
