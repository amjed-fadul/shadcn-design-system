import type { ComponentProps } from "react"

import { Chart } from "../components/ui/chart"

export { Chart }
/** The closed Chart props: data, keys and named options only. */
export type ChartProps = ComponentProps<typeof Chart>
