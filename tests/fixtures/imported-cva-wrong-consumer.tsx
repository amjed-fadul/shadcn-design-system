// @ts-expect-error Deliberately unresolved to prove import-source authority fails closed.
import { importedRecipe as wrongSourceRecipe } from "./not-the-pinned-recipe"
// @ts-expect-error Deliberately absent to prove imported-export authority fails closed.
import { missingRecipe as wrongExportRecipe } from "./imported-cva-recipe"

function WrongSourceFixture() {
  return <div className={wrongSourceRecipe() as string} />
}

function WrongExportFixture() {
  return <div className={wrongExportRecipe() as string} />
}

export { WrongExportFixture, WrongSourceFixture }
