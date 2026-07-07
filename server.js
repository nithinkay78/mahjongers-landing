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

// Newsletter signup — forwards the email to Beehiiv server-side so the API key
// never reaches the browser. Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID
// on this service for it to work.
async function handleSubscribe(req, res) {
  const { email } = await readJsonBody(req);
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return sendJson(res, 400, { error: "A valid email is required." });
  }
  const apiKey = process.env.BEEHIIV_API_KEY;
  // Publication id is not a secret; env var overrides this default.
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID || "pub_d6bdfb34-1ff5-4d82-b2e8-b4b1ba95dcc1";
  if (!apiKey) {
    return sendJson(res, 503, { error: "Newsletter is not configured yet." });
  }
  try {
    const response = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, reactivate_existing: true, send_welcome_email: true, utm_source: "mahjongers.com" })
    });
    if (!response.ok) throw new Error(`Beehiiv ${response.status}`);
    return sendJson(res, 200, { ok: true });
  } catch {
    return sendJson(res, 502, { error: "Subscription failed. Please try again." });
  }
}

http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (req.method === "POST" && pathname === "/subscribe") {
    handleSubscribe(req, res);
    return;
  }
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
