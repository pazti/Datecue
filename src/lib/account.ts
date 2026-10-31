import { httpsCallable } from "firebase/functions"
import { cloudFunctions } from "./firebase"

const deleteAccountDataCall = httpsCallable<void, { success: boolean }>(
  cloudFunctions,
  "deleteAccountData",
)

export async function deleteAccountData() {
  const result = await deleteAccountDataCall()
  if (!result.data.success) {
    throw new Error("ACCOUNT_DELETION_FAILED")
  }
}
