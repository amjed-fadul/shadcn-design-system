// @ts-expect-error Deliberately nonexistent same-basename module used to verify full-path identity.
import { Button } from "@/other/button"

function PaginationLink({ isActive, ...props }: any) {
  return (
    <Button>
      <a data-slot="pagination-link" data-active={isActive} {...props} />
    </Button>
  )
}

export { PaginationLink }
