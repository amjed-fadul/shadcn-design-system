import { Image } from "../src/package"

const intrinsic = <Image src="/landscape.png" alt="Landscape" width={640} height={360} />
const fill = <Image src="/landscape.png" alt="Landscape" width={640} height={360} layout="fill" fit="cover" loading="lazy" />
const decorative = <Image src="/decoration.png" alt="" width={80} height={80} />
// @ts-expect-error source is required
const missingSource = <Image alt="Landscape" width={640} height={360} />
// @ts-expect-error authors must explicitly choose meaningful or decorative alt
const missingAlt = <Image src="/landscape.png" width={640} height={360} />
// @ts-expect-error intrinsic width is required in both layouts
const missingWidth = <Image src="/landscape.png" alt="Landscape" height={360} layout="fill" />
// @ts-expect-error intrinsic height is required
const missingHeight = <Image src="/landscape.png" alt="Landscape" width={640} />
// @ts-expect-error dimensions are numbers rather than CSS lengths
const cssWidth = <Image src="/landscape.png" alt="Landscape" width="100%" height={360} />
// @ts-expect-error arbitrary layout is unsupported
const layout = <Image src="/landscape.png" alt="Landscape" width={640} height={360} layout="absolute" />
// @ts-expect-error arbitrary fit is unsupported
const fit = <Image src="/landscape.png" alt="Landscape" width={640} height={360} fit="stretch" />
// @ts-expect-error loading is bounded
const loading = <Image src="/landscape.png" alt="Landscape" width={640} height={360} loading="auto" />
// @ts-expect-error CSS classes are not public props
const classes = <Image src="/landscape.png" alt="Landscape" width={640} height={360} className="rounded-full" />
// @ts-expect-error arbitrary styles are unsupported
const styles = <Image src="/landscape.png" alt="Landscape" width={640} height={360} style={{ width: 999 }} />
// @ts-expect-error image source sets are outside V1
const sourceSet = <Image src="/landscape.png" alt="Landscape" width={640} height={360} srcSet="/other.png 2x" />
// @ts-expect-error role semantics belong to the native image
const role = <Image src="/landscape.png" alt="Landscape" width={640} height={360} role="button" />
// @ts-expect-error children and fallback content are unsupported
const children = <Image src="/landscape.png" alt="Landscape" width={640} height={360}>Fallback</Image>
// @ts-expect-error image interaction belongs to the containing action
const click = <Image src="/landscape.png" alt="Landscape" width={640} height={360} onClick={() => {}} />

void [intrinsic, fill, decorative, missingSource, missingAlt, missingWidth, missingHeight, cssWidth, layout, fit, loading, classes, styles, sourceSet, role, children, click]
