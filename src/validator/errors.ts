import type { JsonValue, SourceLocation } from "./types"
import type { StructuredPropType } from "../contracts/components/types"

export type ValidationErrorCode =
  | "UNKNOWN_EXPORT"
  | "NON_AUTHORABLE_EXPORT"
  | "INVALID_PROP"
  | "INVALID_PROP_VALUE"
  | "CONDITIONAL_API_VIOLATION"
  | "INVALID_TOKEN"
  | "INVALID_DERIVED_TOKEN_RULE"
  | "INVALID_DERIVED_TOKEN_PARAMETER"
  | "SLOT_VIOLATION"
  | "CAPABILITY_VIOLATION"
  | "UNSUPPORTED_HARD_CONSTRAINT"
  | "UNRESOLVED_FACT"

export type ValidationTarget = Readonly<{
  kind: "node" | "prop" | "children" | "token"
  nodeId?: string
  propName?: string
  tokenId?: string
  location: SourceLocation
}>

export type ExpectedFact =
  | Readonly<{ kind: "authorable-export" }>
  | Readonly<{ kind: "known-prop" }>
  | Readonly<{ kind: "required-prop"; propName: string; type: StructuredPropType }>
  | Readonly<{ kind: "type"; type: StructuredPropType }>
  | Readonly<{ kind: "enum"; values: readonly string[] }>
  | Readonly<{ kind: "unavailable-prop" }>
  | Readonly<{ kind: "conditional-branch"; propName: string; values: readonly (string | number | boolean)[] }>
  | Readonly<{ kind: "slot-child"; min: number; max: number }>
  | Readonly<{ kind: "capability"; capability: string }>
  | Readonly<{ kind: "unsupported-hard-constraint"; constraint: string }>
  | Readonly<{ kind: "derived-token-rule"; ruleId: string }>
  | Readonly<{ kind: "derived-token-parameter"; ruleId: string; baseTokenId: string; type: StructuredPropType; minimum?: number }>
  | Readonly<{ kind: "token" }>
  | Readonly<{ kind: "event"; payload?: StructuredPropType }>
  | Readonly<{ kind: "resolved-value"; type: StructuredPropType }>

export type ReceivedValue = JsonValue | Readonly<{ kind: "callback"; signature?: string; parameterType?: StructuredPropType }> | Readonly<{ kind: "expression"; expression: string }>

export type FactualRepair = Readonly<
  | { operation: "remove-prop"; propName: string }
  | { operation: "replace-literal"; propName: string; value: JsonValue }
>

export type ValidationError = Readonly<{
  code: ValidationErrorCode
  message: string
  target: ValidationTarget
  expected?: ExpectedFact
  received?: ReceivedValue
  repair?: FactualRepair
}>

export type ValidationResult = Readonly<{
  ok: boolean
  errors: readonly ValidationError[]
}>
