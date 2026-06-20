/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const frameAncestors = [
      "'self'",
      "https://sandbox.cds-hooks.org",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].join(" ")

    return [
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
