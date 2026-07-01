// UI vykreslování — TicketFlow
import { calcMargin, calcQueueRatio, dayOfWeekFromDate } from "./events.js";

const STATUS_LABELS = {
  watching: "Sledováno",
  bought: "Nakoupeno",
  sold: "Prodáno",
  expired: "Propadlo"
};

const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč";

// ---------------------------------------------
// Event grid
// ---------------------------------------------

export function renderEvents(events) {
  const grid = document.getElementById("event-grid");
  const empty = document.getElementById("empty-state");

  if (!events.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = events.map(cardHTML).join("");
}

function cardHTML(ev) {
  const margin = calcMargin(ev.purchasePrice, ev.targetSellPrice);
  const marginClass = margin.abs >= 0 ? "positive" : "negative";
  const status = ev.status || "watching";
  const dateLabel = ev.eventDate
    ? new Date(ev.eventDate + "T00:00:00").toLocaleDateString("cs-CZ", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "—";

  const popBadge =
    ev.spotify && ev.spotify.popularity != null
      ? `<span class="badge badge-pop">♪ ${ev.spotify.popularity}</span>`
      : "";

  return `
  <div class="stub" data-id="${ev.id}">
    <div class="stub-actions">
      <button data-action="edit" data-id="${ev.id}" title="Upravit">✎</button>
      <button data-action="delete" data-id="${ev.id}" title="Smazat">🗑</button>
    </div>
    <div class="stub-main">
      <div class="stub-artist">${escapeHTML(ev.artistName || "Bez názvu")}</div>
      <div class="stub-meta">
        <span>${dateLabel}</span>
        <span>·</span>
        <span>${escapeHTML(ev.dayOfWeek || dayOfWeekFromDate(ev.eventDate))}</span>
        <span>·</span>
        <span>${escapeHTML(ev.venueName || ev.city || "—")}</span>
      </div>
      <div class="stub-badges">
        <span class="badge badge-status ${status}">${STATUS_LABELS[status] || status}</span>
        ${popBadge}
        ${ev.capacity ? `<span class="badge">${Number(ev.capacity).toLocaleString("cs-CZ")} míst</span>` : ""}
        ${ev.ticketType ? `<span class="badge">${ticketTypeLabel(ev.ticketType)}</span>` : ""}
      </div>
    </div>
    <div class="stub-divider"></div>
    <div class="stub-numbers">
      <div class="stub-price-row">
        <span class="stub-price-label">Nákup</span>
        <span class="stub-price-value">${fmtMoney(ev.purchasePrice)}</span>
      </div>
      <div class="stub-price-row">
        <span class="stub-price-label">Cíl</span>
        <span class="stub-price-value">${fmtMoney(ev.targetSellPrice)}</span>
      </div>
      <div class="stub-price-row">
        <span class="stub-price-label">Marže</span>
        <span class="stub-price-value stub-margin ${marginClass}">
          ${margin.abs >= 0 ? "+" : ""}${fmtMoney(margin.abs)}
        </span>
      </div>
    </div>
  </div>`;
}

function ticketTypeLabel(t) {
  return { standing: "Stání", seated: "Sezení", vip: "VIP" }[t] || t;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------------------------------------
// Filtering
// ---------------------------------------------

export function filterEvents(events, searchTerm, statusFilter) {
  const term = (searchTerm || "").trim().toLowerCase();
  return events.filter((ev) => {
    if (statusFilter && statusFilter !== "all" && (ev.status || "watching") !== statusFilter) {
      return false;
    }
    if (!term) return true;
    const haystack = `${ev.artistName || ""} ${ev.venueName || ""} ${ev.city || ""} ${ev.country || ""}`.toLowerCase();
    return haystack.includes(term);
  });
}

// ---------------------------------------------
// Stats
// ---------------------------------------------

export function updateStats(events) {
  const watching = events.filter((e) => (e.status || "watching") === "watching").length;

  const bought = events.filter((e) => e.status === "bought");
  const invested = bought.reduce((sum, e) => sum + (Number(e.purchasePrice) || 0), 0);
  const expectedProfit = bought.reduce((sum, e) => sum + calcMargin(e.purchasePrice, e.targetSellPrice).abs, 0);

  const sold = events.filter((e) => e.status === "sold");
  const realizedProfit = sold.reduce((sum, e) => sum + calcMargin(e.purchasePrice, e.targetSellPrice).abs, 0);

  document.getElementById("stat-watching").textContent = watching;
  document.getElementById("stat-invested").textContent = fmtMoney(invested);

  const expEl = document.getElementById("stat-expected-profit");
  expEl.textContent = (expectedProfit >= 0 ? "+" : "") + fmtMoney(expectedProfit);
  expEl.className = "stat-value " + (expectedProfit >= 0 ? "positive" : "negative");

  const realEl = document.getElementById("stat-realized-profit");
  realEl.textContent = (realizedProfit >= 0 ? "+" : "") + fmtMoney(realizedProfit);
  realEl.className = "stat-value " + (realizedProfit >= 0 ? "positive" : realizedProfit < 0 ? "negative" : "");
}

// ---------------------------------------------
// Event modal — form <-> data
// ---------------------------------------------

const FIELD_IDS = [
  "artistName", "eventDate", "venueName", "capacity", "city", "country",
  "showCount", "status", "soldOutPreviousTour", "newAlbumRecent", "artistAge",
  "newAlbumNote", "targetAudience", "chartNotes", "cityPopulation",
  "countryWealth", "localPopularity", "competingEvents", "ticketType",
  "purchasePrice", "targetSellPrice", "presaleSoldOut", "queueSize",
  "mapTicketsDisappearing", "secondaryMarketNote", "viagogoWatchers",
  "priceTrend", "cheapestPrice", "viagogoNote", "notes"
];

export function resetEventForm() {
  document.getElementById("event-form").reset();
  document.getElementById("f-dayOfWeek").value = "";
  hideSpotifyChip();
  document.getElementById("event-modal-title").textContent = "Nová událost";
  delete document.getElementById("event-form").dataset.editId;
  delete document.getElementById("event-form").dataset.spotifyData;
}

export function populateEventForm(ev) {
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById("f-" + id);
    if (el && ev[id] !== undefined && ev[id] !== null) el.value = ev[id];
  });
  document.getElementById("f-dayOfWeek").value = ev.dayOfWeek || dayOfWeekFromDate(ev.eventDate);
  document.getElementById("event-modal-title").textContent = "Upravit událost";
  document.getElementById("event-form").dataset.editId = ev.id;

  if (ev.spotify) {
    showSpotifyChip(ev.spotify);
    document.getElementById("event-form").dataset.spotifyData = JSON.stringify(ev.spotify);
  } else {
    hideSpotifyChip();
  }
}

export function collectEventFormData() {
  const data = {};
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById("f-" + id);
    if (!el) return;
    if (el.type === "number") {
      data[id] = el.value === "" ? null : Number(el.value);
    } else {
      data[id] = el.value;
    }
  });
  data.dayOfWeek = dayOfWeekFromDate(data.eventDate);

  const spotifyRaw = document.getElementById("event-form").dataset.spotifyData;
  if (spotifyRaw) {
    try { data.spotify = JSON.parse(spotifyRaw); } catch { /* ignore */ }
  }
  return data;
}

export function openEventModal() {
  document.getElementById("event-modal").classList.add("open");
}
export function closeEventModal() {
  document.getElementById("event-modal").classList.remove("open");
}

// ---------------------------------------------
// Spotify chip + suggestions
// ---------------------------------------------

export function showSpotifyChip(artist) {
  const chip = document.getElementById("spotify-chip");
  document.getElementById("sc-img").src = artist.imageUrl || "";
  document.getElementById("sc-name").textContent = artist.name;
  document.getElementById("sc-pop").textContent = artist.popularity ?? "—";
  document.getElementById("sc-followers").textContent = artist.followers
    ? `${Number(artist.followers).toLocaleString("cs-CZ")} followers · ${(artist.genres || []).slice(0, 2).join(", ")}`
    : "";
  chip.classList.add("show");
}

export function hideSpotifyChip() {
  document.getElementById("spotify-chip").classList.remove("show");
}

export function renderArtistSuggestions(artists, onSelect) {
  const box = document.getElementById("artist-suggestions");
  if (!artists.length) {
    box.classList.remove("open");
    box.innerHTML = "";
    return;
  }
  box.innerHTML = artists
    .map(
      (a, i) => `
    <div class="artist-suggestion-item" data-idx="${i}">
      <img src="${a.imageUrl || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div>
        <div class="artist-suggestion-name">${escapeHTML(a.name)}</div>
        <div class="artist-suggestion-meta">popularita ${a.popularity ?? "—"} · ${(a.genres || []).slice(0, 2).join(", ")}</div>
      </div>
    </div>`
    )
    .join("");
  box.classList.add("open");

  box.querySelectorAll(".artist-suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = Number(item.dataset.idx);
      onSelect(artists[idx]);
      box.classList.remove("open");
    });
  });
}

export function closeArtistSuggestions() {
  document.getElementById("artist-suggestions").classList.remove("open");
}

// ---------------------------------------------
// Settings modal
// ---------------------------------------------

export function openSettingsModal() {
  document.getElementById("settings-modal").classList.add("open");
}
export function closeSettingsModal() {
  document.getElementById("settings-modal").classList.remove("open");
}
export function setSpotifyStatus(connected) {
  const badge = document.getElementById("spotify-status");
  const text = document.getElementById("spotify-status-text");
  badge.classList.toggle("connected", connected);
  text.textContent = connected ? "Připojeno" : "Nepřipojeno";
}

// ---------------------------------------------
// Toast
// ---------------------------------------------

let toastTimer = null;
export function showToast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
