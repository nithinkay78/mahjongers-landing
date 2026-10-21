// Landing page and lead forms hosted entirely on Cloudflare.
// Static pages live in ./public (served through the ASSETS binding); this Worker
// adds clean URLs, the two lead-form endpoints, and security headers.
import { withAICrawlerTracking } from "@datafast/ai-crawl";

const PAGES = {
  "/": "/index.html",
  "/join": "/join.html",
  "/social-media": "/social-media.html",
  "/privacy": "/privacy.html",
  "/terms": "/terms.html"
};

// Pages of the retired creator platform. 410 tells search engines to drop them.
const RETIRED_PREFIXES = ["/@", "/profile/", "/api/", "/studio", "/market", "/calculator", "/mahjong-", "/sell-", "/host-", "/creator-"];

const PLANS = ["starter", "pro", "max"];

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://datafa.st https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://images.unsplash.com",
    "connect-src 'self' https://datafa.st https://cloudflareinsights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ")
};

async function beehiivSubscribe(email, utmMedium, env) {
  const apiKey = String(env.BEEHIIV_API_KEY || "").trim();
  if (!apiKey) return { skipped: true };
  const response = await fetch(`https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID || "pub_d6bdfb34-1ff5-4d82-b2e8-b4b1ba95dcc1"}/subscriptions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: "mahjongers.com",
      utm_medium: utmMedium
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Beehiiv ${response.status}: ${JSON.stringify(data)}`);
  return { status: data?.data?.status };
}

// Alert the team that a lead came in. No database — this email (plus the
// Beehiiv subscription for email leads) is the record of the lead.
async function sendLeadEmail(lead, env) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  if (!apiKey) return;
  const recipients = String(env.LEAD_NOTIFY_EMAILS || "hi.mahjongers@gmail.com,nithin@move78.in")
    .split(",").map((e) => e.trim()).filter(Boolean);
  const lines = [
    `Name: ${lead.name || "—"}`,
    `Email: ${lead.email || "—"}`,
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.plan ? `Social media plan: ${lead.plan}` : "",
    lead.firstSale ? `About: ${lead.firstSale}` : "",
    `At: ${new Date().toISOString()}`
  ].filter(Boolean);
  const subject = lead.plan
    ? `New social media lead (${lead.plan}): ${lead.name || lead.email}`
    : `New founder-access request: ${lead.name || lead.email}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.LEAD_NOTIFY_FROM || "Mahjongers <leads@mahjongers.com>",
      to: recipients,
      subject,
      text: `A new lead came in from mahjongers.com.\n\n${lines.join("\n")}\n`
    })
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

const json = (body, status = 200) => Response.json(body, { status });

function withHeaders(response, extra = {}) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) res.headers.set(k, v);
  return res;
}

async function handleForm(request, env, ctx, url) {
  if (!String(request.headers.get("content-type") || "").includes("application/json")) {
    return json({ error: "Unsupported content type." }, 415);
  }
  if (env.FORM_LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.FORM_LIMITER.limit({ key: `${url.pathname}:${ip}` });
    if (!success) return json({ error: "Too many requests — please try again in a minute." }, 429);
  }
  const body = await request.json().catch(() => ({}));
  // Honeypot: real people never see or fill the "website" field.
  if (body.website) return json({ ok: true }, 201);
  const email = String(body.email || body.contact || "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (url.pathname === "/subscribe") {
    if (!env.BEEHIIV_API_KEY) return json({ error: "Newsletter is not configured yet." }, 503);
    try { const result = await beehiivSubscribe(email, "newsletter", env); return json({ ok: true, status: result.status }); }
    catch { return json({ error: "Subscription failed. Please try again." }, 502); }
  }
  const name = String(body.name || "").trim().slice(0, 90);
  if (!name) return json({ error: "Please tell us your name." }, 400);
  const plan = PLANS.includes(body.plan) ? body.plan : "";
  const lead = { name, email, plan, phone: String(body.phone || "").trim().slice(0, 40), firstSale: String(body.firstSale || "").trim().slice(0, 800) };
  ctx.waitUntil(Promise.allSettled([sendLeadEmail(lead, env), beehiivSubscribe(email, plan ? `social-${plan}` : "founder-form", env)]));
  return json({ ok: true }, 201);
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  if (url.hostname === "www.mahjongers.com") return Response.redirect(`https://mahjongers.com${url.pathname}${url.search}`, 301);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname); // wrangler dev
  if (url.hostname !== "mahjongers.com" && !url.hostname.endsWith(".workers.dev") && !local) return new Response("This service has been retired.", { status: 410 });

  if (request.method === "POST" && ["/subscribe", "/founder-access"].includes(url.pathname)) return handleForm(request, env, ctx, url);
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });

  // One URL per page: /index.html, /join.html, trailing slashes → the clean path.
  const clean = Object.entries(PAGES).find(([, file]) => file === url.pathname)?.[0]
    ?? (url.pathname.length > 1 && url.pathname.endsWith("/") && PAGES[url.pathname.slice(0, -1)] ? url.pathname.slice(0, -1) : null);
  if (clean) return Response.redirect(`https://mahjongers.com${clean}${url.search}`, 301);
  if (url.pathname === "/favicon.ico") return Response.redirect("https://mahjongers.com/assets/favicon.svg", 301);

  if (RETIRED_PREFIXES.some((p) => url.pathname.startsWith(p))) return notFound(request, env, url, 410);

  const target = new URL(url);
  if (PAGES[url.pathname]) target.pathname = PAGES[url.pathname];
  const response = await env.ASSETS.fetch(new Request(target, request));
  if (response.status === 404) return notFound(request, env, url, 404);
  if (url.pathname.startsWith("/assets/")) return withHeaders(response, { "Cache-Control": "public, max-age=604800" });
  return withHeaders(response);
}

async function notFound(request, env, url, status) {
  const page = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
  return withHeaders(new Response(page.body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } }));
}

export default {
  // DataFast bot-traffic tracking (AI answers / indexing / training crawlers).
  // Runs here, server-side, because crawlers skip the browser script.
  fetch: withAICrawlerTracking(async (request, env, ctx) => {
    const response = await handle(request, env, ctx);
    // Redirects and form replies get the security headers too.
    return response.headers.has("Strict-Transport-Security") ? response : withHeaders(response);
  }, { websiteId: "dfid_NuT1rP5EwI86MnpsZ6DKM" })
};
