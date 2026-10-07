/**
 * Stiltz of Florida consultation-form endpoint.
 *
 * Cloudflare dashboard setup required after pasting this code:
 *   1. Add a Send Email binding named EMAIL.
 *   2. Restrict it to destination heather@stiltzfl.com.
 *   3. Verify/onboard stiltzofflorida.com as a sender domain, then use
 *      forms@stiltzofflorida.com below (or change FORM_SENDER).
 *
 * Do not add Email Routing or replace MX records solely for this Worker.
 */
const ALLOWED_ORIGINS = new Set([
  "https://stiltzofflorida.com",
  "https://www.stiltzofflorida.com",
  "https://fletchvibezmedia.github.io",
]);

const FORM_SENDER = "forms@stiltzofflorida.com";
const FORM_RECIPIENT = "heather@stiltzfl.com";

function corsHeaders(origin) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(body, status = 200, origin = "") {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value, limit = 2000) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, limit);
}

function htmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method === "GET") return json({ ok: true, service: "stiltz-form-handler" }, 200, origin);
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, origin);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid form data" }, 400, origin);
    }

    if (clean(payload.website, 200)) return json({ ok: true }, 200, origin); // honeypot
    const name = clean(payload.name || payload.fullName || payload["full-name"], 160);
    const email = clean(payload.email, 254).toLowerCase();
    const phone = clean(payload.phone || payload.telephone, 80);
    const message = clean(payload.message || payload.comments || payload.notes, 4000);

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Please provide your name and a valid email address." }, 400, origin);
    }

    const fields = Object.entries(payload)
      .filter(([key, value]) => !["website", "name", "fullName", "full-name", "email", "phone", "telephone", "message", "comments", "notes"].includes(key) && clean(value, 1000))
      .map(([key, value]) => [clean(key, 100), clean(value, 1000)])
      .slice(0, 20);

    const textLines = [
      "New Stiltz of Florida consultation request",
      "",
      "Name: " + name,
      "Email: " + email,
      phone ? "Phone: " + phone : "",
      message ? "Message: " + message : "",
      ...fields.map(([key, value]) => key.replace(/[-_]/g, " ") + ": " + value),
    ].filter(Boolean);

    const htmlRows = textLines.map((line) => "<p>" + htmlEscape(line) + "</p>").join("");

    try {
      await env.EMAIL.send({
        to: FORM_RECIPIENT,
        from: { email: FORM_SENDER, name: "Stiltz of Florida Website" },
        replyTo: { email, name },
        subject: "New consultation request — " + name,
        text: textLines.join("\n"),
        html: htmlRows,
      });
      return json({ ok: true }, 200, origin);
    } catch (error) {
      console.error("Form email delivery failed", error?.code, error?.message);
      return json({ ok: false, error: "We could not send your request. Please call us instead." }, 502, origin);
    }
  },
};
