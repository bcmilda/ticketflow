// Algoritmické skóre atraktivity (0–100) — TicketFlow
// Váhy vychází ze 4 kategorií, celkem 100 bodů při plně vyplněných datech.
// Chybějící volitelná data se z výpočtu vynechají a zbytek se přepočítá poměrově,
// takže neúplný záznam není nespravedlivě trestán — jen má nižší "spolehlivost".

function scaleEnum(value, map) {
  if (value === undefined || value === null || value === "") return null;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

function buildFactors(ev) {
  const spotifyPop = ev.spotify && ev.spotify.popularity != null ? ev.spotify.popularity : null;

  const queueRatio =
    ev.queueSize != null && ev.capacity ? Math.min(100, (Number(ev.queueSize) / Number(ev.capacity)) * 50) : null;

  const priceRealism =
    ev.cheapestPrice != null && ev.targetSellPrice != null && Number(ev.cheapestPrice) > 0
      ? (() => {
          const ratio = Number(ev.targetSellPrice) / Number(ev.cheapestPrice);
          if (ratio <= 1.1) return 100;
          if (ratio >= 1.5) return 20;
          // lineárně mezi 1.1 -> 100 a 1.5 -> 20
          return 100 - ((ratio - 1.1) / (1.5 - 1.1)) * 80;
        })()
      : null;

  return [
    // --- Oblíbenost interpreta (35) ---
    { category: "Oblíbenost interpreta", weight: 18, score: spotifyPop },
    { category: "Oblíbenost interpreta", weight: 10, score: scaleEnum(ev.soldOutPreviousTour, { yes: 100, no: 20 }) },
    { category: "Oblíbenost interpreta", weight: 4, score: scaleEnum(ev.newAlbumRecent, { yes: 100, no: 50 }) },
    { category: "Oblíbenost interpreta", weight: 4, score: scaleEnum(ev.radioRotation, { high: 100, medium: 55, low: 15, unknown: null }) },
    {
      category: "Oblíbenost interpreta", weight: 4,
      score: ev.chartPosition != null
        ? Math.max(0, 100 - (Number(ev.chartPosition) - 1) * 1.5)
        : null
    },

    // --- Místo a trh (20) ---
    { category: "Místo a trh", weight: 10, score: scaleEnum(ev.localPopularity, { high: 100, medium: 55, low: 15 }) },
    { category: "Místo a trh", weight: 10, score: scaleEnum(ev.countryWealth, { high: 100, medium: 60, low: 25 }) },

    // --- Skutečný zájem (30) ---
    { category: "Skutečný zájem", weight: 12, score: scaleEnum(ev.presaleSoldOut, { yes: 100, partial: 55, no: 15 }) },
    { category: "Skutečný zájem", weight: 12, score: queueRatio },
    { category: "Skutečný zájem", weight: 6, score: scaleEnum(ev.mapTicketsDisappearing, { yes: 100, no: 20 }) },

    // --- Sekundární trh (15) ---
    { category: "Sekundární trh", weight: 8, score: scaleEnum(ev.priceTrend, { up: 100, stable: 50, down: 15 }) },
    { category: "Sekundární trh", weight: 7, score: priceRealism }
  ];
}

export function computeAttractivenessScore(ev) {
  const factors = buildFactors(ev);
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const included = factors.filter((f) => f.score != null);
  const includedWeight = included.reduce((s, f) => s + f.weight, 0);

  if (includedWeight === 0) {
    return { score: null, label: "Nedostatek dat", emoji: "•", completeness: 0, breakdown: [] };
  }

  const weightedSum = included.reduce((s, f) => s + f.weight * f.score, 0);
  const score = Math.round(weightedSum / includedWeight);
  const completeness = Math.round((includedWeight / totalWeight) * 100);

  // souhrn po kategoriích (pro breakdown v UI)
  const byCategory = {};
  factors.forEach((f) => {
    if (!byCategory[f.category]) byCategory[f.category] = { weight: 0, includedWeight: 0, weightedSum: 0 };
    byCategory[f.category].weight += f.weight;
    if (f.score != null) {
      byCategory[f.category].includedWeight += f.weight;
      byCategory[f.category].weightedSum += f.weight * f.score;
    }
  });
  const breakdown = Object.entries(byCategory).map(([category, v]) => ({
    category,
    score: v.includedWeight > 0 ? Math.round(v.weightedSum / v.includedWeight) : null,
    weight: v.weight
  }));

  return { score, ...labelFor(score), completeness, breakdown };
}

function labelFor(score) {
  if (score >= 75) return { label: "Vysoký potenciál", emoji: "🔥" };
  if (score >= 55) return { label: "Dobrý potenciál", emoji: "✅" };
  if (score >= 35) return { label: "Průměrný / rizikový", emoji: "⚠️" };
  return { label: "Nízký potenciál", emoji: "❌" };
}
