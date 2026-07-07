// TicketFlow — Spotify proxy Worker
// Client Credentials Flow je určený pro server-to-server komunikaci — Spotify ho z prohlížeče
// přes CORS spolehlivě nepovoluje. Tento Worker dělá token exchange a vyhledávání na serveru,
// takže frontend nikdy nemluví s accounts.spotify.com/api.spotify.com přímo.
//
// Cloudflare secrets potřebné: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PROXY_SECRET

const ALLOWED_ORIGINS = [
  "https://ticketflow-8e17a.web.app",
  "https://ticketflow-8e17a.firebaseapp.com",
  "http://localhost:5000",
  "http://localhost:8080"
];

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken = null;
let tokenExpiresAt = 0;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Key",
    "Access-Control-Max-Age": "86400"
  };
}

async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error(`Spotify token chyba (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

function mapArtist(a) {
  return {
    id: a.id,
    name: a.name,
    popularity: a.popularity ?? null,
    followers: a.followers?.total ?? null,
    genres: a.genres || [],
    imageUrl: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url || null,
    spotifyUrl: a.external_urls?.spotify || null,
    fetchedAt: new Date().toISOString()
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const proxyKey = request.headers.get("X-Proxy-Key");
    if (!proxyKey || proxyKey !== env.PROXY_SECRET) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action"); // "search" | "artist"

    try {
      const token = await getAccessToken(env);

      if (action === "search") {
        const q = url.searchParams.get("q") || "";
        const limit = url.searchParams.get("limit") || "5";
        if (q.trim().length < 2) return json({ artists: [] }, 200, cors);

        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(q)}&type=artist&limit=${limit}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return json({ error: `Spotify search chyba (${res.status})` }, 502, cors);
        const data = await res.json();
        const artists = (data.artists?.items || []).map(mapArtist);
        return json({ artists }, 200, cors);
      }

      if (action === "artist") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "Missing id" }, 400, cors);
        const res = await fetch(`${API_BASE}/artists/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return json({ error: `Spotify artist chyba (${res.status})` }, 502, cors);
        const artist = mapArtist(await res.json());
        return json(artist, 200, cors);
      }

      return json({ error: "Unknown action — použij ?action=search nebo ?action=artist" }, 400, cors);
    } catch (err) {
      return json({ error: err.message }, 502, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}
