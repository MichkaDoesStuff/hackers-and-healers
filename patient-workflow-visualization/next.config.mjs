/** @type {import('next').NextConfig} */
const cdsBackendUrl = process.env.CDS_BACKEND_URL ?? process.env.BACKEND_URL ?? "http://localhost:8000"
const loopBackendUrl = process.env.LOOP_BACKEND_URL ?? "http://localhost:8010"
const fhirUrl = process.env.FHIR_URL ?? "https://lohp.ryanbeland.dev/fhir"

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Single public URL (e.g. lohp.ryanbeland.dev) can serve the Next.js UI
    // while proxying CDS Hooks + FHIR to the Python backend on :8000.
    return [
      {
        source: "/cds-services/:path*",
        destination: `${cdsBackendUrl}/cds-services/:path*`,
      },
      {
        source: "/fhir/:path*",
        destination: `${fhirUrl}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${loopBackendUrl}/api/:path*`,
      },
    ]
  },
  async headers() {
    const frameAncestors = [
      "'self'",
      "https://sandbox.cds-hooks.org",
      "https://lohp.ryanbeland.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].join(" ")

    const cors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
      {
        key: "Access-Control-Allow-Headers",
        value: "Authorization, Content-Type, Accept",
      },
    ]

    return [
      {
        source: "/cds-services/:path*",
        headers: cors,
      },
      {
        source: "/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ]
  },
}

export default nextConfig
