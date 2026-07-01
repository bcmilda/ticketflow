// Discovery UI — TicketFlow
// Vykresluje karty z Ticketmaster API, obohacené Spotify daty

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric"
  });
};

const DAY_CZ = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const dayOfWeek = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return DAY_CZ[d.getDay()];
};

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Set již přidaných tmId (pro badge "Sledováno")
let addedTmIds = new Set();

export function setAddedTmIds(ids) {
  addedTmIds = new Set(ids);
}

export function renderDiscoveryResults(events, onAddToWatchlist, onOpenTicketmaster) {
  const grid = document.getElementById("disc-results");
  const empty = document.getElementById("disc-empty");
  const loading = document.getElementById("disc-loading");

  loading.style.display = "none";

  if (!events.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = events.map((ev) => cardHTML(ev)).join("");

  grid.querySelectorAll(".disc-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tmId = btn.dataset.tmid;
      const ev = events.find((e) => e.tmId === tmId);
      if (ev) onAddToWatchlist(ev);
    });
  });

  grid.querySelectorAll(".disc-tm-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (url) window.open(url, "_blank", "noopener");
    });
  });
}

function cardHTML(ev) {
  const alreadyAdded = addedTmIds.has(ev.tmId);
  const dow = dayOfWeek(ev.eventDate);
  const dateLabel = ev.eventDate ? `${dow} ${fmtDate(ev.eventDate)}` : "Datum TBA";

  const imgHTML = ev.imageUrl
    ? `<img class="disc-card-img" src="${escapeHTML(ev.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="disc-card-img-placeholder" style="display:none;">🎵</div>`
    : `<div class="disc-card-img-placeholder">${ev.segment === "Sports" ? "⚽" : "🎵"}</div>`;

  const spotifyHTML = ev.spotify
    ? `<div class="disc-card-spotify">
        ${ev.spotify.imageUrl ? `<img src="${escapeHTML(ev.spotify.imageUrl)}" alt="" />` : ""}
        <div>
          <span class="sp-pop">${ev.spotify.popularity ?? "—"}</span> popularita Spotify
          · ${(Number(ev.spotify.followers) || 0).toLocaleString("cs-CZ")} followers
        </div>
       </div>`
    : "";

  const genreBadge = ev.genre && ev.genre !== "Undefined"
    ? `<span class="badge">${escapeHTML(ev.genre)}</span>`
    : "";

  const priceBadge = ev.ticketPriceMin
    ? `<span class="badge badge-pop">${Math.round(ev.ticketPriceMin)} ${ev.currency || "EUR"}</span>`
    : "";

  const alreadyBadge = alreadyAdded
    ? `<div class="already-added">✓ Sledováno</div>`
    : "";

  return `
  <div class="disc-card">
    ${alreadyBadge}
    ${imgHTML}
    <div class="disc-card-body">
      <div class="disc-card-artist">${escapeHTML(ev.artistName)}</div>
      ${ev.eventName !== ev.artistName ? `<div class="disc-card-event">${escapeHTML(ev.eventName)}</div>` : ""}
      <div class="disc-card-meta">
        <span>📅 <strong>${escapeHTML(dateLabel)}</strong></span>
        <span>📍 ${escapeHTML(ev.city || "—")}${ev.countryCode ? `, ${ev.countryCode}` : ""}</span>
        ${ev.venueName ? `<span>🏟 ${escapeHTML(ev.venueName)}</span>` : ""}
      </div>
      <div class="disc-card-badges">
        ${genreBadge}
        ${priceBadge}
      </div>
      ${spotifyHTML}
    </div>
    <div class="disc-card-footer">
      <button class="btn btn-primary disc-add-btn" data-tmid="${escapeHTML(ev.tmId)}"
        ${alreadyAdded ? "disabled style='opacity:0.5;'" : ""}>
        ${alreadyAdded ? "✓ Přidáno" : "+ Sledovat"}
      </button>
      ${ev.tmUrl ? `<button class="btn btn-ghost disc-tm-btn" data-url="${escapeHTML(ev.tmUrl)}">Lístky →</button>` : ""}
    </div>
  </div>`;
}

export function showDiscoveryLoading() {
  document.getElementById("disc-loading").style.display = "block";
  document.getElementById("disc-results").innerHTML = "";
  document.getElementById("disc-empty").style.display = "none";
  document.getElementById("disc-pagination").style.display = "none";
}

export function showDiscoveryError(msg) {
  document.getElementById("disc-loading").style.display = "none";
  document.getElementById("disc-results").innerHTML = `<div style="color:var(--negative); padding:20px;">⚠ ${escapeHTML(msg)}</div>`;
}

export function updateDiscoveryPagination(page, totalPages) {
  const pag = document.getElementById("disc-pagination");
  const info = document.getElementById("disc-page-info");
  if (totalPages <= 1) { pag.style.display = "none"; return; }
  pag.style.display = "flex";
  info.textContent = `Strana ${page + 1} z ${totalPages}`;
  document.getElementById("disc-prev").disabled = page === 0;
  document.getElementById("disc-next").disabled = page >= totalPages - 1;
}

// Obohacení karty Spotify daty v reálném čase (po fetch)
export function patchCardWithSpotify(tmId, spotifyData) {
  const grid = document.getElementById("disc-results");
  const card = grid.querySelector(`[data-tmid="${tmId}"]`)?.closest(".disc-card");
  if (!card) return;

  // Odstraň existující spotify blok, přidej nový
  const existing = card.querySelector(".disc-card-spotify");
  if (existing) existing.remove();

  const body = card.querySelector(".disc-card-body");
  if (!body) return;

  const spotifyDiv = document.createElement("div");
  spotifyDiv.className = "disc-card-spotify";
  spotifyDiv.innerHTML = `
    ${spotifyData.imageUrl ? `<img src="${escapeHTML(spotifyData.imageUrl)}" alt="" />` : ""}
    <div>
      <span class="sp-pop">${spotifyData.popularity ?? "—"}</span> popularita Spotify
      · ${(Number(spotifyData.followers) || 0).toLocaleString("cs-CZ")} followers
    </div>`;
  body.appendChild(spotifyDiv);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
