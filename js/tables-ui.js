// UI pro tabulky Interpreti + Trhy — TicketFlow
import { COUNTRIES, getMarketScore } from "./geodata.js";

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const fmtNum = (n) => (Number(n) || 0).toLocaleString("cs-CZ");

const COUNTRY_FLAGS = {
  CZ: "🇨🇿", SK: "🇸🇰", AT: "🇦🇹", DE: "🇩🇪", PL: "🇵🇱", HU: "🇭🇺", CH: "🇨🇭",
  GB: "🇬🇧", IE: "🇮🇪", NL: "🇳🇱", BE: "🇧🇪", FR: "🇫🇷", ES: "🇪🇸", PT: "🇵🇹",
  IT: "🇮🇹", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", US: "🇺🇸", CA: "🇨🇦",
  AU: "🇦🇺", MX: "🇲🇽"
};

// -----------------------------------------------
// Tabulka interpretů
// -----------------------------------------------

let artistSortKey = "popularity";

export function renderArtistsTable(artists, onDelete) {
  const tbody = document.getElementById("artists-tbody");
  const empty = document.getElementById("artists-empty");
  const table = document.getElementById("artists-table");

  if (!artists.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    table.style.display = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "table";

  // Seřaď podle zvoleného klíče
  const sorted = [...artists].sort((a, b) => (b[artistSortKey] || 0) - (a[artistSortKey] || 0));

  tbody.innerHTML = sorted.map((a, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? "top" : "";
    const genre = (a.genres || [])[0] || "—";
    return `
    <tr>
      <td><span class="artist-rank ${rankClass}">${rank}</span></td>
      <td><img class="artist-avatar" src="${escapeHTML(a.imageUrl || "")}" alt="" onerror="this.style.visibility='hidden'" /></td>
      <td class="artist-name-cell">
        ${a.spotifyUrl ? `<a href="${escapeHTML(a.spotifyUrl)}" target="_blank">${escapeHTML(a.name)}</a>` : escapeHTML(a.name)}
      </td>
      <td class="num">
        <span class="pop-bar">
          <span class="pop-bar-track"><span class="pop-bar-fill" style="width:${a.popularity || 0}%"></span></span>
          ${a.popularity || 0}
        </span>
      </td>
      <td class="num">${fmtNum(a.followers)}</td>
      <td class="hide-mobile"><span class="genre-tag">${escapeHTML(genre)}</span></td>
      <td><button class="table-del-btn" data-del-artist="${a.id}" title="Odebrat">✕</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-del-artist]").forEach((btn) => {
    btn.addEventListener("click", () => onDelete(btn.dataset.delArtist));
  });
}

export function setArtistSort(key) {
  artistSortKey = key;
  // Aktualizuj šipky v hlavičce
  document.querySelectorAll("#artists-table th.sortable").forEach((th) => {
    const base = th.textContent.replace(/[▾▴]/g, "").trim();
    th.textContent = th.dataset.sort === key ? `${base} ▾` : base;
  });
}

// -----------------------------------------------
// Tabulka trhů (zemí)
// -----------------------------------------------

let marketSortKey = "gdp";

export function renderMarketsTable() {
  const tbody = document.getElementById("markets-tbody");

  const rows = Object.entries(COUNTRIES).map(([code, c]) => ({
    code,
    ...c,
    market: getMarketScore(code)
  }));

  rows.sort((a, b) => (b[marketSortKey] || 0) - (a[marketSortKey] || 0));

  tbody.innerHTML = rows.map((r) => {
    const flag = COUNTRY_FLAGS[r.code] || "";
    const marketClass = r.market >= 75 ? "market-high" : r.market >= 55 ? "market-mid" : "market-low";
    return `
    <tr>
      <td><span class="market-flag">${flag}</span>${escapeHTML(r.name)}</td>
      <td class="num">$${fmtNum(r.gdp)}</td>
      <td class="num">${r.purchasingPower}</td>
      <td class="num">${r.happiness.toFixed(2)}</td>
      <td class="num"><span class="market-score-badge ${marketClass}">${r.market}</span></td>
    </tr>`;
  }).join("");
}

export function setMarketSort(key) {
  marketSortKey = key;
  document.querySelectorAll("#markets-table th.sortable").forEach((th) => {
    const base = th.textContent.replace(/[▾▴]/g, "").trim();
    th.textContent = th.dataset.msort === key ? `${base} ▾` : base;
  });
  renderMarketsTable();
}

// -----------------------------------------------
// Tabulka měst
// -----------------------------------------------

let citySortKey = "population";
let cityFilterTerm = "";

export function setCityFilter(term) {
  cityFilterTerm = (term || "").toLowerCase();
  renderCitiesTable();
}

export function setCitySort(key) {
  citySortKey = key;
  document.querySelectorAll("#cities-table th.sortable").forEach((th) => {
    const base = th.textContent.replace(/[▾▴]/g, "").trim();
    th.textContent = th.dataset.csort === key ? `${base} ▾` : base;
  });
  renderCitiesTable();
}

export async function renderCitiesTable() {
  const { CITIES } = await import("./geodata.js");
  const tbody = document.getElementById("cities-tbody");

  let rows = Object.entries(CITIES).map(([name, c]) => ({ name, ...c }));

  if (cityFilterTerm) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(cityFilterTerm));
  }

  rows.sort((a, b) => (b[citySortKey] || 0) - (a[citySortKey] || 0));

  tbody.innerHTML = rows.map((r) => {
    const flag = COUNTRY_FLAGS[r.country] || "";
    return `
    <tr>
      <td class="artist-name-cell">${escapeHTML(r.name)}</td>
      <td>${flag} ${escapeHTML(r.country)}</td>
      <td class="num">${fmtNum(r.population)}</td>
      <td class="hide-mobile">${escapeHTML(r.majorVenue || "—")}</td>
      <td class="num">${fmtNum(r.venueCapacity)}</td>
    </tr>`;
  }).join("");
}
