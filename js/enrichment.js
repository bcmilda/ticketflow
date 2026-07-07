// Auto-enrichment — TicketFlow
// Doplňuje data automaticky při výběru akce z Discovery.
// Zdroje (všechny zdarma, CORS-friendly z prohlížeče):
// - Kapacita arény: Wikipedia infobox (origin=* CORS)
// - Počet obyvatel města: Wikipedia infobox
// - Populace + bohatství země: REST Countries API (spolehlivé, structured)
// - Konkurenční akce: Ticketmaster
//
// Pozn.: enrichment je "best effort" — když zdroj selže, pole zůstane prázdné
// a uživatel ho doplní ručně. Nikdy neblokuje uložení.

const WIKI_UA = "TicketFlow/1.0";

// -----------------------------------------------
// Wikipedia helper — hledá stránku a vrací wikitext úvodní sekce
// origin=* je nutné pro CORS z prohlížeče
// -----------------------------------------------

async function fetchWikitext(searchQuery) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&formatversion=2&origin=*&srlimit=1`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const pageTitle = searchData.query?.search?.[0]?.title;
    if (!pageTitle) return null;

    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&rvsection=0&format=json&formatversion=2&origin=*`;
    const extractRes = await fetch(extractUrl);
    if (!extractRes.ok) return null;
    const extractData = await extractRes.json();
    const page = extractData.query?.pages?.[0];
    const content = page?.revisions?.[0]?.slots?.main?.content || "";
    return { title: pageTitle, content };
  } catch {
    return null;
  }
}

function extractFirstNumber(rawValue) {
  const cleaned = rawValue
    .replace(/<ref[^>]*>.*?<\/ref>/gis, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/<[^>]+>/g, "");
  const match = cleaned.match(/[\d][\d,.\s]*\d|\d/);
  if (!match) return null;
  const num = parseInt(match[0].replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? null : num;
}

function extractInfoboxField(content, fieldNames) {
  for (const field of fieldNames) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, "i");
    const match = content.match(re);
    if (match) {
      const num = extractFirstNumber(match[1]);
      if (num) return num;
    }
  }
  return null;
}

// -----------------------------------------------
// 1. Kapacita arény — Wikipedia infobox
// -----------------------------------------------

const CAPACITY_FIELDS = ["seating_capacity", "capacity", "total_capacity", "broadcast_capacity", "arena_capacity"];

export async function fetchVenueCapacity(venueName, city) {
  if (!venueName) return null;

  let wiki = await fetchWikitext(`${venueName} ${city || ""} arena`.trim());
  let capacity = wiki ? extractInfoboxField(wiki.content, CAPACITY_FIELDS) : null;

  if (!capacity) {
    wiki = await fetchWikitext(venueName);
    capacity = wiki ? extractInfoboxField(wiki.content, CAPACITY_FIELDS) : null;
  }

  return capacity && capacity > 100 && capacity < 500000 ? capacity : null;
}

// -----------------------------------------------
// 2. Počet obyvatel města — Wikipedia infobox
// -----------------------------------------------

const POPULATION_FIELDS = ["population_total", "population_urban", "population_metro", "population", "pop"];

export async function fetchCityPopulation(cityName, countryName) {
  if (!cityName) return null;

  // Očisti název města od číslic obvodů (Praha 8 -> Praha)
  const cleanCity = cityName.replace(/\s+\d+$/, "").trim();

  let wiki = await fetchWikitext(`${cleanCity} ${countryName || ""} city`.trim());
  let pop = wiki ? extractInfoboxField(wiki.content, POPULATION_FIELDS) : null;

  if (!pop) {
    wiki = await fetchWikitext(cleanCity);
    pop = wiki ? extractInfoboxField(wiki.content, POPULATION_FIELDS) : null;
  }

  return pop && pop > 500 ? pop : null;
}

// -----------------------------------------------
// 3. Data o zemi — REST Countries API (populace, HDP proxy)
// Spolehlivý structured zdroj, CORS povolené
// -----------------------------------------------

// HDP per capita (USD, World Bank 2023) — fallback tabulka i kategorizace
const GDP_PER_CAPITA = {
  US: 80000, CH: 92000, NO: 89000, DK: 67000, IE: 102000, SE: 55000,
  NL: 57000, AT: 55000, FI: 51000, BE: 51000, DE: 51000, GB: 48000,
  FR: 44000, AU: 64000, CA: 54000, NZ: 47000, JP: 33000, KR: 33000,
  IT: 36000, ES: 32000, CZ: 28000, SK: 23000, PL: 20000, HU: 20000,
  PT: 24000, GR: 21000, RO: 16000, BG: 14000, HR: 20000, SI: 31000,
  EE: 27000, LV: 22000, LT: 24000, TR: 13000, UA: 4500, RU: 12000,
  BR: 9000, MX: 11000, AR: 13000, CL: 16000, CO: 7000, ZA: 6600,
  IN: 2500, CN: 12700, ID: 4900, TH: 7000, VN: 4200, PH: 3600,
  IS: 79000, LU: 128000, MT: 34000, CY: 32000
};

export function getCountryWealth(countryCode) {
  const gdp = GDP_PER_CAPITA[countryCode?.toUpperCase()];
  if (!gdp) return null;
  if (gdp >= 40000) return "high";
  if (gdp >= 18000) return "medium";
  return "low";
}

export function getCountryGdp(countryCode) {
  return GDP_PER_CAPITA[countryCode?.toUpperCase()] || null;
}

// REST Countries — populace celé země (užitečná jako proxy velikosti trhu)
export async function fetchCountryData(countryCode) {
  if (!countryCode) return null;
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=population,name,region`);
    if (!res.ok) return null;
    const data = await res.json();
    const c = Array.isArray(data) ? data[0] : data;
    return {
      countryPopulation: c?.population || null,
      region: c?.region || null
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------
// 4. Konkurenční akce — Ticketmaster
// -----------------------------------------------

export async function fetchCompetingEvents(uid, { city, countryCode, eventDate, excludeTmId }) {
  if (!city || !eventDate) return [];
  try {
    const { getTmKey } = await import("./ticketmaster.js");
    const key = await getTmKey(uid);
    if (!key) return [];

    const date = new Date(eventDate + "T00:00:00");
    const from = new Date(date); from.setDate(from.getDate() - 7);
    const to = new Date(date); to.setDate(to.getDate() + 7);
    const fmt = (d) => d.toISOString().split("T")[0] + "T00:00:00Z";

    const params = new URLSearchParams({
      apikey: key,
      city,
      countryCode: countryCode || "",
      startDateTime: fmt(from),
      endDateTime: fmt(to),
      size: 15,
      sort: "date,asc"
    });

    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const events = data._embedded?.events || [];

    return events
      .filter((e) => e.id !== excludeTmId)
      .map((e) => ({
        name: e._embedded?.attractions?.[0]?.name || e.name,
        date: e.dates?.start?.localDate,
        venue: e._embedded?.venues?.[0]?.name || ""
      }))
      .slice(0, 6);
  } catch {
    return [];
  }
}

// -----------------------------------------------
// 5. Odhad lokální oblíbenosti
// -----------------------------------------------

export function estimateLocalPopularity(spotifyPopularity, countryCode) {
  if (spotifyPopularity == null) return null;
  const localMarkets = ["CZ", "SK", "PL", "HU", "RO", "BG", "HR", "RS", "SI"];
  const isLocal = localMarkets.includes(countryCode?.toUpperCase());

  if (spotifyPopularity >= 75) return isLocal ? "medium" : "high";
  if (spotifyPopularity >= 50) return "medium";
  if (spotifyPopularity >= 30) return isLocal ? "low" : "medium";
  return "low";
}

// -----------------------------------------------
// Hlavní orchestrátor — vrací i "sources" (co se povedlo načíst)
// -----------------------------------------------

export async function enrichEvent(uid, tmEvent) {
  const results = {
    capacity: null,
    cityPopulation: null,
    countryPopulation: null,
    countryWealth: null,
    localPopularity: null,
    competingEvents: [],
    sources: { capacity: false, cityPopulation: false, country: false, competing: false },
    enrichedAt: new Date().toISOString()
  };

  const [capacity, cityPop, competing] = await Promise.all([
    fetchVenueCapacity(tmEvent.venueName, tmEvent.city),
    fetchCityPopulation(tmEvent.city, tmEvent.country),
    fetchCompetingEvents(uid, {
      city: tmEvent.city,
      countryCode: tmEvent.countryCode,
      eventDate: tmEvent.eventDate,
      excludeTmId: tmEvent.tmId
    })
  ]);

  if (capacity) { results.capacity = capacity; results.sources.capacity = true; }
  if (cityPop) { results.cityPopulation = cityPop; results.sources.cityPopulation = true; }

  results.countryWealth = getCountryWealth(tmEvent.countryCode);

  if (competing.length) { results.competingEvents = competing; results.sources.competing = true; }

  if (tmEvent.spotify) {
    results.localPopularity = estimateLocalPopularity(tmEvent.spotify.popularity, tmEvent.countryCode);
  }

  return results;
}
