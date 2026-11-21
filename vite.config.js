import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mirrors the production headers in customHttp.yml (AWS Amplify) so the
// policy can be checked locally with `npm run build && npm run preview`.
// Not applied to `npm run dev`: Vite's dev server needs inline scripts and
// websockets for hot reload, which this CSP would block.
// Intentionally omitted here (production only): Strict-Transport-Security and
// the CSP's upgrade-insecure-requests, which would break http://localhost.
// Motion sensors are deliberately not blocked in Permissions-Policy:
// react-parallax-tilt uses device orientation for tilt on phones.
const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'tdm-reservation': '1',
  'X-Robots-Tag': 'noai, noimageai',
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    headers: securityHeaders,
  },
  resolve: {
    alias: [
      {
        find: './runtimeConfig',
        replacement: './runtimeConfig.browser',
      },
    ]
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
