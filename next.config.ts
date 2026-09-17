import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          /*
           * Firebase's Google sign-in opens a popup and then polls
           * `window.closed` on it. Under the default cross-origin-opener
           * policy the browser severs that handle and logs
           * "Cross-Origin-Opener-Policy policy would block the window.closed
           * call" on every poll. Sign-in still completes, but the console
           * fills with noise.
           *
           * `same-origin-allow-popups` keeps this document isolated from any
           * page that opens it, while still allowing popups this page itself
           * opens to be controlled — which is exactly what the OAuth flow
           * needs.
           */
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
