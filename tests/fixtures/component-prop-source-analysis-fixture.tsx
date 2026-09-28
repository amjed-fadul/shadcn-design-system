import * as React from "react"
import type { VariantProps } from "class-variance-authority"

function AnyPropsFixture(props: any) {
  return <div {...props} />
}

function UnknownPropsFixture(props: unknown) {
  return <div>{String(props)}</div>
}

function PickAnyPropsFixture(props: Pick<any, "foo">) {
  return <div>{String(props.foo)}</div>
}

function VariantAnyPropsFixture(props: VariantProps<any>) {
  return <div>{String(props)}</div>
}

function CollisionFixture({ collision, ...props }: React.ComponentProps<"div"> & { collision?: string }) {
  return <div data-collision={collision} {...props} />
}

export { AnyPropsFixture, CollisionFixture, PickAnyPropsFixture, UnknownPropsFixture, VariantAnyPropsFixture }
