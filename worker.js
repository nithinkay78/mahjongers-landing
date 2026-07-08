// Cloudflare Worker — two responsibilities:
//
// 1. mahjongers.com/*
//    /          → LANDING_ORIGIN  (mahjongers-landing Railway service)
//    /@* /api/* /studio* etc → PLATFORM_ORIGIN (mahjongers Railway service)
//
// 2. origin.mahjongers.com/*
//    Cloudflare for SaaS routes creator custom domains (e.g. madammahjong.org)
//    to this fallback origin. The Worker receives the request with the creator's
//    domain in the Host header, rewrites Host to the Railway service domain so
//    Railway accepts it, and adds X-Creator-Domain so server.js can route it.

const PLATFORM_PREFIXES = [
  "/@",
  "/profile/",
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

function proxy(request, targetOrigin, extraHeaders = {}) {
  const url = new URL(request.url);
  url.hostname = targetOrigin;
  url.protocol = "https:";
  const headers = new Headers(request.headers);
  headers.set("Host", targetOrigin);
  headers.set("X-Forwarded-Host", request.headers.get("host") || url.hostname);
  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  // Spreading a Request ({ ...request }) drops method and body, so POST/PUT/DELETE
  // arrived at the origin as a bodyless GET. Forward method + body explicitly.
  // redirect: "manual" passes origin 3xx straight through instead of the Worker
  // silently following them (which turned 301s into 200s).
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(url.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual"
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const incomingHost = request.headers.get("host") || url.hostname;

    // www → apex 301. Must come before the creator-domain branch below, which
    // would otherwise treat www.mahjongers.com as a creator custom domain and
    // proxy it to the platform app.
    if (incomingHost === "www.mahjongers.com") {
      return Response.redirect(`https://mahjongers.com${url.pathname}${url.search}`, 301);
    }

    // Creator custom domain — routed here by Cloudflare for SaaS.
    // The host header is the creator's domain (e.g. madammahjong.org).
    if (url.hostname === "origin.mahjongers.com" || incomingHost !== "mahjongers.com") {
      if (incomingHost !== "origin.mahjongers.com") {
        return proxy(request, env.PLATFORM_ORIGIN, { "X-Creator-Domain": incomingHost });
      }
    }

    // mahjongers.com routing
    if (isPlatformRequest(url.pathname)) {
      return proxy(request, env.PLATFORM_ORIGIN);
    }
    return proxy(request, env.LANDING_ORIGIN);
  }
};
