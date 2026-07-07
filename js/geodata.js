// Databáze zemí a měst — TicketFlow
// Statická data pro analýzu trhu (nemění se často, žádné API potřeba)
// Zdroje: World Bank (HDP), World Happiness Report 2024, Numbeo (kupní síla)

// -----------------------------------------------
// ZEMĚ — HDP per capita, index štěstí, kupní síla
// -----------------------------------------------
// gdp: HDP per capita v USD (World Bank 2023)
// happiness: World Happiness Report 2024 skóre (0-10)
// purchasingPower: relativní kupní síla (100 = průměr EU)

export const COUNTRIES = {
  CZ: { name: "Česko", gdp: 28000, happiness: 6.85, purchasingPower: 68, currency: "CZK", eur: 24.66 },
  SK: { name: "Slovensko", gdp: 23000, happiness: 6.47, purchasingPower: 58, currency: "EUR", eur: 1 },
  AT: { name: "Rakousko", gdp: 55000, happiness: 7.10, purchasingPower: 95, currency: "EUR", eur: 1 },
  DE: { name: "Německo", gdp: 51000, happiness: 6.89, purchasingPower: 98, currency: "EUR", eur: 1 },
  PL: { name: "Polsko", gdp: 20000, happiness: 6.44, purchasingPower: 56, currency: "PLN", eur: 4.32 },
  HU: { name: "Maďarsko", gdp: 20000, happiness: 6.02, purchasingPower: 52, currency: "HUF", eur: 395 },
  CH: { name: "Švýcarsko", gdp: 92000, happiness: 7.06, purchasingPower: 130, currency: "CHF", eur: 0.95 },
  GB: { name: "Velká Británie", gdp: 48000, happiness: 6.75, purchasingPower: 100, currency: "GBP", eur: 0.84 },
  IE: { name: "Irsko", gdp: 102000, happiness: 6.84, purchasingPower: 110, currency: "EUR", eur: 1 },
  NL: { name: "Nizozemsko", gdp: 57000, happiness: 7.32, purchasingPower: 105, currency: "EUR", eur: 1 },
  BE: { name: "Belgie", gdp: 51000, happiness: 6.90, purchasingPower: 98, currency: "EUR", eur: 1 },
  FR: { name: "Francie", gdp: 44000, happiness: 6.66, purchasingPower: 92, currency: "EUR", eur: 1 },
  ES: { name: "Španělsko", gdp: 32000, happiness: 6.42, purchasingPower: 78, currency: "EUR", eur: 1 },
  PT: { name: "Portugalsko", gdp: 24000, happiness: 6.03, purchasingPower: 65, currency: "EUR", eur: 1 },
  IT: { name: "Itálie", gdp: 36000, happiness: 6.32, purchasingPower: 82, currency: "EUR", eur: 1 },
  SE: { name: "Švédsko", gdp: 55000, happiness: 7.34, purchasingPower: 108, currency: "SEK", eur: 11.4 },
  NO: { name: "Norsko", gdp: 89000, happiness: 7.30, purchasingPower: 125, currency: "NOK", eur: 11.7 },
  DK: { name: "Dánsko", gdp: 67000, happiness: 7.58, purchasingPower: 115, currency: "DKK", eur: 7.46 },
  FI: { name: "Finsko", gdp: 51000, happiness: 7.74, purchasingPower: 102, currency: "EUR", eur: 1 },
  US: { name: "USA", gdp: 80000, happiness: 6.72, purchasingPower: 115, currency: "USD", eur: 1.08 },
  CA: { name: "Kanada", gdp: 54000, happiness: 6.90, purchasingPower: 105, currency: "CAD", eur: 1.47 },
  AU: { name: "Austrálie", gdp: 64000, happiness: 7.06, purchasingPower: 110, currency: "AUD", eur: 1.63 },
  MX: { name: "Mexiko", gdp: 11000, happiness: 6.68, purchasingPower: 42, currency: "MXN", eur: 18.5 }
};

// -----------------------------------------------
// MĚSTA — populace, koncertní kapacita největších arén
// -----------------------------------------------

export const CITIES = {
  // --- Česko ---
  "Prague": { country: "CZ", population: 1300000, majorVenue: "O2 Arena", venueCapacity: 20000 },
  "Praha": { country: "CZ", population: 1300000, majorVenue: "O2 Arena", venueCapacity: 20000 },
  "Brno": { country: "CZ", population: 380000, majorVenue: "Winning Group Arena", venueCapacity: 7700 },
  "Ostrava": { country: "CZ", population: 285000, majorVenue: "Ostravar Aréna", venueCapacity: 12500 },
  "Plzen": { country: "CZ", population: 175000, majorVenue: "Home Monitoring Arena", venueCapacity: 8500 },
  "Plzeň": { country: "CZ", population: 175000, majorVenue: "Home Monitoring Arena", venueCapacity: 8500 },
  "Ceske Budejovice": { country: "CZ", population: 94000, majorVenue: "Budvar Arena", venueCapacity: 4500 },
  "Olomouc": { country: "CZ", population: 100000, majorVenue: "Zimní stadion Olomouc", venueCapacity: 6600 },

  // --- Slovensko ---
  "Bratislava": { country: "SK", population: 475000, majorVenue: "Ondrej Nepela Arena", venueCapacity: 10000 },
  "Kosice": { country: "SK", population: 230000, majorVenue: "Steel Arena", venueCapacity: 8400 },
  "Košice": { country: "SK", population: 230000, majorVenue: "Steel Arena", venueCapacity: 8400 },

  // --- Rakousko ---
  "Vienna": { country: "AT", population: 1900000, majorVenue: "Wiener Stadthalle", venueCapacity: 16000 },
  "Wien": { country: "AT", population: 1900000, majorVenue: "Wiener Stadthalle", venueCapacity: 16000 },
  "Graz": { country: "AT", population: 290000, majorVenue: "Steiermarkhalle", venueCapacity: 7500 },
  "Linz": { country: "AT", population: 205000, majorVenue: "TipsArena Linz", venueCapacity: 5900 },
  "Salzburg": { country: "AT", population: 155000, majorVenue: "Salzburgarena", venueCapacity: 5000 },
  "Innsbruck": { country: "AT", population: 130000, majorVenue: "Olympiaworld", venueCapacity: 8000 },

  // --- Německo ---
  "Berlin": { country: "DE", population: 3700000, majorVenue: "Mercedes-Benz Arena", venueCapacity: 17000 },
  "Munich": { country: "DE", population: 1500000, majorVenue: "Olympiahalle", venueCapacity: 15500 },
  "München": { country: "DE", population: 1500000, majorVenue: "Olympiahalle", venueCapacity: 15500 },
  "Hamburg": { country: "DE", population: 1900000, majorVenue: "Barclays Arena", venueCapacity: 16000 },
  "Cologne": { country: "DE", population: 1100000, majorVenue: "Lanxess Arena", venueCapacity: 20000 },
  "Köln": { country: "DE", population: 1100000, majorVenue: "Lanxess Arena", venueCapacity: 20000 },
  "Frankfurt": { country: "DE", population: 760000, majorVenue: "Festhalle Frankfurt", venueCapacity: 13500 },
  "Stuttgart": { country: "DE", population: 630000, majorVenue: "Schleyerhalle", venueCapacity: 15500 },
  "Dusseldorf": { country: "DE", population: 620000, majorVenue: "Merkur Spiel-Arena", venueCapacity: 54600 },
  "Düsseldorf": { country: "DE", population: 620000, majorVenue: "Merkur Spiel-Arena", venueCapacity: 54600 },
  "Leipzig": { country: "DE", population: 600000, majorVenue: "Quarterback Immobilien Arena", venueCapacity: 11000 },
  "Hannover": { country: "DE", population: 535000, majorVenue: "ZAG Arena", venueCapacity: 12000 },
  "Nuremberg": { country: "DE", population: 520000, majorVenue: "Arena Nürnberger Versicherung", venueCapacity: 8000 },
  "Nürnberg": { country: "DE", population: 520000, majorVenue: "Arena Nürnberger Versicherung", venueCapacity: 8000 },
  "Dortmund": { country: "DE", population: 590000, majorVenue: "Westfalenhallen", venueCapacity: 13000 },
  "Bremen": { country: "DE", population: 570000, majorVenue: "ÖVB-Arena", venueCapacity: 10000 },
  "Mannheim": { country: "DE", population: 310000, majorVenue: "SAP Arena", venueCapacity: 15000 },

  // --- Polsko ---
  "Warsaw": { country: "PL", population: 1800000, majorVenue: "PGE Narodowy", venueCapacity: 58000 },
  "Warszawa": { country: "PL", population: 1800000, majorVenue: "PGE Narodowy", venueCapacity: 58000 },
  "Krakow": { country: "PL", population: 780000, majorVenue: "Tauron Arena", venueCapacity: 22000 },
  "Kraków": { country: "PL", population: 780000, majorVenue: "Tauron Arena", venueCapacity: 22000 },
  "Wroclaw": { country: "PL", population: 640000, majorVenue: "Hala Stulecia", venueCapacity: 11500 },
  "Wrocław": { country: "PL", population: 640000, majorVenue: "Hala Stulecia", venueCapacity: 11500 },
  "Poznan": { country: "PL", population: 530000, majorVenue: "Ergo Arena", venueCapacity: 11000 },
  "Poznań": { country: "PL", population: 530000, majorVenue: "Ergo Arena", venueCapacity: 11000 },
  "Gdansk": { country: "PL", population: 470000, majorVenue: "Ergo Arena", venueCapacity: 11000 },
  "Gdańsk": { country: "PL", population: 470000, majorVenue: "Ergo Arena", venueCapacity: 11000 },
  "Katowice": { country: "PL", population: 290000, majorVenue: "Spodek", venueCapacity: 11500 },
  "Lodz": { country: "PL", population: 670000, majorVenue: "Atlas Arena", venueCapacity: 12000 },
  "Łódź": { country: "PL", population: 670000, majorVenue: "Atlas Arena", venueCapacity: 12000 },

  // --- Maďarsko ---
  "Budapest": { country: "HU", population: 1750000, majorVenue: "MVM Dome", venueCapacity: 20000 },
  "Debrecen": { country: "HU", population: 200000, majorVenue: "Főnix Arena", venueCapacity: 8000 },
  "Szeged": { country: "HU", population: 160000, majorVenue: "Pick Arena", venueCapacity: 8300 },

  // --- Švýcarsko ---
  "Zurich": { country: "CH", population: 430000, majorVenue: "Hallenstadion", venueCapacity: 15000 },
  "Zürich": { country: "CH", population: 430000, majorVenue: "Hallenstadion", venueCapacity: 15000 },
  "Geneva": { country: "CH", population: 200000, majorVenue: "Arena Genève", venueCapacity: 10000 },
  "Basel": { country: "CH", population: 175000, majorVenue: "St. Jakobshalle", venueCapacity: 12000 },
  "Bern": { country: "CH", population: 135000, majorVenue: "PostFinance Arena", venueCapacity: 17000 },

  // --- Velká Británie ---
  "London": { country: "GB", population: 9000000, majorVenue: "The O2", venueCapacity: 20000 },
  "Manchester": { country: "GB", population: 550000, majorVenue: "Co-op Live", venueCapacity: 23500 },
  "Birmingham": { country: "GB", population: 1150000, majorVenue: "Utilita Arena", venueCapacity: 15800 },
  "Glasgow": { country: "GB", population: 635000, majorVenue: "OVO Hydro", venueCapacity: 14300 },
  "Leeds": { country: "GB", population: 800000, majorVenue: "First Direct Arena", venueCapacity: 13780 },
  "Liverpool": { country: "GB", population: 500000, majorVenue: "M&S Bank Arena", venueCapacity: 11000 },
  "Sheffield": { country: "GB", population: 585000, majorVenue: "Utilita Arena Sheffield", venueCapacity: 13600 },
  "Newcastle": { country: "GB", population: 300000, majorVenue: "Utilita Arena Newcastle", venueCapacity: 11000 },

  // --- Irsko ---
  "Dublin": { country: "IE", population: 590000, majorVenue: "3Arena", venueCapacity: 14500 },

  // --- Nizozemsko ---
  "Amsterdam": { country: "NL", population: 900000, majorVenue: "Ziggo Dome", venueCapacity: 17000 },
  "Rotterdam": { country: "NL", population: 650000, majorVenue: "Rotterdam Ahoy", venueCapacity: 16000 },
  "Utrecht": { country: "NL", population: 360000, majorVenue: "Beatrix Theater", venueCapacity: 3800 },
  "Eindhoven": { country: "NL", population: 235000, majorVenue: "Klokgebouw", venueCapacity: 5000 },

  // --- Belgie ---
  "Brussels": { country: "BE", population: 1200000, majorVenue: "Vorst Nationaal", venueCapacity: 8600 },
  "Antwerp": { country: "BE", population: 530000, majorVenue: "Sportpaleis", venueCapacity: 23000 },

  // --- Francie ---
  "Paris": { country: "FR", population: 2100000, majorVenue: "Accor Arena", venueCapacity: 20300 },
  "Lyon": { country: "FR", population: 520000, majorVenue: "LDLC Arena", venueCapacity: 16000 },
  "Marseille": { country: "FR", population: 870000, majorVenue: "Dôme de Marseille", venueCapacity: 8500 },
  "Lille": { country: "FR", population: 235000, majorVenue: "Zénith de Lille", venueCapacity: 7000 },
  "Toulouse": { country: "FR", population: 490000, majorVenue: "Zénith de Toulouse", venueCapacity: 11000 },
  "Nice": { country: "FR", population: 340000, majorVenue: "Palais Nikaïa", venueCapacity: 9500 },
  "Strasbourg": { country: "FR", population: 285000, majorVenue: "Zénith de Strasbourg", venueCapacity: 12000 },

  // --- Španělsko ---
  "Madrid": { country: "ES", population: 3300000, majorVenue: "WiZink Center", venueCapacity: 17000 },
  "Barcelona": { country: "ES", population: 1600000, majorVenue: "Palau Sant Jordi", venueCapacity: 17000 },
  "Valencia": { country: "ES", population: 790000, majorVenue: "Roig Arena", venueCapacity: 15000 },
  "Seville": { country: "ES", population: 690000, majorVenue: "San Pablo", venueCapacity: 12000 },
  "Bilbao": { country: "ES", population: 345000, majorVenue: "Bilbao Arena", venueCapacity: 15000 },

  // --- Portugalsko ---
  "Lisbon": { country: "PT", population: 545000, majorVenue: "Altice Arena", venueCapacity: 20000 },
  "Porto": { country: "PT", population: 235000, majorVenue: "Super Bock Arena", venueCapacity: 8000 },

  // --- Itálie ---
  "Rome": { country: "IT", population: 2870000, majorVenue: "Palazzo dello Sport", venueCapacity: 11500 },
  "Milan": { country: "IT", population: 1370000, majorVenue: "Mediolanum Forum", venueCapacity: 12700 },
  "Turin": { country: "IT", population: 850000, majorVenue: "Inalpi Arena", venueCapacity: 12350 },
  "Bologna": { country: "IT", population: 390000, majorVenue: "Unipol Arena", venueCapacity: 11400 },
  "Florence": { country: "IT", population: 360000, majorVenue: "Nelson Mandela Forum", venueCapacity: 7100 },
  "Naples": { country: "IT", population: 915000, majorVenue: "Palazzo dello Sport Napoli", venueCapacity: 8500 },

  // --- Švédsko ---
  "Stockholm": { country: "SE", population: 980000, majorVenue: "Avicii Arena", venueCapacity: 16000 },
  "Gothenburg": { country: "SE", population: 580000, majorVenue: "Scandinavium", venueCapacity: 12000 },
  "Malmo": { country: "SE", population: 350000, majorVenue: "Malmö Arena", venueCapacity: 15500 },
  "Malmö": { country: "SE", population: 350000, majorVenue: "Malmö Arena", venueCapacity: 15500 },

  // --- Norsko ---
  "Oslo": { country: "NO", population: 700000, majorVenue: "Spektrum", venueCapacity: 9200 },
  "Bergen": { country: "NO", population: 285000, majorVenue: "Vestlandshallen", venueCapacity: 5000 },

  // --- Dánsko ---
  "Copenhagen": { country: "DK", population: 650000, majorVenue: "Royal Arena", venueCapacity: 16000 },
  "Aarhus": { country: "DK", population: 285000, majorVenue: "Ceres Arena", venueCapacity: 7000 },

  // --- Finsko ---
  "Helsinki": { country: "FI", population: 660000, majorVenue: "Helsinki Ice Hall", venueCapacity: 13600 },
  "Tampere": { country: "FI", population: 245000, majorVenue: "Nokia Arena", venueCapacity: 15400 },

  // --- USA ---
  "New York": { country: "US", population: 8300000, majorVenue: "Madison Square Garden", venueCapacity: 20800 },
  "Los Angeles": { country: "US", population: 3900000, majorVenue: "Crypto.com Arena", venueCapacity: 20000 },
  "Chicago": { country: "US", population: 2700000, majorVenue: "United Center", venueCapacity: 23500 },
  "Las Vegas": { country: "US", population: 640000, majorVenue: "T-Mobile Arena", venueCapacity: 20000 },
  "Miami": { country: "US", population: 440000, majorVenue: "Kaseya Center", venueCapacity: 21000 },
  "Boston": { country: "US", population: 690000, majorVenue: "TD Garden", venueCapacity: 19600 },
  "Houston": { country: "US", population: 2300000, majorVenue: "Toyota Center", venueCapacity: 18000 },
  "Dallas": { country: "US", population: 1300000, majorVenue: "American Airlines Center", venueCapacity: 20000 },
  "Atlanta": { country: "US", population: 500000, majorVenue: "State Farm Arena", venueCapacity: 21000 },
  "Nashville": { country: "US", population: 690000, majorVenue: "Bridgestone Arena", venueCapacity: 20000 },

  // --- Kanada ---
  "Toronto": { country: "CA", population: 2900000, majorVenue: "Scotiabank Arena", venueCapacity: 19800 },
  "Montreal": { country: "CA", population: 1780000, majorVenue: "Bell Centre", venueCapacity: 21300 },
  "Vancouver": { country: "CA", population: 660000, majorVenue: "Rogers Arena", venueCapacity: 19700 },

  // --- Austrálie ---
  "Sydney": { country: "AU", population: 5300000, majorVenue: "Qudos Bank Arena", venueCapacity: 21000 },
  "Melbourne": { country: "AU", population: 5100000, majorVenue: "Rod Laver Arena", venueCapacity: 15000 },
  "Brisbane": { country: "AU", population: 2500000, majorVenue: "Entertainment Centre", venueCapacity: 13500 },

  // --- Mexiko ---
  "Mexico City": { country: "MX", population: 9200000, majorVenue: "Arena CDMX", venueCapacity: 22300 },
  "Guadalajara": { country: "MX", population: 1500000, majorVenue: "Arena VFG", venueCapacity: 12500 },
  "Monterrey": { country: "MX", population: 1140000, majorVenue: "Arena Monterrey", venueCapacity: 17000 }
};

// -----------------------------------------------
// Pomocné funkce
// -----------------------------------------------

export function getCountryData(countryCode) {
  return COUNTRIES[countryCode?.toUpperCase()] || null;
}

export function getCityData(cityName) {
  if (!cityName) return null;
  // Přesná shoda
  if (CITIES[cityName]) return CITIES[cityName];
  // Očisti od čísel obvodů (Praha 8)
  const clean = cityName.replace(/\s+\d+$/, "").trim();
  return CITIES[clean] || null;
}

// Kategorie bohatství pro scoring
export function getWealthCategory(countryCode) {
  const c = getCountryData(countryCode);
  if (!c) return null;
  if (c.gdp >= 45000) return "high";
  if (c.gdp >= 22000) return "medium";
  return "low";
}

// Kombinovaný "market score" — jak bohatý a spokojený je trh (0-100)
export function getMarketScore(countryCode) {
  const c = getCountryData(countryCode);
  if (!c) return null;
  // Kupní síla (0-130+) normalizovaná na 0-70 + štěstí (0-10) na 0-30
  const ppScore = Math.min(70, (c.purchasingPower / 130) * 70);
  const happyScore = (c.happiness / 8) * 30;
  return Math.round(ppScore + happyScore);
}
