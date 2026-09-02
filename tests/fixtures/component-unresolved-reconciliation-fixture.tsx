type FixtureProps = {
  props: Record<string, unknown>
  className: string
}

export function UnresolvedFixture({ props, className }: FixtureProps) {
  return <div {...props} className={`bg-${className}`} />
}
