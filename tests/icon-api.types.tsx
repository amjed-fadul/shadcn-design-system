import { Icon } from "../src/package"

// Positive cases and rejected escape hatches compile with the package API.
const decorative = <Icon name="search" />
const meaningful = <Icon name="info" decorative={false} label="Information" size="lg" />
const logical = <Icon name="arrow-end" placement="inline-end" size="sm" />
const colored = <Icon name="info" color="primary" />
const muted = <Icon name="info" color="muted-foreground" />
// Release 011 content identities and status colors.
const trend = <Icon name="trending-up" color="success" decorative={false} label="Up 12.4%" />
const due = <Icon name="clock" color="warning" />
const notice = <Icon name="bell" color="info" />
const building = <Icon name="building" />
// @ts-expect-error Lucide component names are not governed identities
const lucideName = <Icon name="house" />
// @ts-expect-error the chart identity is chart-column, not a generic chart
const genericChart = <Icon name="chart" />
// @ts-expect-error arbitrary color strings are not governed
const rawColor = <Icon name="info" color="#ff0000" />
// @ts-expect-error CSS variables are not a public color API
const customColor = <Icon name="info" color="var(--custom)" />
// @ts-expect-error an icon identity is required
const missingName = <Icon />
// @ts-expect-error arbitrary library names are not governed
const arbitraryName = <Icon name="alarm-clock" />
// @ts-expect-error meaningful icons require a label
const missingLabel = <Icon name="info" decorative={false} />
// @ts-expect-error decorative labels are redundant and forbidden
const decorativeLabel = <Icon name="info" label="Information" />
// @ts-expect-error classes are not an authorable design-system API
const classes = <Icon name="search" className="size-96" />
// @ts-expect-error arbitrary styles are not supported
const styles = <Icon name="search" style={{ color: "red" }} />
// @ts-expect-error caller-supplied SVG content is not supported
const children = <Icon name="search"><path d="M0 0" /></Icon>
// @ts-expect-error raw SVG injection is not supported
const injection = <Icon name="search" dangerouslySetInnerHTML={{ __html: "<path />" }} />
// @ts-expect-error arbitrary sizing is not supported
const sizing = <Icon name="search" size={32} />
// @ts-expect-error role is owned by the component
const role = <Icon name="search" role="alert" />

void [colored, muted, trend, due, notice, building, lucideName, genericChart, rawColor, customColor, decorative, meaningful, logical, missingName, arbitraryName, missingLabel, decorativeLabel, classes, styles, children, injection, sizing, role]
