import * as React from "react"

import { CrossFileChild } from "./component-prop-source-analysis-child-fixture"

type CrossFileWrapperProps = Pick<
  React.ComponentProps<typeof CrossFileChild>,
  "payload"
>

type CrossFileUnsafeWrapperProps = Pick<
  React.ComponentProps<typeof CrossFileChild>,
  "unsafePayload"
>

function CrossFileWrapper(props: CrossFileWrapperProps) {
  return <CrossFileChild {...props} />
}

function CrossFileUnsafeWrapper(props: CrossFileUnsafeWrapperProps) {
  return <CrossFileChild {...props} />
}

export { CrossFileUnsafeWrapper, CrossFileWrapper }
