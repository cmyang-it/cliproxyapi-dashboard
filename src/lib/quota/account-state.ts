import path from "path"
import { setAuthFileDisabled } from "./auth-file-status"
import type { AuthEntry } from "./auth"

export async function setQuotaAccountDisabled(entry: AuthEntry, disabled: boolean): Promise<void> {
  await setAuthFileDisabled(path.basename(entry.filepath), disabled)
  entry.data.disabled = disabled
}
