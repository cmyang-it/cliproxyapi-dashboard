// Next.js instrumentation — primary startup path for production builds.
// In dev mode this may fire late or not at all, so each API route also
// calls ensureCollector() as a fallback.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize database first: creates directory + SQLite file + tables if missing
    const { getDb } = await import("./lib/db")
    console.log("[startup] Initializing database...")
    getDb()

    const { ensureCollector } = await import("./lib/collector")
    ensureCollector()
  }
}
