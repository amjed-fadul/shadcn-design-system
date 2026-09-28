import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { getExecutableRelease } from "../src/validator/canonical-release"

// This module runs only in the build process. The browser receives plain data;
// it never imports repository loaders or regenerates the executable release.
export const componentContracts = loadComponentContracts()
export const tokenContract = getTokenContract()
export const executableRelease = getExecutableRelease()
