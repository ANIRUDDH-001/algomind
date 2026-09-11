/**
 * @codesage
 * @file      next.config.ts
 * @purpose   Next.js configuration file specifying strict mode, headers, image domains, and external packages
 * @tech      Next.js, ONNX Runtime, HuggingFace Transformers
 * @connects  Exported NextConfig object used by Next.js build system
 * @apis      Configures domains: leetcode.com, supabase.co, workers.dev
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'leetcode.com',
        pathname: '/static/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.leetcode.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
      {
        // Cloudflare Worker proxy (for client-side storage URLs)
        protocol: 'https',
        hostname: '*.workers.dev',
        pathname: '/storage/v1/**',
      },
    ],
  },

  // Required for ONNX Runtime's threaded WASM (SharedArrayBuffer).
  // Scoped to /vad/ assets only to avoid breaking OAuth popups or 3P scripts.
  async headers() {
    return [
      // ── Global security headers (all routes) ───────────────────────
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'microphone=(self)',
              'autoplay=(self)',
            ].join(', '),
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // Monaco code editor loads its scripts/styles/workers from the jsdelivr CDN.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net",
              "connect-src 'self' data: https://*.supabase.co https://*.supabase.in https://api.groq.com https://*.upstash.io https://api.anthropic.com https://generativelanguage.googleapis.com https://cdn.jsdelivr.net wss://*.supabase.co",
              "font-src 'self' data: https://fonts.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "report-uri /api/log-error?source=csp",
            ].join('; '),
          },
        ],
      },
      // ── Keep all existing path-specific headers below this line ────
      {
        source: "/vad/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        source: "/interview",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/interview/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/assess/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

