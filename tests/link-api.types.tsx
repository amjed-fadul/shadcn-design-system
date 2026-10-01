import { Link } from "../src/package"

const internal = <Link href="/docs">Documentation</Link>
const external = <Link href="https://example.com" newTab>Example (opens in a new tab)</Link>
const composed = <Link href="#details"><strong>Read details</strong></Link>
// @ts-expect-error destination is required
const missingHref = <Link>Documentation</Link>
// @ts-expect-error content is required
const missingChildren = <Link href="/docs" />
// @ts-expect-error target is governed by newTab
const target = <Link href="/docs" target="_blank">Documentation</Link>
// @ts-expect-error opener protection is component-owned
const rel = <Link href="/docs" rel="opener">Documentation</Link>
// @ts-expect-error classes are not a public API
const classes = <Link href="/docs" className="text-destructive">Documentation</Link>
// @ts-expect-error arbitrary style is not a public API
const style = <Link href="/docs" style={{ color: "red" }}>Documentation</Link>
// @ts-expect-error native navigation does not accept event interception
const event = <Link href="/docs" onClick={() => {}}>Documentation</Link>
// @ts-expect-error native semantics cannot be replaced
const role = <Link href="/docs" role="button">Documentation</Link>
// @ts-expect-error disabled links are not supported
const disabled = <Link href="/docs" disabled>Documentation</Link>
// @ts-expect-error polymorphic rendering is not supported
const asChild = <Link href="/docs" asChild>Documentation</Link>
// @ts-expect-error raw HTML injection is not supported
const raw = <Link href="/docs" dangerouslySetInnerHTML={{ __html: "Documentation" }}>Documentation</Link>
// @ts-expect-error ref is not part of the bounded V1 API
const ref = <Link href="/docs" ref={() => {}}>Documentation</Link>

// JSX permits unknown hyphenated attributes; the runtime and authored contract
// separately prove that aria-label is neither forwarded nor authorized.
void [internal, external, composed, missingHref, missingChildren, target, rel, classes, style, event, role, disabled, asChild, raw, ref]
