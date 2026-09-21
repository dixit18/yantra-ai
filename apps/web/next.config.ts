import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    // Citation pages carry a demo bearer token in the URL: never let the
    // browser forward it as a Referer to the bytes endpoint (or anywhere).
    // Cookie sessions replace URL bearers with console auth (P2-CONSOLE-019).
    return [
      {
        source: '/citations/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
