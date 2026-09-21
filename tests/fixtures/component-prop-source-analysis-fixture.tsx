import * as React from "react"

function AnyPropsFixture(props: any) {
  return <div {...props} />
}

export { AnyPropsFixture }
