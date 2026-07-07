// Spotify integrace — TicketFlow
// Volá se přes Cloudflare Worker proxy (viz cloudflare-worker/ticketflow-spotify-proxy.js).
// Client Credentials Flow je server-to-server a Spotify ho z prohlížeče přes CORS
// spolehlivě nepovoluje — proto token exchange i vyhledávání běží na Workeru, ne tady.
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

// --- Uložení / načtení nastavení proxy (Worker URL + shared secret) ---

export async function saveSpotifyKeys(uid, workerUrl, proxyKey) {
  await setDoc(doc(db, "users", uid, "settings", "spotify"), {
    workerUrl: workerUrl.trim(),
    proxyKey: proxyKey.trim(),
    updatedAt: new Date().toISOString()
  });
}

export async function getSpotifyKeys(uid) {
  const snap = await getDoc(doc(db, "users", uid, "settings", "spotify"));
  return snap.exists() ? snap.data() : null;
}

export async function hasSpotifyKeys(uid) {
  const keys = await getSpotifyKeys(uid);
  return !!(keys && keys.workerUrl && keys.proxyKey);
}

// --- API volání přes proxy ---

async function callProxy(uid, params) {
  const settings = await getSpotifyKeys(uid);
  if (!settings || !settings.workerUrl || !settings.proxyKey) {
    throw new Error("NO_KEYS");
  }
  const url = `${settings.workerUrl}?${params}`;
  let res;
  try {
    res = await fetch(url, { headers: { "X-Proxy-Key": settings.proxyKey } });
  } catch (err) {
    throw new Error("PROXY_NETWORK_ERROR: " + err.message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PROXY_ERROR (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function searchArtists(uid, query, limit = 5) {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({ action: "search", q: query, limit: String(limit) });
  const data = await callProxy(uid, params);
  if (data.error) throw new Error(data.error);
  return data.artists || [];
}

export async function getArtist(uid, artistId) {
  const params = new URLSearchParams({ action: "artist", id: artistId });
  const data = await callProxy(uid, params);
  if (data.error) throw new Error(data.error);
  return data;
}
