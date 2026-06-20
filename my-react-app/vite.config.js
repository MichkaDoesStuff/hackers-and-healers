import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["lohp.ryanbeland.dev"],
    // Allow the CDS Hooks Sandbox (and any external origin) to reach proxied routes.
    // Without this, sandbox.cds-hooks.org gets CORS errors on preflight OPTIONS requests.
    cors: true,
    // Proxy /api and /cds-services to the local FastAPI backend.
    // lohp.ryanbeland.dev/cds-services → localhost:8000/cds-services (no second tunnel needed)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/cds-services': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/fhir': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

