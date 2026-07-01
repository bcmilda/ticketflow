// Spotify integrace — TicketFlow
// Používá Client Credentials Flow (veřejná data o interpretech, žádný uživatelský souhlas potřeba)
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken = null;
let tokenExpiresAt = 0;

// --- Uložení / načtení klíčů ze settings (Firestore) ---

export async function saveSpotifyKeys(uid, clientId, clientSecret) {
  await setDoc(doc(db, "users", uid, "settings", "spotify"), {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    updatedAt: new Date().toISOString()
  });
  cachedToken = null; // vynutí nové přihlášení s novými klíči
}

export async function getSpotifyKeys(uid) {
  const snap = await getDoc(doc(db, "users", uid, "settings", "spotify"));
  return snap.exists() ? snap.data() : null;
}

export async function hasSpotifyKeys(uid) {
  const keys = await getSpotifyKeys(uid);
  return !!(keys && keys.clientId && keys.clientSecret);
}

// --- Token management ---

async function getAccessToken(uid) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const keys = await getSpotifyKeys(uid);
  if (!keys || !keys.clientId || !keys.clientSecret) {
    throw new Error("NO_KEYS");
  }

  const basic = btoa(`${keys.clientId}:${keys.clientSecret}`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    throw new Error("AUTH_FAILED");
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // o 60s dříve, ať nevypršíme uprostřed requestu
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// --- API volání ---

export async function searchArtists(uid, query, limit = 5) {
  if (!query || query.trim().length < 2) return [];
  const token = await getAccessToken(uid);
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("SEARCH_FAILED");
  const data = await res.json();
  return (data.artists?.items || []).map(mapArtist);
}

export async function getArtist(uid, artistId) {
  const token = await getAccessToken(uid);
  const res = await fetch(`${API_BASE}/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("ARTIST_FETCH_FAILED");
  return mapArtist(await res.json());
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
