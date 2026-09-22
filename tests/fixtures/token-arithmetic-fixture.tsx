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
