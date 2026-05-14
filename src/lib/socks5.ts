/**
 * SOCKS5 proxy helper — pure Node.js implementation with zero dependencies.
 *
 * Handles the SOCKS5 handshake (no-auth), then upgrades to TLS for HTTPS
 * traffic through the proxy. Used by quota providers to route API calls
 * through a SOCKS5 tunnel.
 */

import net from "net"
import tls from "tls"
// env proxy fields are read directly from process.env at call time
// to avoid Next.js webpack module-snapshot issues.

/**
 * Create a raw TCP connection through a SOCKS5 proxy.
 *
 * Protocol flow:
 *   A. Auth negotiation
 *      Client → Proxy: [0x05, 0x02, 0x00, 0x02]   (with credentials)
 *                        or [0x05, 0x01, 0x00]        (no-auth only)
 *      Proxy → Client: [0x05, 0x00]                   (no-auth accepted)
 *                    or [0x05, 0x02]                   (user/pass required)
 *
 *   B. If user/pass (0x02) — RFC 1929:
 *      Client → Proxy: [0x01, ulen, user..., plen, pass...]
 *      Proxy → Client: [0x01, 0x00]                   (success)
 *
 *   C. CONNECT command:
 *      Client → Proxy: [0x05, 0x01, 0x00, 0x03, len, host..., port_hi, port_lo]
 *      Proxy → Client: [0x05, 0x00, 0x00, atyp, addr..., port_hi, port_lo]
 */
function socks5Connect(
  proxyHost: string,
  proxyPort: number,
  targetHost: string,
  targetPort: number,
  timeoutMs: number,
  auth?: { username: string; password: string },
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: proxyHost, port: proxyPort })

    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`SOCKS5 connection timeout (${timeoutMs}ms)`))
    }, timeoutMs)

    socket.once("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })

    // --- Issue the CONNECT command after auth completes ---
    // Accepts optional initial buffer from the previous stage's remainder
    function issueConnect(initial?: Buffer) {
      const hostBytes = Buffer.from(targetHost, "ascii")
      const request = Buffer.alloc(7 + hostBytes.length)
      request[0] = 0x05 // SOCKS version
      request[1] = 0x01 // CMD CONNECT
      request[2] = 0x00 // RSV
      request[3] = 0x03 // ATYP DOMAINNAME
      request[4] = hostBytes.length
      hostBytes.copy(request, 5)
      request[5 + hostBytes.length] = (targetPort >> 8) & 0xff
      request[6 + hostBytes.length] = targetPort & 0xff
      socket.write(request)

      // Accumulate the connect-reply — use initial buffer from previous stage
      let replyBuf = initial ? Buffer.from(initial) : Buffer.alloc(0)
      const onConnectReply = (chunk: Buffer) => {
        replyBuf = Buffer.concat([replyBuf, chunk])
        processConnectReply(replyBuf)
      }
      const processConnectReply = (buf: Buffer) => {
        if (buf.length < 4) return
        if (buf[0] !== 0x05) {
          clearTimeout(timer)
          socket.removeAllListeners("data")
          socket.destroy()
          return reject(new Error(`Invalid SOCKS5 connect reply version: ${buf[0]}`))
        }
        if (buf[1] !== 0x00) {
          clearTimeout(timer)
          socket.removeAllListeners("data")
          socket.destroy()
          return reject(new Error(`SOCKS5 connect to ${targetHost}:${targetPort} failed: ${socks5ReplyMessage(buf[1])}`))
        }
        const atyp = buf[3]
        let addrLen: number
        if (atyp === 0x01) addrLen = 4 + 2
        else if (atyp === 0x03) addrLen = 1 + 2
        else if (atyp === 0x04) addrLen = 16 + 2
        else {
          clearTimeout(timer)
          socket.removeAllListeners("data")
          socket.destroy()
          return reject(new Error(`Unsupported SOCKS5 address type: ${atyp}`))
        }
        let needed = 4 + addrLen
        if (atyp === 0x03 && buf.length >= 5) {
          const domainLen = buf[4]
          needed = 5 + domainLen + 2
        }
        if (buf.length < needed) return
        clearTimeout(timer)
        socket.removeAllListeners("data")
        if (buf.length > needed) socket.unshift(buf.slice(needed))
        socket.setTimeout(0)
        resolve(socket)
      }
      socket.removeAllListeners("data")
      socket.on("data", onConnectReply)
      // Process any buffered bytes from previous stage
      if (replyBuf.length > 0) processConnectReply(replyBuf)
    }

    // --- RFC 1929 username/password authentication ---
    function doUserPassAuth(initial?: Buffer) {
      if (!auth?.username) {
        clearTimeout(timer)
        socket.destroy()
        return reject(new Error("SOCKS5 proxy requested user/pass auth but no credentials configured"))
      }
      const userBytes = Buffer.from(auth.username, "utf8")
      const passBytes = Buffer.from(auth.password, "utf8")
      if (userBytes.length > 255) {
        clearTimeout(timer)
        socket.destroy()
        return reject(new Error("SOCKS5 username too long (max 255 bytes)"))
      }
      if (passBytes.length > 255) {
        clearTimeout(timer)
        socket.destroy()
        return reject(new Error("SOCKS5 password too long (max 255 bytes)"))
      }
      const req = Buffer.alloc(3 + userBytes.length + passBytes.length)
      req[0] = 0x01
      req[1] = userBytes.length
      userBytes.copy(req, 2)
      req[2 + userBytes.length] = passBytes.length
      passBytes.copy(req, 3 + userBytes.length)
      socket.write(req)

      // Accumulate user/pass reply — start with remainder from auth method reply
      let upBuf = initial ? Buffer.from(initial) : Buffer.alloc(0)

      const onUpReply = (chunk: Buffer) => {
        upBuf = Buffer.concat([upBuf, chunk])
        if (upBuf.length < 2) return
        if (upBuf[0] !== 0x01) {
          clearTimeout(timer)
          socket.destroy()
          return reject(new Error("Invalid SOCKS5 user/pass auth reply"))
        }
        if (upBuf[1] !== 0x00) {
          clearTimeout(timer)
          socket.destroy()
          return reject(new Error("SOCKS5 user/pass authentication failed — check username/password"))
        }
        // Auth succeeded — pass remainder to CONNECT stage
        issueConnect(upBuf.slice(2))
      }

      socket.removeAllListeners("data")
      socket.on("data", onUpReply)
      // If initial buffer already contains full reply, process it
      if (upBuf.length >= 2) onUpReply(Buffer.alloc(0))
    }

    socket.once("connect", () => {
      // Step 1: negotiate auth method
      const hasCredentials = !!(auth?.username)
      if (hasCredentials) {
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02])) // no-auth + user/pass
      } else {
        socket.write(Buffer.from([0x05, 0x01, 0x00])) // no-auth only
      }

      socket.once("data", (data: Buffer) => {
        if (data.length < 2 || data[0] !== 0x05) {
          clearTimeout(timer)
          socket.destroy()
          return reject(new Error(`Invalid SOCKS5 auth reply: ${data.toString("hex")}`))
        }
        if (data[1] === 0xff) {
          clearTimeout(timer)
          socket.destroy()
          return reject(new Error("SOCKS5 proxy rejected all auth methods"))
        }
        // Forward any leftover bytes to the next stage (TCP may combine
        // multiple SOCKS5 messages in a single chunk).
        const remainder = data.subarray(2)
        if (data[1] === 0x00) {
          issueConnect(remainder.length > 0 ? remainder : undefined)
        } else if (data[1] === 0x02) {
          doUserPassAuth(remainder.length > 0 ? remainder : undefined)
        } else {
          clearTimeout(timer)
          socket.destroy()
          return reject(new Error(`SOCKS5 proxy returned unsupported auth method: 0x${data[1].toString(16)}`))
        }
      })
    })
  })
}

function socks5ReplyMessage(code: number): string {
  const messages: Record<number, string> = {
    1: "general proxy failure",
    2: "connection not allowed by ruleset",
    3: "network unreachable",
    4: "host unreachable",
    5: "connection refused by target",
    6: "TTL expired",
    7: "command not supported",
    8: "address type not supported",
  }
  return `${messages[code] || "unknown error"} (code ${code})`
}

/**
 * Establish a TLS connection through a SOCKS5 proxy.
 *
 * @param proxyHost   SOCKS5 proxy host
 * @param proxyPort   SOCKS5 proxy port
 * @param targetHost  destination hostname (TLS SNI)
 * @param targetPort  destination port (typically 443)
 * @param timeoutMs   handshake + connect timeout
 * @param servername  optional SNI hostname override
 * @param auth        optional username/password for SOCKS5 proxy
 */
export function socks5TlsConnect(
  proxyHost: string,
  proxyPort: number,
  targetHost: string,
  targetPort: number,
  timeoutMs: number,
  servername?: string,
  auth?: { username: string; password: string },
): Promise<tls.TLSSocket> {
  return socks5Connect(proxyHost, proxyPort, targetHost, targetPort, timeoutMs, auth).then(
    (rawSocket) =>
      new Promise<tls.TLSSocket>((resolve, reject) => {
        const tlsSocket = tls.connect({
          socket: rawSocket,
          servername: servername || targetHost,
          rejectUnauthorized: true,
        })

        const timer = setTimeout(() => {
          tlsSocket.destroy()
          reject(new Error(`TLS handshake timeout (${timeoutMs}ms)`))
        }, timeoutMs)

        tlsSocket.once("error", (err) => {
          clearTimeout(timer)
          reject(err)
        })

        tlsSocket.once("secureConnect", () => {
          clearTimeout(timer)
          tlsSocket.setTimeout(timeoutMs)
          resolve(tlsSocket)
        })
      }),
  )
}

/**
 * Perform an HTTPS GET request over an established TLS socket.
 *
 * Because we're using a pre-connected socket, we bypass DNS and routing —
 * this is how we tunnel through SOCKS5.
 */
export function httpsGet(
  tlsSocket: tls.TLSSocket,
  hostname: string,
  path: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBodySize = 1_048_576,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const chunks: Buffer[] = []
    let totalSize = 0

    const cleanup = () => {
      tlsSocket.off("data", onData)
      tlsSocket.off("end", onEnd)
      tlsSocket.off("close", onClose)
      tlsSocket.off("error", onError)
      tlsSocket.setTimeout(0)
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      tlsSocket.destroy()
      reject(err)
    }

    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      try {
        resolve(parseHttpResponse(Buffer.concat(chunks)))
      } catch (err) {
        reject(err)
      }
    }

    function onData(chunk: Buffer) {
      totalSize += chunk.length
      if (totalSize > maxBodySize) {
        fail(new Error(`Response body exceeds ${maxBodySize} byte limit`))
        return
      }
      chunks.push(chunk)
    }

    function onEnd() {
      finish()
    }

    function onClose() {
      if (chunks.length > 0) finish()
      else fail(new Error("Connection closed before HTTP response"))
    }

    function onError(err: Error) {
      fail(err)
    }

    tlsSocket.setTimeout(timeoutMs, () => {
      fail(new Error(`Request timeout (${timeoutMs}ms)`))
    })
    tlsSocket.on("data", onData)
    tlsSocket.once("end", onEnd)
    tlsSocket.once("close", onClose)
    tlsSocket.once("error", onError)

    tlsSocket.write(buildHttpRequest(hostname, path, headers))
  })
}

function buildHttpRequest(
  hostname: string,
  path: string,
  headers: Record<string, string>,
): string {
  const lines = [
    `GET ${path || "/"} HTTP/1.1`,
    `Host: ${hostname}`,
    "Connection: close",
    "Accept-Encoding: identity",
  ]

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "host") continue
    const safeName = name.replace(/[\r\n:]/g, "")
    const safeValue = value.replace(/[\r\n]/g, "")
    lines.push(`${safeName}: ${safeValue}`)
  }

  return `${lines.join("\r\n")}\r\n\r\n`
}

function parseHttpResponse(response: Buffer): { status: number; body: string } {
  const headerEnd = response.indexOf("\r\n\r\n")
  if (headerEnd < 0) throw new Error("Invalid HTTP response: missing headers")

  const headerText = response.subarray(0, headerEnd).toString("latin1")
  const bodyBuffer = response.subarray(headerEnd + 4)
  const lines = headerText.split("\r\n")
  const status = Number(lines[0]?.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/)?.[1] || 0)
  const headerMap = new Map<string, string>()

  for (const line of lines.slice(1)) {
    const sep = line.indexOf(":")
    if (sep <= 0) continue
    headerMap.set(line.slice(0, sep).trim().toLowerCase(), line.slice(sep + 1).trim())
  }

  const transferEncoding = headerMap.get("transfer-encoding")?.toLowerCase() || ""
  const decodedBody = transferEncoding.includes("chunked")
    ? decodeChunkedBody(bodyBuffer)
    : bodyBuffer

  return { status, body: decodedBody.toString("utf-8") }
}

function decodeChunkedBody(body: Buffer): Buffer {
  const chunks: Buffer[] = []
  let offset = 0

  while (offset < body.length) {
    const lineEnd = body.indexOf("\r\n", offset)
    if (lineEnd < 0) throw new Error("Invalid chunked response")

    const sizeText = body.subarray(offset, lineEnd).toString("ascii").split(";", 1)[0]
    const size = Number.parseInt(sizeText, 16)
    if (!Number.isFinite(size)) throw new Error("Invalid chunked response size")
    if (size === 0) break

    offset = lineEnd + 2
    if (offset + size > body.length) throw new Error("Incomplete chunked response")
    chunks.push(body.subarray(offset, offset + size))
    offset += size + 2
  }

  return Buffer.concat(chunks)
}

// ---------------------------------------------------------------------------
// Convenience: unified fetch with automatic proxy routing
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from an HTTPS URL, routing through SOCKS5 if configured.
 *
 * Callers don't need to know whether a proxy is in use — this function
 * handles both paths transparently, using the same pattern as codex.ts.
 */
export async function fetchHttpsJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 15000,
): Promise<unknown> {
  const u = new URL(url)

  // Security: only HTTPS targets are supported (all provider URLs are hardcoded)
  if (u.protocol !== "https:") {
    throw new Error(`fetchHttpsJson only supports HTTPS URLs, got ${u.protocol}`)
  }

  const hostname = u.hostname
  const path = u.pathname + u.search

  // --- Parse & validate SOCKS5 proxy configuration ---
  // Fail-closed: if host is configured, port MUST be a valid integer.
  // Never silently fall back to direct connection when proxy was intended.
  const rawHost = (process.env.SOCKS5_PROXY_HOST || "").trim()
  const rawPort = (process.env.SOCKS5_PROXY_PORT || "").trim()

  let proxyHost = ""
  let proxyPort = 0
  let proxyAuth: { username: string; password: string } | undefined

  if (rawHost) {
    const p = Number(rawPort)
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      throw new Error(
        `SOCKS5_PROXY_HOST is set ("${rawHost}") but SOCKS5_PROXY_PORT ` +
        `"${rawPort}" is not a valid integer 1–65535. ` +
        `Refusing to fall back to direct connection.`
      )
    }
    proxyHost = rawHost
    proxyPort = p

    // Optional username/password (RFC 1929).
    // Both or neither must be set; partial config is rejected to prevent
    // silent fallback to no-auth when credentials were intended.
    const rawUser = process.env.SOCKS5_PROXY_USERNAME || ""
    const rawPass = process.env.SOCKS5_PROXY_PASSWORD || ""
    if (rawUser.length > 0) {
      if (rawPass.length === 0) {
        throw new Error(
          "SOCKS5_PROXY_USERNAME is set but SOCKS5_PROXY_PASSWORD is empty. " +
          "Both must be configured or both left empty."
        )
      }
      proxyAuth = { username: rawUser, password: rawPass }
    } else if (rawPass.length > 0) {
      throw new Error(
        "SOCKS5_PROXY_PASSWORD is set but SOCKS5_PROXY_USERNAME is empty. " +
        "Both must be configured or both left empty."
      )
    }

    // One-time diagnostic log
    const authLabel = proxyAuth ? " (with user/pass)" : ""
    if (!(fetchHttpsJson as unknown as Record<string, unknown>)._proxyLogged) {
      console.log(`[socks5] Proxy enabled: ${proxyHost}:${proxyPort}${authLabel}`)
      ;(fetchHttpsJson as unknown as Record<string, unknown>)._proxyLogged = true
    }
  }

  const MAX_BODY = 1_048_576
  let status: number
  let body: string

  if (proxyHost) {
    const tlsSocket = await socks5TlsConnect(
      proxyHost,
      proxyPort,
      hostname,
      443,
      timeoutMs,
      undefined, // servername
      proxyAuth,
    )
    try {
      const res = await httpsGet(tlsSocket, hostname, path, headers, timeoutMs, MAX_BODY)
      status = res.status
      body = res.body
    } finally {
      tlsSocket.destroy()
    }
  } else {
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    status = resp.status
    body = await readFetchBodyWithLimit(resp, MAX_BODY)
  }

  if (Buffer.byteLength(body, "utf-8") > MAX_BODY) {
    throw new Error(`Response body too large: ${Buffer.byteLength(body, "utf-8")} bytes (max ${MAX_BODY})`)
  }

  if (status >= 400) {
    throw new Error(`HTTP ${status}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Invalid JSON response (${body.length} bytes)`)
  }
}

async function readFetchBodyWithLimit(resp: Response, maxBodySize: number): Promise<string> {
  if (!resp.body) {
    const text = await resp.text()
    const size = Buffer.byteLength(text, "utf-8")
    if (size > maxBodySize) throw new Error(`Response body exceeds ${maxBodySize} byte limit`)
    return text
  }

  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      totalSize += value.byteLength
      if (totalSize > maxBodySize) {
        await reader.cancel()
        throw new Error(`Response body exceeds ${maxBodySize} byte limit`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}