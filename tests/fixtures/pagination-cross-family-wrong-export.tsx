// @ts-expect-error Deliberately invalid export alias used to verify fail-closed source identity.
import { Avatar as Button } from "@/components/ui/button"

function PaginationLink({ isActive, ...props }: any) {
  return (
    <Button>
      <a data-slot="pagination-link" data-active={isActive} {...props} />
    </Button>
  )
}

export { PaginationLink }
