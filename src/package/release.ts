import { componentContracts, executableRelease, tokenContract } from "virtual:shadcn-package-data"
import type { DeepReadonly, LoadedComponentContracts } from "../contracts/components/loader"
import type { TokenContract } from "../contracts/tokens/types"
import type { ExecutableRelease } from "../validator/types"

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const release = deepFreeze(executableRelease)
const components = deepFreeze(componentContracts)
const tokens = deepFreeze(tokenContract)

/** Returns the checked-in release verified at package build time. */
export function getExecutableRelease(): DeepReadonly<ExecutableRelease> { return release }
export function getComponentContracts(): LoadedComponentContracts { return components }
export function getTokenContract(): DeepReadonly<TokenContract> { return tokens }

export type { LoadedComponentContracts } from "../contracts/components/loader"
export type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../contracts/components/types"
export type { TokenContract, TokenDefinition } from "../contracts/tokens/types"
export type { ExecutableRelease, ExecutableContract } from "../validator/types"
