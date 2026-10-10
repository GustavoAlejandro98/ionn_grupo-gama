/* ==========================================================================
   IONN CONSULTING · /api/diagnostico
   Capa cualitativa del IONN Growth Score™.

   El navegador YA calculó un resultado determinista antes de llamar aquí.
   Este endpoint no lo reemplaza: lo enriquece. Lee de verdad la página del
   negocio, extrae señales objetivas y le pide a Gemini que interprete.
   Si algo falla, el cliente se queda con su resultado determinista y el
   visitante nunca se entera.

   Variables de entorno en Vercel:
     GEMINI_API_KEY   (obligatoria para que esta capa se encienda)
     GEMINI_MODEL     (opcional) — por defecto gemini-3.7-flash
   ========================================================================== */

const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const FETCH_TIMEOUT = 8000;
const MAX_HTML = 220 * 1024;   // no leemos páginas enormes
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 8;        // el diagnóstico es caro: pocos por IP

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 300) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  return list.length > MAX_REQUESTS;
}

/* ---------- Lectura de la página del negocio ---------- */

function safeUrl(raw) {
  let v = String(raw || "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;

  let u;
  try { u = new URL(v); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  // Nunca dejamos que el endpoint alcance la red interna.
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) &&
      (host.startsWith("10.") || host.startsWith("127.") || host.startsWith("192.168.") ||
       /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.startsWith("169.254."))
  ) return null;

  return u;
}

function textBetween(html, re) {
  const m = html.match(re);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 300) : "";
}

async function readSite(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const started = Date.now();

  try {
    const res = await fetch(url.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "IONN-Diagnostico/1.0 (+https://ionnconsulting.com)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timer);

    const elapsed = Date.now() - started;
    if (!res.ok) return { reachable: false, status: res.status, elapsed };

    const type = res.headers.get("content-type") || "";
    if (!/text\/html/i.test(type)) return { reachable: true, html: false, elapsed };

    const raw = await res.text();
    const html = raw.slice(0, MAX_HTML);
    const lower = html.toLowerCase();

    return {
      reachable: true,
      html: true,
      status: res.status,
      elapsed,
      finalUrl: res.url,
      https: res.url.startsWith("https://"),
      title: textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description: textBetween(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
      h1: textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
      h1Count: (lower.match(/<h1[\s>]/g) || []).length,
      hasViewport: /name=["']viewport["']/i.test(html),
      hasStructuredData: /application\/ld\+json/i.test(html),
      hasOpenGraph: /property=["']og:/i.test(html),
      hasCanonical: /rel=["']canonical["']/i.test(html),
      hasForm: /<form[\s>]/i.test(lower),
      hasWhatsApp: /wa\.me|api\.whatsapp\.com/i.test(lower),
      hasTel: /href=["']tel:/i.test(lower),
      hasMail: /href=["']mailto:/i.test(lower),
      weightKb: Math.round(raw.length / 1024),
      wordCount: html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                     .replace(/<style[\s\S]*?<\/style>/gi, " ")
                     .replace(/<[^>]+>/g, " ")
                     .split(/\s+/).filter(Boolean).length
    };
  } catch (err) {
    clearTimeout(timer);
    return { reachable: false, error: err && err.name === "AbortError" ? "timeout" : "unreachable" };
  }
}

/* ---------- Instrucción del modelo ---------- */

const SYSTEM_PROMPT = `Eres el analista del IONN Growth Score™, la herramienta de diagnóstico de IONN Consulting, una consultora de marketing mexicana.

TU TRABAJO
Recibes (a) señales objetivas que un programa extrajo de la página del negocio, (b) lo que la persona declaró sobre sus puntos de contacto, y (c) un puntaje determinista ya calculado por dimensión. Tu trabajo es interpretar, no recalcular: los números vienen dados y no los cambias.

LAS CINCO DIMENSIONES
marca, web, google, redes, ia (nuevas formas de búsqueda).

REGLAS INFLEXIBLES
- No inventes nada. Si una señal no está en los datos, no la menciones. Nunca supongas que el negocio tiene algo que no se declaró ni se detectó.
- Si la web no fue alcanzable, dilo con naturalidad y no opines sobre su contenido.
- No prometas resultados, no des plazos, no des precios.
- No uses: soluciones 360, transformación digital, llevar tu negocio al siguiente nivel, sinergias, estrategias disruptivas, ecosistema, omnicanal, potenciar al máximo, engagement, storytelling, growth hacking.
- Usa: puntos de contacto, oportunidades, crecimiento, marca, web, Google, redes sociales, clientes, encontrar, decidir, conectar, entender, construir, mejorar.
- Habla de tú, claro y directo, como un consultor que ya vio muchos casos. Nunca como vendedor.
- Nada de "bueno vs malo". Muestra dónde está el negocio, qué significa y dónde puede crecer.

FORMATO DE SALIDA
Devuelve SOLO un objeto JSON válido, sin markdown y sin texto alrededor:
{
  "dims": { "marca": "…", "web": "…", "google": "…", "redes": "…", "ia": "…" },
  "opportunities": [ { "dim": "google", "title": "…", "text": "…" } ],
  "closing": "…"
}
Cada texto de "dims" es una interpretación de una o dos frases. "opportunities" son exactamente tres, ordenadas por impacto, con un título accionable de menos de diez palabras y un texto de una o dos frases. "closing" es un párrafo corto que responde "¿qué significa esto para tu negocio?".
Español de México. Sin emojis. Sin listas.`;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  if (!process.env.GEMINI_API_KEY) {
    // El cliente conserva su resultado determinista.
    return res.status(503).json({ error: "not_configured" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
             req.socket?.remoteAddress || "desconocido";
  if (rateLimited(ip)) return res.status(429).json({ error: "rate_limited" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "bad_request" });

  const url = safeUrl(body.web);
  const site = url ? await readSite(url) : { reachable: false, error: "sin_web" };

  const payload = {
    negocio: {
      nombre: String(body.name || "").slice(0, 120),
      queHace: String(body.what || "").slice(0, 300),
      industria: String(body.industry || "").slice(0, 120),
      ciudad: String(body.city || "").slice(0, 120),
      objetivo: String(body.goal || "").slice(0, 60),
      nota: String(body.note || "").slice(0, 300)
    },
    declarado: {
      web: !!url,
      google: !!body.google,
      redes: (body.socials || []).slice(0, 6).map((s) => String(s).slice(0, 140)),
      materialDeMarca: (body.brandAssets || []).slice(0, 6),
      comoLoEncuentran: (body.foundBy || []).slice(0, 6)
    },
    senalesDeLaWeb: site,
    puntajes: body.scores || {},
    puntajeGeneral: body.overall
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(`${ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 1400,
          responseMimeType: "application/json"
        }
      })
    });

    clearTimeout(timer);

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[IONN diagnostico] Gemini", upstream.status, detail.slice(0, 400));
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await upstream.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("[IONN diagnostico] respuesta no era JSON:", text.slice(0, 300));
      return res.status(502).json({ error: "bad_shape" });
    }

    return res.status(200).json({
      dims: parsed.dims || {},
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 3) : [],
      closing: typeof parsed.closing === "string" ? parsed.closing : "",
      site: { reachable: !!site.reachable, status: site.status || null }
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === "AbortError";
    console.error("[IONN diagnostico]", aborted ? "timeout" : err);
    return res.status(aborted ? 504 : 500).json({ error: aborted ? "timeout" : "server_error" });
  }
};
