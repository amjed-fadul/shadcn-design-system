import * as React from "react"

function CrossFileChild({
  payload,
  ...props
}: React.ComponentProps<"div"> & {
  payload?: Promise<string>
  unsafePayload?: any
}) {
  return <div data-payload={String(payload)} {...props} />
}

export { CrossFileChild }
