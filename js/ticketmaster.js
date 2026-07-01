// Ticketmaster Discovery API — TicketFlow
// Consumer Key se ukládá do Firestore (stejně jako Spotify klíče)
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

export async function saveTmKey(uid, apiKey) {
  await setDoc(doc(db, "users", uid, "settings", "ticketmaster"), {
    apiKey: apiKey.trim(),
    updatedAt: new Date().toISOString()
  });
}

export async function getTmKey(uid) {
  const snap = await getDoc(doc(db, "users", uid, "settings", "ticketmaster"));
  return snap.exists() ? snap.data().apiKey : null;
}

export async function hasTmKey(uid) {
  const k = await getTmKey(uid);
  return !!k;
}

// Hlavní vyhledávání akcí
// countryCode: "CZ","SK","DE","AT","PL" atd.
// segment: "Music" | "Sports" | "" (vše)
export async function searchEvents(uid, { countryCode = "CZ", segment = "Music", keyword = "", page = 0, size = 20 } = {}) {
  const key = await getTmKey(uid);
  if (!key) throw new Error("NO_TM_KEY");

  const params = new URLSearchParams({
    apikey: key,
    countryCode,
    size,
    page,
    sort: "date,asc",
    ...(segment ? { segmentName: segment } : {}),
    ...(keyword ? { keyword } : {})
  });

  const res = await fetch(`${TM_BASE}/events.json?${params}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`TM_API_ERROR (${res.status}): ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data._embedded?.events || [];
  const total = data.page?.totalElements || 0;
  const totalPages = data.page?.totalPages || 1;

  return {
    events: raw.map(mapEvent),
    total,
    totalPages,
    page: data.page?.number || 0
  };
}

function mapEvent(e) {
  const venue = e._embedded?.venues?.[0];
  const attraction = e._embedded?.attractions?.[0];
  const priceRange = e.priceRanges?.[0];
  const classification = e.classifications?.[0];

  // datum
  const dateStr = e.dates?.start?.localDate || null;
  const timeStr = e.dates?.start?.localTime || null;

  // obrázek — největší dostupný
  const images = (e.images || []).sort((a, b) => (b.width || 0) - (a.width || 0));
  const imageUrl = images[0]?.url || null;

  return {
    // Ticketmaster ID (pro deduplikaci)
    tmId: e.id,

    // Základní info
    artistName: attraction?.name || e.name || "Neznámý",
    eventName: e.name || "",
    eventDate: dateStr,
    eventTime: timeStr,

    // Místo
    venueName: venue?.name || "",
    city: venue?.city?.name || "",
    country: venue?.country?.name || "",
    countryCode: venue?.country?.countryCode || "",
    capacity: null, // TM toto zpravidla nevrátí, doplní se ručně nebo přes Atlas

    // Kategorie
    segment: classification?.segment?.name || "",
    genre: classification?.genre?.name || "",
    subGenre: classification?.subGenre?.name || "",

    // Ceny (pokud jsou v API)
    ticketPriceMin: priceRange?.min || null,
    ticketPriceMax: priceRange?.max || null,
    currency: priceRange?.currency || "EUR",

    // URL
    tmUrl: e.url || null,
    imageUrl,

    // Spotify (doplní se až po enrichment)
    spotify: null,

    // Status pro přidání do sledování
    status: "watching"
  };
}
