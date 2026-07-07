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

  // Jen dnešní a budoucí akce — startDateTime na začátek dnešního dne v UTC
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startDateTime = now.toISOString().split(".")[0] + "Z";

  const params = new URLSearchParams({
    apikey: key,
    countryCode,
    size,
    page,
    sort: "date,asc",
    startDateTime,
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
  const classification = e.classifications?.[0];

  // datum
  const dateStr = e.dates?.start?.localDate || null;
  const timeStr = e.dates?.start?.localTime || null;

  // obrázek — největší dostupný
  const images = (e.images || []).sort((a, b) => (b.width || 0) - (a.width || 0));
  const imageUrl = images[0]?.url || null;

  // Ceny — rozděl podle typu (standard vs VIP), TM je vrací jako pole
  const prices = parsePriceRanges(e.priceRanges || []);

  return {
    // Ticketmaster ID (pro deduplikaci)
    tmId: e.id,
    attractionId: attraction?.id || null, // pro analýzu turné

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
    capacity: null, // TM toto zpravidla nevrátí, doplní se ručně nebo přes Wikipedia

    // Kategorie
    segment: classification?.segment?.name || "",
    genre: classification?.genre?.name || "",
    subGenre: classification?.subGenre?.name || "",

    // Ceny — souhrnné + po sektorech
    ticketPriceMin: prices.overallMin,
    ticketPriceMax: prices.overallMax,
    priceStandardMin: prices.standardMin,
    priceStandardMax: prices.standardMax,
    priceVipMin: prices.vipMin,
    priceVipMax: prices.vipMax,
    currency: prices.currency,

    // URL
    tmUrl: e.url || null,
    imageUrl,

    // Spotify (doplní se až po enrichment)
    spotify: null,

    // Status pro přidání do sledování
    status: "watching"
  };
}

// -----------------------------------------------
// Detail jedné akce — občas obsahuje bohatší data (ceny) než hromadné vyhledávání
// -----------------------------------------------

export async function fetchEventDetails(uid, tmId) {
  const key = await getTmKey(uid);
  if (!key || !tmId) return null;
  try {
    const res = await fetch(`${TM_BASE}/events/${tmId}.json?apikey=${key}`);
    if (!res.ok) return null;
    const e = await res.json();
    const prices = parsePriceRanges(e.priceRanges || []);
    return {
      ticketPriceMin: prices.overallMin,
      ticketPriceMax: prices.overallMax,
      priceStandardMin: prices.standardMin,
      priceStandardMax: prices.standardMax,
      priceVipMin: prices.vipMin,
      priceVipMax: prices.vipMax,
      currency: prices.currency
    };
  } catch {
    return null;
  }
}

function parsePriceRanges(ranges) {
  const out = {
    overallMin: null, overallMax: null,
    standardMin: null, standardMax: null,
    vipMin: null, vipMax: null,
    currency: "EUR"
  };
  if (!ranges.length) return out;

  out.currency = ranges[0].currency || "EUR";

  const allMins = [];
  const allMaxs = [];

  for (const r of ranges) {
    const type = (r.type || "").toLowerCase();
    if (r.min != null) allMins.push(r.min);
    if (r.max != null) allMaxs.push(r.max);

    if (type.includes("vip")) {
      out.vipMin = out.vipMin == null ? r.min : Math.min(out.vipMin, r.min);
      out.vipMax = out.vipMax == null ? r.max : Math.max(out.vipMax, r.max);
    } else {
      // standard / bez typu
      out.standardMin = out.standardMin == null ? r.min : Math.min(out.standardMin, r.min);
      out.standardMax = out.standardMax == null ? r.max : Math.max(out.standardMax, r.max);
    }
  }

  out.overallMin = allMins.length ? Math.min(...allMins) : null;
  out.overallMax = allMaxs.length ? Math.max(...allMaxs) : null;
  return out;
}

// -----------------------------------------------
// Analýza turné — všechny nadcházející akce interpreta
// Vrací: celkový počet koncertů, počet zemí/měst, dny po sobě na stejném místě
// -----------------------------------------------

export async function analyzeTour(uid, attractionId, artistName) {
  const key = await getTmKey(uid);
  if (!key) return null;
  if (!attractionId && !artistName) return null;

  const params = new URLSearchParams({
    apikey: key,
    size: 100,
    sort: "date,asc"
  });
  if (attractionId) params.set("attractionId", attractionId);
  else params.set("keyword", artistName);

  try {
    const res = await fetch(`${TM_BASE}/events.json?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const events = data._embedded?.events || [];
    if (!events.length) return null;

    // Sesbírej datum + místo pro každý koncert
    const shows = events.map((e) => ({
      date: e.dates?.start?.localDate || null,
      city: e._embedded?.venues?.[0]?.city?.name || "",
      country: e._embedded?.venues?.[0]?.country?.countryCode || "",
      venue: e._embedded?.venues?.[0]?.name || ""
    })).filter((s) => s.date);

    const totalShows = shows.length;
    const uniqueCities = new Set(shows.map((s) => s.city).filter(Boolean)).size;
    const uniqueCountries = new Set(shows.map((s) => s.country).filter(Boolean)).size;

    // Detekce více dní po sobě na stejném místě (silný signál poptávky)
    const backToBack = detectBackToBack(shows);

    // Detekce více koncertů ve stejném městě (i nesouvislé)
    const cityCounts = {};
    shows.forEach((s) => { if (s.venue) cityCounts[s.venue] = (cityCounts[s.venue] || 0) + 1; });
    const multiNightVenues = Object.entries(cityCounts)
      .filter(([, count]) => count > 1)
      .map(([venue, count]) => ({ venue, count }));

    return {
      totalShows,
      uniqueCities,
      uniqueCountries,
      backToBack,           // pole { venue, dates: [...] }
      multiNightVenues,     // pole { venue, count }
      analyzedAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

// Najde místa, kde interpret hraje víc dní po sobě (nebo víckrát celkem)
function detectBackToBack(shows) {
  // Seskup podle venue
  const byVenue = {};
  shows.forEach((s) => {
    if (!s.venue) return;
    if (!byVenue[s.venue]) byVenue[s.venue] = [];
    byVenue[s.venue].push(s.date);
  });

  const result = [];
  for (const [venue, dates] of Object.entries(byVenue)) {
    if (dates.length < 2) continue;
    const sorted = [...dates].sort();
    // zkontroluj jestli jsou aspoň dva dny bezprostředně po sobě
    let consecutive = false;
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1] + "T00:00:00");
      const d2 = new Date(sorted[i] + "T00:00:00");
      const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24);
      if (diffDays <= 2) { consecutive = true; break; }
    }
    result.push({ venue, dates: sorted, consecutive });
  }
  return result;
}
