import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

// Publication id is not a secret; env var overrides this default.
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUBLICATION_ID || "pub_d6bdfb34-1ff5-4d82-b2e8-b4b1ba95dcc1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
  res.end(JSON.stringify(payload));
}

// Add an email to the Beehiiv newsletter (welcome email + nurture). Returns the
// subscriber status ("active", "validating", "pending", …) for visibility.
async function beehiivSubscribe(email, utmMedium) {
  const apiKey = String(process.env.BEEHIIV_API_KEY || "").trim();
  if (!apiKey) return { skipped: true };
  const response = await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`, {
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

// Alert the team that a founder lead came in. No database — this email (plus the
// Beehiiv subscription for email leads) is the record of the lead.
async function sendLeadEmail(lead) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return;
  const recipients = String(process.env.LEAD_NOTIFY_EMAILS || "hi.mahjongers@gmail.com,nithin@move78.in")
    .split(",").map((e) => e.trim()).filter(Boolean);
  const lines = [
    `Name: ${lead.name || "—"}`,
    `Contact: ${lead.contact || "—"}`,
    lead.firstSale ? `About: ${lead.firstSale}` : "",
    `At: ${new Date().toISOString()}`
  ].filter(Boolean);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LEAD_NOTIFY_FROM || "Mahjongers <leads@mahjongers.com>",
      to: recipients,
      subject: `New founder-access request: ${lead.name || lead.contact}`,
      text: `A new founding creator asked for access.\n\n${lines.join("\n")}\n`
    })
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

// Newsletter signup — forwards the email to Beehiiv server-side.
async function handleSubscribe(req, res) {
  const { email } = await readJsonBody(req);
  const clean = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return sendJson(res, 400, { error: "A valid email is required." });
  if (!process.env.BEEHIIV_API_KEY) return sendJson(res, 503, { error: "Newsletter is not configured yet." });
  try {
    const result = await beehiivSubscribe(clean, "newsletter");
    return sendJson(res, 200, { ok: true, status: result.status });
  } catch {
    return sendJson(res, 502, { error: "Subscription failed. Please try again." });
  }
}

// Founder-access signup — no database. Alerts the team (Resend) and, for email
// leads, subscribes them to the newsletter (Beehiiv). Both fire-and-forget.
async function handleFounderAccess(req, res) {
  const body = await readJsonBody(req);
  const contact = String(body.contact || body.email || "").trim().slice(0, 160);
  if (!contact) return sendJson(res, 400, { error: "An email or WhatsApp number is required." });
  const lead = {
    name: String(body.name || "").trim().slice(0, 90),
    contact,
    firstSale: String(body.firstSale || "").trim().slice(0, 800)
  };
  sendLeadEmail(lead).catch((error) => console.error("Founder email alert failed:", error.message));
  if (EMAIL_RE.test(contact.toLowerCase())) {
    beehiivSubscribe(contact.toLowerCase(), "founder-form").catch((error) => console.error("Founder Beehiiv subscribe failed:", error.message));
  }
  return sendJson(res, 201, { ok: true });
}

http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (req.method === "POST" && pathname === "/subscribe") { handleSubscribe(req, res); return; }
  if (req.method === "POST" && pathname === "/founder-access") { handleFounderAccess(req, res); return; }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405); res.end(); return;
  }

  let filePathname = pathname;
  if (filePathname === "/") filePathname = "/index.html";
  if (filePathname === "/join") filePathname = "/join.html";

  const filePath = path.normalize(path.join(__dirname, filePathname));
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    res.writeHead(403); res.end(); return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    if (req.method === "HEAD") { res.end(); return; }
    res.end(data);
  });
}).listen(PORT, () => console.log(`Landing running on port ${PORT}`));
