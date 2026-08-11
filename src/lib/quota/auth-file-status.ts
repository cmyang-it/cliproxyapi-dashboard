import { env } from "../env"

interface AuthFileStatusResponse {
  disabled?: unknown
}

export async function setAuthFileDisabled(name: string, disabled: boolean): Promise<boolean> {
  if (!env.managementKey.trim()) {
    throw new Error("MANAGEMENT_KEY 未配置")
  }

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}/v0/management/auth-files/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.managementKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, disabled }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    throw new Error(`Failed to update auth file status: ${errorMessage(err)}`)
  }

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(`Failed to update auth file status: HTTP ${response.status}${message ? ` ${message}` : ""}`)
  }

  let payload: AuthFileStatusResponse
  try {
    payload = (await response.json()) as AuthFileStatusResponse
  } catch {
    throw new Error("Failed to update auth file status: invalid JSON response")
  }
  if (typeof payload.disabled !== "boolean") {
    throw new Error("Failed to update auth file status: missing boolean disabled response")
  }
  if (payload.disabled !== disabled) {
    throw new Error(
      `Failed to update auth file status: disabled response mismatch (requested ${disabled}, got ${payload.disabled})`,
    )
  }

  return payload.disabled
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "")
  if (!text) return ""

  const parsed = parseJson(text)
  if (isRecord(parsed)) {
    const message = stringField(parsed.error) || stringField(parsed.message)
    if (message) return cleanMessage(message)
  }

  return cleanMessage(text)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function errorMessage(err: unknown): string {
  return cleanMessage(err instanceof Error ? err.message : String(err))
}

function cleanMessage(message: string): string {
  return message.replace(/[\r\n]/g, " ").trim()
}
