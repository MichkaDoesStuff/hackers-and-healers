import { headers } from "next/headers"

/** Public origin for CDS discovery URLs (tunnel, localhost, or env override). */
export async function resolvePublicOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_LOOP_APP_URL ?? process.env.LOOP_APP_URL
  if (fromEnv) {
    try {
      return new URL(fromEnv.replace(/\/$/, "")).origin
    } catch {
      // fall through to request headers
    }
  }

  const h = await headers()
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host")
  if (!host) return "http://localhost:3000"

  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")

  return `${proto}://${host}`
}
