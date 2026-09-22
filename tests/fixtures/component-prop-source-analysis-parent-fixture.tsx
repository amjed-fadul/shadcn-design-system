import * as React from "react"

import { CrossFileChild } from "./component-prop-source-analysis-child-fixture"

type CrossFileWrapperProps = Pick<
  React.ComponentProps<typeof CrossFileChild>,
  "payload"
>

function CrossFileWrapper(props: CrossFileWrapperProps) {
  return <CrossFileChild {...props} />
}

export { CrossFileWrapper }
