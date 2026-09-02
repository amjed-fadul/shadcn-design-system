import { loadComponentContracts } from "./canonical-loader"
import { createComponentContractQuery } from "./query"

/** Canonical shadcn query entrypoint, kept outside the generic query core. */
const canonicalQuery = createComponentContractQuery(loadComponentContracts)

export const getComponentContractSet = canonicalQuery.getComponentContractSet
export const listComponentFamilies = canonicalQuery.listComponentFamilies
export const getComponentFamily = canonicalQuery.getComponentFamily
export const lookupComponentExport = canonicalQuery.lookupComponentExport
export const getInheritedInterface = canonicalQuery.getInheritedInterface
export const isAuthorableJsxExport = canonicalQuery.isAuthorableJsxExport
export const queryComponentCapabilities = canonicalQuery.queryComponentCapabilities
export const queryComponentTokenDependencies = canonicalQuery.queryComponentTokenDependencies
