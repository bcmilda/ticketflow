// TicketFlow — AI proxy Worker
// Drží ANTHROPIC_API_KEY a PROXY_SECRET jako Cloudflare secrets (nikdy ve frontend kódu).
// Frontend posílá data události, Worker zavolá Claude API a vrátí strukturovanou JSON analýzu.

const ALLOWED_ORIGINS = [
  "https://ticketflow-8e17a.web.app",
  "https://ticketflow-8e17a.firebaseapp.com",
  "http://localhost:5000"
];

const MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `Jsi zkušený analytik trhu se vstupenkami (koncerty, sportovní akce) pro reselling.
Uživatel ti pošle strukturovaná data o sledované události (interpret/akce, místo, kapacita, ceny,
signály poptávky) včetně volných textových poznámek a algoritmického skóre, které si spočítal sám
z číselných a výběrových polí.

Tvůj úkol:
1. Vezmi v úvahu VŠECHNA data, včetně volných poznámek (chartNotes, competingEvents,
   secondaryMarketNote, viagogoNote, newAlbumNote) — algoritmické skóre je nedokáže vyhodnotit,
   protože je to text, ne číslo.
2. Pokud máš k dispozici web search, použij ho k doplnění aktuálních informací o interpretovi
   nebo akci (nedávné zprávy, vyprodané termíny, recenze, poptávka), pokud to pomůže přesnosti.
3. Navrhni vlastní skóre atraktivity 0–100 — klidně se odchyl od algoritmického skóre, pokud pro
   to máš věcný důvod, a ten důvod vysvětli.
4. Vyjmenuj konkrétní rizika tohoto konkrétního obchodu.
5. Navrhni doplňková kritéria nebo věci, které by uživatel měl ještě ručně zkontrolovat, a která
   nejsou pokrytá datovým modelem, jenž dostáváš.

Odpověz VÝHRADNĚ jedním validním JSON objektem, bez markdown bloků, bez uvozujícího textu, přesně v tomto tvaru:
{
  "score": <číslo 0-100>,
  "label": "<max 4 slova, česky, např. 'Vysoký potenciál se sledovaným rizikem'>",
  "reasoning": "<2-4 věty, česky, věcné zdůvodnění skóre>",
  "risks": ["<riziko 1>", "<riziko 2>"],
  "additionalChecks": ["<co ještě zkontrolovat 1>", "<co ještě zkontrolovat 2>"],
  "confidence": "high" | "medium" | "low"
}`;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Key",
    "Access-Control-Max-Age": "86400"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    const proxyKey = request.headers.get("X-Proxy-Key");
    if (!proxyKey || proxyKey !== env.PROXY_SECRET) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const { event, algoScore, useWebSearch } = payload || {};
    if (!event) {
      return json({ error: "Missing 'event' in body" }, 400, cors);
    }

    const userMessage = buildUserMessage(event, algoScore);

    const anthropicBody = {
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    };

    if (useWebSearch) {
      anthropicBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify(anthropicBody)
      });
    } catch (err) {
      return json({ error: "Nepodařilo se spojit s Claude API: " + err.message }, 502, cors);
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      return json({ error: `Claude API chyba (${anthropicRes.status}): ${errText.slice(0, 300)}` }, 502, cors);
    }

    const data = await anthropicRes.json();
    const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text);
    const rawText = textBlocks.join("\n").trim();

    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ error: "Claude nevrátil validní JSON", raw: rawText.slice(0, 500) }, 502, cors);
    }

    return json(parsed, 200, cors);
  }
};

function buildUserMessage(event, algoScore) {
  const parts = [
    "Vyhodnoť tuto sledovanou událost pro ticket reselling.",
    "",
    "DATA UDÁLOSTI (JSON):",
    JSON.stringify(event, null, 2)
  ];
  if (algoScore) {
    parts.push("", "ALGORITMICKÉ SKÓRE (spočítané klientem ze strukturovaných polí, pro referenci):", JSON.stringify(algoScore, null, 2));
  }
  return parts.join("\n");
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}
