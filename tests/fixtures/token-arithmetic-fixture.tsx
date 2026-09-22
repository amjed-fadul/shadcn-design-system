const STATIC_FRACTION = 0.25
const SPACING_VARIABLE = "--spacing"

function ExactArithmeticFixture() {
  return (
    <div
      className="data-[size=sm]:gap-[calc(var(--spacing)*2.5)]"
      style={{
        gap: "calc(var(--spacing) * 0)",
        padding: "calc(var(--spacing) * 2)",
        margin: `calc(var(--spacing) * -1.5)`,
        inset: `calc(var(--spacing) * ${STATIC_FRACTION})`,
        top: `calc(var(${SPACING_VARIABLE}) * ${2})`,
      }}
    />
  )
}

function UnsupportedOperatorFixture() {
  return <div style={{ gap: "calc(var(--spacing) + 2)" }} />
}

function MultipleVariablesFixture() {
  return <div style={{ gap: "calc(var(--spacing) * var(--spacing))" }} />
}

function UnknownVariableFixture() {
  return <div style={{ gap: "calc(var(--unknown-spacing) * 2)" }} />
}

function NonnumericOperandFixture() {
  return <div style={{ gap: "calc(var(--spacing) * two)" }} />
}

function DynamicOperandFixture({ multiplier }: { multiplier: number }) {
  return <div style={{ gap: `calc(var(--spacing) * ${multiplier})` }} />
}

function AmbiguousInterpolationFixture() {
  return <div style={{ gap: `calc(var(--spacing) * 1${STATIC_FRACTION})` }} />
}

function DivisionByZeroFixture() {
  return <div style={{ gap: "calc(var(--spacing) / 0)" }} />
}

function ReversedShapeFixture() {
  return <div style={{ gap: "calc(2 * var(--spacing))" }} />
}

export {
  AmbiguousInterpolationFixture,
  DivisionByZeroFixture,
  DynamicOperandFixture,
  ExactArithmeticFixture,
  MultipleVariablesFixture,
  NonnumericOperandFixture,
  ReversedShapeFixture,
  UnknownVariableFixture,
  UnsupportedOperatorFixture,
}

export function ReassignedBindingFixture() {
  let multiplier = 2
  multiplier = 3
  return <div style={{ gap: `calc(var(--spacing) * ${multiplier})` }} />
}

export function UpdatedBindingFixture() {
  let multiplier = 2
  multiplier++
  return <div style={{ gap: `calc(var(--spacing) * ${multiplier})` }} />
}

export function StaleBindingFixture() {
  let multiplier = 2
  const view = <div style={{ gap: `calc(var(--spacing) * ${multiplier})` }} />
  multiplier = 3
  return view
}

const SHADOW_MULTIPLIER = 2

export function ShadowedBindingFixture() {
  const SHADOW_MULTIPLIER = 3
  return <div style={{ gap: `calc(var(--spacing) * ${SHADOW_MULTIPLIER})` }} />
}

export function OverflowNumericFixture() {
  return <div style={{ gap: "calc(var(--spacing) * 9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999)" }} />
}

export function ScientificNumericFixture() {
  return <div style={{ gap: "calc(var(--spacing) * 1e3)" }} />
}

export function NaNNumericFixture() {
  return <div style={{ gap: "calc(var(--spacing) * NaN)" }} />
}

export function InfinityNumericFixture() {
  return <div style={{ gap: "calc(var(--spacing) * Infinity)" }} />
}

export function NegativeZeroFixture() {
  return <div style={{ gap: "calc(var(--spacing) * -0)" }} />
}

function OutOfScopeOwner() {
  const OUT_OF_SCOPE_MULTIPLIER = 7
  return OUT_OF_SCOPE_MULTIPLIER
}

export function OutOfScopeBindingFixture(OUT_OF_SCOPE_MULTIPLIER: number) {
  return <div style={{ gap: `calc(var(--spacing) * ${OUT_OF_SCOPE_MULTIPLIER})` }} />
}

const NESTED_SHADOW_MULTIPLIER = 5

export function NestedShadowBindingFixture() {
  const NESTED_SHADOW_MULTIPLIER = 6
  return <div style={{ gap: `calc(var(--spacing) * ${NESTED_SHADOW_MULTIPLIER})` }} />
}

function SameNameOwnerOne() {
  const SAME_NAME_MULTIPLIER = 8
  return <div style={{ gap: `calc(var(--spacing) * ${SAME_NAME_MULTIPLIER})` }} />
}

export function SameNameOwnerTwo() {
  const SAME_NAME_MULTIPLIER = 9
  return <div style={{ gap: `calc(var(--spacing) * ${SAME_NAME_MULTIPLIER})` }} />
}

void OutOfScopeOwner
void SameNameOwnerOne
