// Auto-enrichment — TicketFlow
// Doplňuje data automaticky při výběru akce z Discovery:
// - Kapacita arény (Wikipedia/Wikidata)
// - Počet obyvatel města (GeoNames)
// - Bohatství země (World Bank GDP per capita)
// - Konkurenční akce (Ticketmaster)
// - Ceny lístků (z TM dat)

// -----------------------------------------------
// Sdílený helper — načte wikitext infoboxu stránky podle názvu
// -----------------------------------------------

async function fetchWikitext(searchQuery) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&formatversion=2&origin=*&srlimit=1`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const pageTitle = searchData.query?.search?.[0]?.title;
  if (!pageTitle) return null;

  // formatversion=2 + rvslots=main — nový formát MediaWiki API, starý ["*"] formát už nefunguje
  const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&rvsection=0&format=json&formatversion=2&origin=*`;
  const extractRes = await fetch(extractUrl);
  if (!extractRes.ok) return null;
  const extractData = await extractRes.json();
  const page = extractData.query?.pages?.[0];
  const content = page?.revisions?.[0]?.slots?.main?.content || "";
  return { title: pageTitle, content };
}

// vytáhne první číslo z hodnoty infobox pole (odstraní wiki markup, referenční tagy, čárky)
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

export async function fetchVenueCapacity(venueName, city) {
  if (!venueName) return null;
  try {
    let wiki = await fetchWikitext(`${venueName} ${city || ""}`.trim());
    let capacity = wiki ? extractInfoboxField(wiki.content, [
      "seating_capacity", "capacity", "total_capacity", "broadcast_capacity", "tenants_capacity"
    ]) : null;

    // fallback: zkus jen název místa bez města (někdy přesnější match)
    if (!capacity) {
      wiki = await fetchWikitext(venueName);
      capacity = wiki ? extractInfoboxField(wiki.content, [
        "seating_capacity", "capacity", "total_capacity", "broadcast_capacity", "tenants_capacity"
      ]) : null;
    }

    return capacity && capacity > 100 ? capacity : null;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// 2. Počet obyvatel města — Wikipedia infobox
// (přesunuto z GeoNames — to vyžaduje vlastní registrovaný účet, tohle ne)
// -----------------------------------------------

export async function fetchCityPopulation(cityName, countryName) {
  if (!cityName) return null;
  try {
    const wiki = await fetchWikitext(`${cityName} ${countryName || ""}`.trim());
    if (!wiki) return null;
    const population = extractInfoboxField(wiki.content, [
      "population_total", "population_urban", "population", "pop"
    ]);
    return population && population > 500 ? population : null;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// 3. Bohatství země — World Bank GDP per capita (USD)
// Vrací kategorii: high / medium / low
// -----------------------------------------------

// Statická tabulka — World Bank data 2023, nezmění se každý rok
const GDP_PER_CAPITA = {
  US: 80000, CH: 92000, NO: 89000, DK: 67000, IE: 102000, SE: 55000,
  NL: 57000, AT: 55000, FI: 51000, BE: 51000, DE: 51000, GB: 48000,
  FR: 44000, AU: 64000, CA: 54000, NZ: 47000, JP: 33000, KR: 33000,
  IT: 36000, ES: 32000, CZ: 28000, SK: 23000, PL: 20000, HU: 20000,
  PT: 24000, GR: 21000, RO: 16000, BG: 14000, HR: 20000, SI: 31000,
  EE: 27000, LV: 22000, LT: 24000, TR: 13000, UA: 4500, RU: 12000,
  BR: 9000, MX: 11000, AR: 13000, CL: 16000, CO: 7000, ZA: 6600,
  IN: 2500, CN: 12700, ID: 4900, TH: 7000, VN: 4200, PH: 3600,
  EG: 3700, NG: 2100, KE: 2100, MA: 3700
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

// -----------------------------------------------
// 4. Konkurenční akce — Ticketmaster
// Vrátí seznam jiných akcí ve stejném městě ±7 dní
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
      city: city,
      countryCode: countryCode || "",
      startDateTime: fmt(from),
      endDateTime: fmt(to),
      size: 10,
      sort: "date,asc"
    });

    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const events = data._embedded?.events || [];

    return events
      .filter((e) => e.id !== excludeTmId)
      .map((e) => {
        const attraction = e._embedded?.attractions?.[0];
        return {
          name: attraction?.name || e.name,
          date: e.dates?.start?.localDate,
          venue: e._embedded?.venues?.[0]?.name || ""
        };
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}

// -----------------------------------------------
// 5. Odhad lokální oblíbenosti interpreta
// Spotify popularita + lokalita → hrubý odhad
// -----------------------------------------------

export function estimateLocalPopularity(spotifyPopularity, countryCode) {
  if (spotifyPopularity == null) return null;

  // Anglofonní trhy mají globálně lepší data → střední odhad
  // Místní trhy mohou lišit od globálního Spotify skóre
  const localMarkets = ["CZ", "SK", "PL", "HU", "RO", "BG", "HR", "RS", "SI"];
  const isLocal = localMarkets.includes(countryCode?.toUpperCase());

  if (spotifyPopularity >= 75) return isLocal ? "medium" : "high";
  if (spotifyPopularity >= 50) return isLocal ? "medium" : "medium";
  if (spotifyPopularity >= 30) return isLocal ? "low" : "medium";
  return "low";
}

// -----------------------------------------------
// Hlavní orchestrátor — spustí vše najednou
// -----------------------------------------------

export async function enrichEvent(uid, tmEvent) {
  const results = {
    capacity: null,
    cityPopulation: null,
    countryWealth: null,
    localPopularity: null,
    competingEvents: [],
    enrichedAt: new Date().toISOString()
  };

  // Paralelně co lze
  const [capacity, population, competing] = await Promise.all([
    fetchVenueCapacity(tmEvent.venueName, tmEvent.city),
    fetchCityPopulation(tmEvent.city, tmEvent.country),
    fetchCompetingEvents(uid, {
      city: tmEvent.city,
      countryCode: tmEvent.countryCode,
      eventDate: tmEvent.eventDate,
      excludeTmId: tmEvent.tmId
    })
  ]);

  results.capacity = capacity;
  results.cityPopulation = population;
  results.countryWealth = getCountryWealth(tmEvent.countryCode);
  results.competingEvents = competing;

  if (tmEvent.spotify) {
    results.localPopularity = estimateLocalPopularity(
      tmEvent.spotify.popularity,
      tmEvent.countryCode
    );
  }

  return results;
}
