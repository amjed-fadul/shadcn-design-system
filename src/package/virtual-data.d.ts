declare module "virtual:shadcn-package-data" {
  export const executableRelease: import("../validator/types").ExecutableRelease
  export const componentContracts: import("../contracts/components/loader").LoadedComponentContracts
  export const tokenContract: import("../contracts/tokens/types").TokenContract
}
