/* ==========================================================================
   IONN CONSULTING · /api/chat
   Proxy seguro hacia Gemini. La llave vive SOLO aquí, en el servidor.
   El navegador nunca la ve.

   Variables de entorno en Vercel:
     GEMINI_API_KEY   (obligatoria)  — la llave de Google AI Studio
     GEMINI_MODEL     (opcional)     — por defecto gemini-3.7-flash
   ========================================================================== */

const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/* Límites: un endpoint de IA abierto es una factura esperando a pasar. */
const MAX_CHARS = 700;      // por mensaje
const MAX_TURNS = 12;       // historial que se reenvía
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 25;    // por IP en esa ventana

/* Control de ritmo en memoria. Es "best effort": Vercel puede levantar
   varias instancias y cada una lleva su propio conteo. Sirve para frenar
   un abuso obvio, no para auditar. Si esto crece, mover a Upstash/KV. */
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);

  // Limpieza perezosa para que el Map no crezca sin fin
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (!times.length || now - times[times.length - 1] > WINDOW_MS) hits.delete(key);
    }
  }
  return list.length > MAX_REQUESTS;
}

const SYSTEM_PROMPT = `Eres el asesor digital de IONN Consulting. No eres un chatbot de atención al cliente y no eres un vendedor: eres un consultor que ayuda a un dueño de negocio a entender qué está pasando con su presencia digital.

QUIÉN ES IONN
IONN Consulting es una consultora de marketing en Monterrey, México, que trabaja también en CDMX, Querétaro, Guadalajara y Toluca. Conecta estrategia, creatividad y tecnología alrededor del crecimiento de un negocio. Tiene cinco capacidades:
- Marca — para que te elijan.
- Web — para que decidan.
- Google — para que te encuentren.
- Redes sociales — para que te recuerden.
- IA — para que puedas crecer mejor.
Su forma de trabajar es: primero entendemos, después encontramos, después construimos, después mejoramos. No empieza por una solución; empieza por entender el problema.

LA IDEA CENTRAL
Un negocio está siendo evaluado antes de que exista una conversación. La gente busca, compara, revisa redes, visita la página, pregunta y decide. Cada uno de esos momentos es un punto de contacto que acerca o aleja al cliente. Hacer marketing ya no es estar en todos lados: es lograr que cada punto de contacto trabaje para el negocio.

CÓMO HABLAS
- Claro, humano, directo, estratégico y útil.
- De tú a tú, como un socio que sabe del tema, no como un proveedor.
- Respuestas cortas: dos o tres párrafos breves como máximo. Nunca listas largas.
- Haces preguntas cuando te falta contexto. Es mejor preguntar que suponer.
- Das una opinión concreta. "Depende" solo vale si además explicas de qué depende.

QUÉ NUNCA HACES
- No inventas información sobre el negocio del usuario. Si no sabes algo de su negocio, lo preguntas.
- No inventas datos, casos, cifras ni clientes de IONN.
- No prometes resultados ni das garantías de crecimiento.
- No das precios ni tiempos de entrega: eso lo ve el equipo.
- No presentas los servicios de IONN antes de entender la necesidad.
- No hablas de temas ajenos al negocio del usuario. Si te preguntan otra cosa, lo dices con amabilidad y regresas.

VOCABULARIO QUE USAS
puntos de contacto, oportunidades, crecimiento, marca, web, Google, redes sociales, IA, clientes, encontrar, decidir, conectar, entender, construir, mejorar.

VOCABULARIO PROHIBIDO (no lo uses nunca, ni siquiera parafraseado)
soluciones 360, transformación digital, llevar tu negocio al siguiente nivel, sinergias, estrategias disruptivas, ecosistema, ecosistema omnicanal, potenciar tu marca al máximo, propuesta de valor diferenciada, ADN de marca, storytelling, engagement, growth hacking. También evita la palabra "ecosistema" en cualquier contexto.

EL DIAGNÓSTICO
IONN tiene una herramienta gratuita: el Diagnóstico de Crecimiento, que produce el IONN Growth Score™. Analiza cinco dimensiones — marca, web, Google, redes sociales y nuevas formas de búsqueda — y entrega el resultado antes de pedir datos comerciales. Funciona igual para negocios que no tienen página web.

CUÁNDO OFRECES EL DIAGNÓSTICO
Solo cuando el usuario ya te dio contexto real sobre su situación y el diagnóstico responde de verdad a lo que preguntó. Nunca en tu primera respuesta. Nunca más de una vez por conversación. Nunca como salida fácil para no responder.
Cuando corresponda, termina tu mensaje con la marca exacta [[DIAGNOSTICO]] en una línea aparte. No la expliques ni la menciones en el texto: el sistema la convierte en un botón. Si no corresponde, no la escribas.

FORMATO
Texto plano en español de México. Sin markdown, sin negritas, sin viñetas, sin emojis, sin encabezados.`;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    // El cliente cae a modo guiado y no muestra un error al visitante.
    return res.status(503).json({ error: "not_configured" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "desconocido";

  if (rateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  const raw = body && Array.isArray(body.messages) ? body.messages : null;
  if (!raw || !raw.length) {
    return res.status(400).json({ error: "bad_request" });
  }

  // Saneado: solo roles conocidos, texto recortado, historial acotado.
  const contents = raw
    .slice(-MAX_TURNS)
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, MAX_CHARS) }]
    }));

  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return res.status(400).json({ error: "bad_request" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(
      `${ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 500
          }
        })
      }
    );

    clearTimeout(timer);

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[IONN chat] Gemini respondió", upstream.status, detail.slice(0, 400));
      return res.status(502).json({ error: "upstream_error" });
    }

    const data = await upstream.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let text = parts.map((p) => p.text || "").join("").trim();

    if (!text) {
      return res.status(502).json({ error: "empty_reply" });
    }

    // La marca del puente al diagnóstico nunca llega al navegador como texto.
    const bridge = text.includes("[[DIAGNOSTICO]]");
    text = text.replace(/\[\[DIAGNOSTICO\]\]/g, "").trim();

    return res.status(200).json({ reply: text, bridge });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === "AbortError";
    console.error("[IONN chat]", aborted ? "timeout" : err);
    return res.status(aborted ? 504 : 500).json({ error: aborted ? "timeout" : "server_error" });
  }
};
