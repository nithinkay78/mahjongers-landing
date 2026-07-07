// Cloudflare Worker — routes mahjongers.com traffic:
//   /          → Cloudflare Pages (landing page)
//   /@*        → Railway origin (creator brand sites)
//   /api/*     → Railway origin (platform API)
//   /studio*   → Railway origin (studio app)
//   other platform paths → Railway origin
//
// Subrequests from a Worker to the same zone go directly to the origin
// (Railway) without re-triggering this Worker, so no loop risk.

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isPlatformRequest(url.pathname)) {
      // Pass through to Railway (same-zone subrequest bypasses this Worker).
      return fetch(request);
    }

    // Landing page — proxy to Cloudflare Pages.
    const target = new URL(request.url);
    target.hostname = env.PAGES_ORIGIN; // e.g. mahjongers-landing.pages.dev
    return fetch(new Request(target.toString(), request));
  }
};
