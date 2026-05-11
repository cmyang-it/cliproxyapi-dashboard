// Next.js instrumentation — primary startup path for production builds.
// In dev mode this may fire late or not at all, so each API route also
// calls ensureCollector() as a fallback.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureCollector } = await import("./lib/collector")
    ensureCollector()
  }
}
