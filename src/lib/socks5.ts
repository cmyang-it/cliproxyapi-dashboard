/**
 * SOCKS5 proxy helper — pure Node.js implementation with zero dependencies.
 *
 * Handles the SOCKS5 handshake (no-auth), then upgrades to TLS for HTTPS
 * traffic through the proxy. Used by quota providers to route API calls
 * through a SOCKS5 tunnel.
 */

import net from "net"
import tls from "tls"
import https from "https"
import { env } from "./env"

/**
 * Create a raw TCP connection through a SOCKS5 proxy.
 *
 * Protocol flow:
 *   1. Client → Proxy: [0x05, 0x01, 0x00]  (version, 1 method, no-auth)
 *   2. Proxy → Client: [0x05, 0x00]          (version, no-auth accepted)
 *   3. Client → Proxy: [0x05, 0x01, 0x00, 0x03, len, host..., port_hi, port_lo]
 *   4. Proxy → Client: [0x05, 0x00, 0x00, atyp, addr..., port_hi, port_lo]
 */
function socks5Connect(
  proxyHost: string,
  proxyPort: number,
  targetHost: string,
  targetPort: number,
  timeoutMs: number,
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

    socket.once("connect", () => {
      // Step 1: negotiate auth — offer no-auth only
      socket.write(Buffer.from([0x05, 0x01, 0x00]))

      const onAuthReply = (data: Buffer) => {
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
        // data[1] === 0x00 means no-auth accepted. Step 2: issue CONNECT.
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

        // Accumulate the connect-reply — may arrive in multiple chunks.
        let replyBuf = Buffer.alloc(0)
        const onConnectReply = (chunk: Buffer) => {
          replyBuf = Buffer.concat([replyBuf, chunk])

          // Need at least 4 header bytes + variable address
          if (replyBuf.length < 4) return
          if (replyBuf[0] !== 0x05) {
            clearTimeout(timer)
            socket.removeAllListeners("data")
            socket.destroy()
            return reject(new Error(`Invalid SOCKS5 connect reply version: ${replyBuf[0]}`))
          }
          if (replyBuf[1] !== 0x00) {
            clearTimeout(timer)
            socket.removeAllListeners("data")
            socket.destroy()
            return reject(new Error(`SOCKS5 connect failed: code ${replyBuf[1]}`))
          }

          // Calculate how many more bytes we need after the 4-byte header.
          const atyp = replyBuf[3]
          let addrLen: number
          if (atyp === 0x01) addrLen = 4 + 2        // IPv4 + port
          else if (atyp === 0x03) addrLen = 1 + 2    // length byte + domain + port (but domain isn't in buf yet)
          else if (atyp === 0x04) addrLen = 16 + 2   // IPv6 + port
          else {
            clearTimeout(timer)
            socket.removeAllListeners("data")
            socket.destroy()
            return reject(new Error(`Unsupported SOCKS5 address type: ${atyp}`))
          }

          let needed = 4 + addrLen
          if (atyp === 0x03 && replyBuf.length >= 5) {
            // domain length byte is replyBuf[4]; actual domain + 2 port bytes follow
            const domainLen = replyBuf[4]
            needed = 5 + domainLen + 2
          }

          // Keep waiting for more data if we haven't received the full reply yet.
          // But once we identify domain length, recalculate needed.
          // We handle this by staying in the data listener until we have enough bytes.

          if (replyBuf.length < needed) return // wait for more chunks

          // Full reply received — handshake complete.
          clearTimeout(timer)
          socket.removeAllListeners("data")
          // Any leftover bytes after the SOCKS5 reply belong to the actual TLS stream.
          // Push them back so the TLS layer can consume them.
          if (replyBuf.length > needed) {
            socket.unshift(replyBuf.slice(needed))
          }
          socket.setTimeout(0)
          resolve(socket)
        }

        // Handle any leftover bytes after auth reply.
        const remainder = data.slice(2)
        socket.removeAllListeners("data")
        socket.on("data", onConnectReply)
        if (remainder.length > 0) {
          onConnectReply(remainder)
        }
      }

      socket.once("data", onAuthReply)
    })
  })
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
 */
export function socks5TlsConnect(
  proxyHost: string,
  proxyPort: number,
  targetHost: string,
  targetPort: number,
  timeoutMs: number,
  servername?: string,
): Promise<tls.TLSSocket> {
  return socks5Connect(proxyHost, proxyPort, targetHost, targetPort, timeoutMs).then(
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
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    // Use the low-level https API with a pre-connected socket.
    const req = https.request({
      hostname,
      path,
      method: "GET",
      headers: {
        ...headers,
        Host: hostname,
      },
      agent: false,
      createConnection: () => tlsSocket,
    })

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error(`Request timeout (${timeoutMs}ms)`))
    })

    req.on("error", reject)

    req.on("response", (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf-8"),
        })
      })
      res.on("error", reject)
    })

    req.end()
  })
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
  const hostname = u.hostname
  const path = u.pathname + u.search

  let status: number
  let body: string

  if (env.socks5ProxyHost && env.socks5ProxyPort > 0) {
    const tlsSocket = await socks5TlsConnect(
      env.socks5ProxyHost,
      env.socks5ProxyPort,
      hostname,
      443,
      timeoutMs,
    )
    try {
      const res = await httpsGet(tlsSocket, hostname, path, headers, timeoutMs)
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
    body = await resp.text()
  }

  if (status >= 400) {
    throw new Error(`HTTP ${status}: ${body.slice(0, 200)}`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Invalid JSON response: ${body.slice(0, 200)}`)
  }
}
