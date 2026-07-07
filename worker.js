// Cloudflare Worker — routes mahjongers.com traffic to two Railway services:
//   /          → LANDING_ORIGIN  (mahjongers-landing Railway service)
//   /@*        → PLATFORM_ORIGIN (mahjongers Railway service — brand sites)
//   /api/*     → PLATFORM_ORIGIN (platform API)
//   /studio*   → PLATFORM_ORIGIN (studio app)
//   other platform paths → PLATFORM_ORIGIN

const PLATFORM_PREFIXES = [
  "/@",
  "/api/",
  "/studio",
  "/calculator",
  "/mahjong-",
  "/sell-",
  "/host-",
  "/creator-"
];

function isPlatformRequest(pathname) {
  return PLATFORM_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

function proxy(request, origin) {
  const url = new URL(request.url);
  url.hostname = origin;
  url.protocol = "https:";
  const headers = new Headers(request.headers);
  headers.set("Host", origin);
  headers.set("X-Forwarded-Host", new URL(request.url).hostname);
  return fetch(new Request(url.toString(), { ...request, headers }));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (isPlatformRequest(pathname)) {
      return proxy(request, env.PLATFORM_ORIGIN);
    }
    return proxy(request, env.LANDING_ORIGIN);
  }
};
