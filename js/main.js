// Hlavní vstupní bod — TicketFlow v2
import { login, logout, watchAuth } from "./auth.js";
import { watchEvents, createEvent, updateEvent, deleteEvent, dayOfWeekFromDate } from "./events.js";
import { searchArtists, saveSpotifyKeys, getSpotifyKeys, hasSpotifyKeys } from "./spotify.js";
import { saveTmKey, getTmKey, hasTmKey, searchEvents, analyzeTour, fetchEventDetails } from "./ticketmaster.js";
import { enrichEvent } from "./enrichment.js";
import { watchArtists, addArtist, deleteArtist, refreshAllArtists } from "./artists.js";
import { renderArtistsTable, setArtistSort, renderMarketsTable, setMarketSort, renderCitiesTable, setCitySort, setCityFilter } from "./tables-ui.js";
import { saveAiSettings, getAiSettings, hasAiSettings, runAiAnalysis } from "./ai.js";
import {
  renderEvents, filterEvents, updateStats,
  resetEventForm, populateEventForm, collectEventFormData,
  openEventModal, closeEventModal,
  showSpotifyChip, hideSpotifyChip,
  renderArtistSuggestions, closeArtistSuggestions,
  openSettingsModal, closeSettingsModal,
  setSpotifyStatus, setAiStatus,
  refreshAlgoScorePanel, showAiLoading, showAiResult, showAiError,
  showToast
} from "./ui.js";
import {
  renderDiscoveryResults, showDiscoveryLoading, showDiscoveryError,
  updateDiscoveryPagination, patchCardWithSpotify, setAddedTmIds
} from "./discovery-ui.js";

let currentUser = null;
let allEvents = [];
let unsubscribeEvents = null;
let unsubscribeArtists = null;
let allArtists = [];
let selectedSpotifyArtist = null;
let searchDebounce = null;
let artistAddDebounce = null;

// Discovery state
let discPage = 0;
let discTotalPages = 1;
let discCurrentEvents = [];

// -----------------------------------------------
// Auth
// -----------------------------------------------

watchAuth(async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    document.getElementById("user-email").textContent = user.email || "";

    if (unsubscribeEvents) unsubscribeEvents();
    unsubscribeEvents = watchEvents(user.uid, (events) => {
      allEvents = events;
      // aktualizuj "already added" sadu pro Discovery
      const tmIds = events.map((e) => e.tmId).filter(Boolean);
      setAddedTmIds(tmIds);
      refreshPortfolio();
    });

    if (unsubscribeArtists) unsubscribeArtists();
    unsubscribeArtists = watchArtists(user.uid, (artists) => {
      allArtists = artists;
      renderArtistsTable(allArtists, handleDeleteArtist);
    });

    // Trhy — statická data, vykreslíme hned
    renderMarketsTable();
    renderCitiesTable();

    const [spotifyOk, tmOk, aiOk] = await Promise.all([
      hasSpotifyKeys(user.uid).catch(() => false),
      hasTmKey(user.uid).catch(() => false),
      hasAiSettings(user.uid).catch(() => false)
    ]);
    setSpotifyStatus(spotifyOk);
    setTmStatus(tmOk);
    setAiStatus(aiOk);

    // Automaticky načti Discovery při prvním přihlášení
    if (tmOk) runDiscoverySearch();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-shell").style.display = "none";
    if (unsubscribeEvents) unsubscribeEvents();
    if (unsubscribeArtists) unsubscribeArtists();
    allEvents = [];
  }
});

document.getElementById("login-btn").addEventListener("click", async () => {
  try { await login(); } catch (err) { showToast("Přihlášení selhalo: " + err.message, true); }
});
document.getElementById("logout-btn").addEventListener("click", () => logout());

// -----------------------------------------------
// Tab navigace
// -----------------------------------------------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-discovery").style.display = tab === "discovery" ? "block" : "none";
    document.getElementById("tab-portfolio").style.display = tab === "portfolio" ? "block" : "none";
    document.getElementById("tab-artists").style.display = tab === "artists" ? "block" : "none";
    document.getElementById("tab-markets").style.display = tab === "markets" ? "block" : "none";
  });
});

// -----------------------------------------------
// Tab Interpreti — přidávání a řazení
// -----------------------------------------------

const artistAddInput = document.getElementById("artist-add-input");

artistAddInput.addEventListener("input", () => {
  clearTimeout(artistAddDebounce);
  const term = artistAddInput.value;
  if (term.trim().length < 2) {
    document.getElementById("artist-add-suggestions").classList.remove("open");
    return;
  }
  artistAddDebounce = setTimeout(async () => {
    if (!currentUser) return;
    try {
      const results = await searchArtists(currentUser.uid, term, 6);
      renderArtistAddSuggestions(results);
    } catch (err) {
      console.error("[TicketFlow] Spotify search chyba:", err);
      if (err.message === "NO_KEYS") {
        showToast("Nejdřív nastav Spotify proxy v Nastavení ⚙", true);
      } else {
        showToast("Spotify hledání selhalo: " + err.message, true);
      }
    }
  }, 400);
});

function renderArtistAddSuggestions(artists) {
  const box = document.getElementById("artist-add-suggestions");
  if (!artists.length) { box.classList.remove("open"); box.innerHTML = ""; return; }
  box.innerHTML = artists.map((a, i) => `
    <div class="artist-suggestion-item" data-idx="${i}">
      <img src="${a.imageUrl || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div>
        <div class="artist-suggestion-name">${a.name}</div>
        <div class="artist-suggestion-meta">popularita ${a.popularity ?? "—"} · ${(a.followers || 0).toLocaleString("cs-CZ")} followers</div>
      </div>
    </div>`).join("");
  box.classList.add("open");

  box.querySelectorAll(".artist-suggestion-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const artist = artists[Number(item.dataset.idx)];
      box.classList.remove("open");
      artistAddInput.value = "";
      try {
        const res = await addArtist(currentUser.uid, artist);
        showToast(res.updated ? `„${artist.name}" aktualizován` : `„${artist.name}" přidán do žebříčku`);
      } catch (err) {
        showToast("Chyba: " + err.message, true);
      }
    });
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#artist-add-input") && !e.target.closest("#artist-add-suggestions")) {
    document.getElementById("artist-add-suggestions").classList.remove("open");
  }
});

function handleDeleteArtist(artistId) {
  const artist = allArtists.find((a) => a.id === artistId);
  if (artist && confirm(`Odebrat „${artist.name}" ze žebříčku?`)) {
    deleteArtist(currentUser.uid, artistId).catch((err) => showToast("Chyba: " + err.message, true));
  }
}

// Řazení tabulky interpretů
document.querySelectorAll("#artists-table th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    setArtistSort(th.dataset.sort);
    renderArtistsTable(allArtists, handleDeleteArtist);
  });
});

// Aktualizace Spotify metrik
document.getElementById("artists-refresh-btn").addEventListener("click", async () => {
  if (!currentUser || !allArtists.length) { showToast("Žádní interpreti k aktualizaci"); return; }
  showToast("Aktualizuji Spotify data…");
  try {
    const count = await refreshAllArtists(currentUser.uid, () => {});
    showToast(`✓ Aktualizováno ${count} interpretů`);
  } catch (err) {
    showToast("Chyba při aktualizaci: " + err.message, true);
  }
});

// Řazení tabulky trhů
document.querySelectorAll("#markets-table th.sortable").forEach((th) => {
  th.addEventListener("click", () => setMarketSort(th.dataset.msort));
});

// Řazení a filtrování tabulky měst
document.querySelectorAll("#cities-table th.sortable").forEach((th) => {
  th.addEventListener("click", () => setCitySort(th.dataset.csort));
});
document.getElementById("cities-search").addEventListener("input", (e) => {
  setCityFilter(e.target.value);
});

// -----------------------------------------------
// Portfolio
// -----------------------------------------------

function refreshPortfolio() {
  const term = document.getElementById("search-input").value;
  const status = document.getElementById("status-filter").value;
  const filtered = filterEvents(allEvents, term, status);
  renderEvents(filtered);
  updateStats(allEvents);
}

document.getElementById("search-input").addEventListener("input", refreshPortfolio);
document.getElementById("status-filter").addEventListener("change", refreshPortfolio);

document.getElementById("event-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const ev = allEvents.find((x) => x.id === id);
  if (!ev) return;
  if (btn.dataset.action === "edit") {
    selectedSpotifyArtist = ev.spotify || null;
    populateEventForm(ev);
    if (ev.attractionId) {
      document.getElementById("event-form").dataset.attractionId = ev.attractionId;
    }
    resetTourPanel();
    openEventModal();
  } else if (btn.dataset.action === "delete") {
    if (confirm(`Smazat událost „${ev.artistName}"?`)) {
      deleteEvent(currentUser.uid, id)
        .then(() => showToast("Událost smazána"))
        .catch((err) => showToast("Chyba: " + err.message, true));
    }
  }
});

// -----------------------------------------------
// Discovery — vyhledávání
// -----------------------------------------------

async function runDiscoverySearch(page = 0) {
  if (!currentUser) return;
  discPage = page;

  showDiscoveryLoading();

  const country = document.getElementById("disc-country").value;
  const segment = document.getElementById("disc-segment").value;
  const keyword = document.getElementById("disc-keyword").value;

  try {
    const result = await searchEvents(currentUser.uid, { countryCode: country, segment, keyword, page, size: 20 });
    discCurrentEvents = result.events;
    discTotalPages = result.totalPages;

    renderDiscoveryResults(discCurrentEvents, onAddEventFromDiscovery, () => {});
    updateDiscoveryPagination(page, result.totalPages);

    // Enrichuj Spotify asynchronně (po vykreslení karet)
    enrichWithSpotify(discCurrentEvents);
  } catch (err) {
    if (err.message === "NO_TM_KEY") {
      showDiscoveryError("Nastav Ticketmaster API klíč v Nastavení ⚙, pak klikni Hledat.");
    } else {
      showDiscoveryError("Chyba při načítání: " + err.message);
    }
  }
}

document.getElementById("disc-search-btn").addEventListener("click", () => runDiscoverySearch(0));
document.getElementById("disc-keyword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runDiscoverySearch(0);
});
document.getElementById("disc-prev").addEventListener("click", () => runDiscoverySearch(discPage - 1));
document.getElementById("disc-next").addEventListener("click", () => runDiscoverySearch(discPage + 1));

// -----------------------------------------------
// Spotify enrichment pro Discovery karty
// -----------------------------------------------

async function enrichWithSpotify(events) {
  if (!currentUser) return;
  const spotifyOk = await hasSpotifyKeys(currentUser.uid).catch(() => false);
  if (!spotifyOk) return;

  let successCount = 0;
  let lastError = null;

  for (const ev of events) {
    if (!ev.artistName || ev.artistName === "Neznámý") continue;
    try {
      const results = await searchArtists(currentUser.uid, ev.artistName, 1);
      if (results.length) {
        ev.spotify = results[0];
        patchCardWithSpotify(ev.tmId, results[0]);
        successCount++;
      }
    } catch (err) {
      lastError = err;
      console.error("[TicketFlow] Spotify enrichment chyba pro", ev.artistName, ":", err);
    }
    // malá pauza aby se nepřetížilo API
    await new Promise((r) => setTimeout(r, 200));
  }

  if (successCount === 0 && lastError) {
    showToast("⚠ Spotify data se nepodařilo načíst: " + lastError.message, true);
  }
}

// -----------------------------------------------
// Přidání akce ze Discovery do sledování + enrichment
// -----------------------------------------------

function setEnrichmentBar(visible, text) {
  const bar = document.getElementById("enrichment-bar");
  const status = document.getElementById("enrichment-status");
  bar.style.display = visible ? "flex" : "none";
  if (text) status.textContent = text;
}

async function onAddEventFromDiscovery(tmEvent) {
  if (!currentUser) return;

  // Debug — hned na vstupu ukaž co Ticketmaster reálně poslal za ceny
  console.log("[TicketFlow] TM cenová data pro", tmEvent.artistName, {
    ticketPriceMin: tmEvent.ticketPriceMin,
    ticketPriceMax: tmEvent.ticketPriceMax,
    priceStandardMin: tmEvent.priceStandardMin,
    priceStandardMax: tmEvent.priceStandardMax,
    priceVipMin: tmEvent.priceVipMin,
    priceVipMax: tmEvent.priceVipMax,
    currency: tmEvent.currency
  });

  // 1. Otevři modal s tím co máme z TM hned
  resetEventForm();

  // Základní předvyplnění z TM dat
  const baseData = {
    ...tmEvent,
    dayOfWeek: dayOfWeekFromDate(tmEvent.eventDate),
    purchasePrice: tmEvent.ticketPriceMin || null,
    targetSellPrice: null
  };
  populateEventForm(baseData);

  if (tmEvent.spotify) {
    showSpotifyChip(tmEvent.spotify);
    document.getElementById("event-form").dataset.spotifyData = JSON.stringify(tmEvent.spotify);
  }
  document.getElementById("event-form").dataset.tmId = tmEvent.tmId;
  if (tmEvent.attractionId) {
    document.getElementById("event-form").dataset.attractionId = tmEvent.attractionId;
  }

  openEventModal();
  resetTourPanel();
  setEnrichmentBar(true, "Načítám data o místě konání…");
  refreshAlgoScorePanel();

  // 2. Spusť enrichment na pozadí
  try {
    setEnrichmentBar(true, "Hledám kapacitu arény a data o městě…");

    // Nejdřív zkus okamžitá data z vlastní databáze (geodata.js) — bez čekání na API
    const { getCityData, getWealthCategory } = await import("./geodata.js");
    const cityData = getCityData(tmEvent.city);
    if (cityData) {
      const capEl = document.getElementById("f-capacity");
      if (capEl && !capEl.value && cityData.venueCapacity) capEl.value = cityData.venueCapacity;
      const popEl = document.getElementById("f-cityPopulation");
      if (popEl && !popEl.value && cityData.population) popEl.value = cityData.population;
    }
    const wealthCat = getWealthCategory(tmEvent.countryCode);
    if (wealthCat) {
      const wealthEl = document.getElementById("f-countryWealth");
      if (wealthEl) wealthEl.value = wealthCat;
    }

    // Enrichment běží paralelně (Wikipedia doplní/zpřesní co databáze nemá)
    const enrichPromise = enrichEvent(currentUser.uid, tmEvent);

    // Pokud nemáme Spotify data ještě (enrichment ze Discovery karty mohl proběhnout)
    let spotifyData = tmEvent.spotify;
    if (!spotifyData) {
      setEnrichmentBar(true, "Načítám Spotify data o interpretovi…");
      try {
        const spotifyOk = await hasSpotifyKeys(currentUser.uid).catch(() => false);
        if (spotifyOk) {
          const results = await searchArtists(currentUser.uid, tmEvent.artistName, 1);
          if (results.length) {
            spotifyData = results[0];
            showSpotifyChip(spotifyData);
            document.getElementById("event-form").dataset.spotifyData = JSON.stringify(spotifyData);
          }
        }
      } catch (err) {
        console.error("[TicketFlow] Spotify fallback chyba:", err);
        showToast("⚠ Spotify data se nenačetla: " + err.message, true);
      }
    }

    setEnrichmentBar(true, "Hledám konkurenční akce ve stejném termínu…");
    const enriched = await enrichPromise;

    // Pokud vyhledávání nevrátilo žádné ceny, zkus detail konkrétní akce
    // (TM detail endpoint bývá občas bohatší než hromadné vyhledávání)
    let priceData = tmEvent;
    const noPricesYet = [tmEvent.ticketPriceMin, tmEvent.priceStandardMin, tmEvent.priceVipMin].every((v) => v == null);
    if (noPricesYet) {
      setEnrichmentBar(true, "Zkouším dohledat ceny přes detail akce…");
      const details = await fetchEventDetails(currentUser.uid, tmEvent.tmId);
      if (details && [details.ticketPriceMin, details.priceStandardMin, details.priceVipMin].some((v) => v != null)) {
        priceData = { ...tmEvent, ...details };
      }
    }

    // Debug — vývojář uvidí v konzoli (F12) co se načetlo
    console.log("[TicketFlow] Enrichment výsledek:", enriched);
    console.log("[TicketFlow] Finální cenová data:", priceData);

    // 3. Doplň obohacená data do formuláře
    if (enriched.capacity) {
      const capEl = document.getElementById("f-capacity");
      if (capEl && !capEl.value) capEl.value = enriched.capacity;
    }

    if (enriched.cityPopulation) {
      const popEl = document.getElementById("f-cityPopulation");
      if (popEl && !popEl.value) popEl.value = enriched.cityPopulation;
    }

    if (enriched.countryWealth) {
      const wealthEl = document.getElementById("f-countryWealth");
      if (wealthEl) wealthEl.value = enriched.countryWealth;
    }

    if (enriched.localPopularity) {
      const locEl = document.getElementById("f-localPopularity");
      if (locEl) locEl.value = enriched.localPopularity;
    }

    if (enriched.competingEvents.length > 0) {
      const compEl = document.getElementById("f-competingEvents");
      if (compEl && !compEl.value) {
        const list = enriched.competingEvents
          .map((e) => `${e.name} (${e.date || "?"})`)
          .join(", ");
        compEl.value = list;
      }
    }

    // Nejlevnější lístek z Ticketmaster (jako výchozí odhad tržní ceny)
    if (priceData.ticketPriceMin) {
      const cheapEl = document.getElementById("f-cheapestPrice");
      if (cheapEl && !cheapEl.value) cheapEl.value = Math.round(priceData.ticketPriceMin);
    }

    // Cenová rozpětí po sektorech z TM
    fillPriceField("f-priceStandingMin", priceData.priceStandardMin);
    fillPriceField("f-priceStandingMax", priceData.priceStandardMax);
    fillPriceField("f-priceVipMin", priceData.priceVipMin);
    fillPriceField("f-priceVipMax", priceData.priceVipMax);
    // Sezení — TM to nerozlišuje, tak necháme standard i pro sezení jako odhad
    fillPriceField("f-priceSeatedMin", priceData.priceStandardMin);
    fillPriceField("f-priceSeatedMax", priceData.priceStandardMax);

    // Pokud TM neposkytl žádné ceny, ukaž odkaz na ruční kontrolu
    const hasAnyPrice = [priceData.ticketPriceMin, priceData.priceStandardMin, priceData.priceVipMin].some((v) => v != null);
    const tmLink = document.getElementById("tm-price-link");
    if (!hasAnyPrice && tmEvent.tmUrl) {
      tmLink.href = tmEvent.tmUrl;
      tmLink.style.display = "inline";
    } else {
      tmLink.style.display = "none";
    }

    // Přidej Songstats odkaz do poznámky pokud prázdná
    const chartEl = document.getElementById("f-chartNotes");
    if (chartEl && !chartEl.value && tmEvent.artistName) {
      const slug = tmEvent.artistName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      chartEl.placeholder = `Zkontroluj: songstats.com/artist/${slug}`;
    }

    // Přepočítej skóre po doplnění dat (programové .value nespustí input event)
    refreshAlgoScorePanel();

    setEnrichmentBar(false);
    refreshAlgoScorePanel();

    // Souhrn co bylo doplněno
    const filled = [];
    if (enriched.capacity) filled.push("kapacita arény");
    if (enriched.cityPopulation) filled.push("obyvatelé města");
    if (enriched.countryWealth) filled.push("bohatství země");
    if (enriched.competingEvents.length) filled.push(`${enriched.competingEvents.length} konkurenční akce`);
    if (hasAnyPrice) filled.push("ceny vstupenek");

    if (!hasAnyPrice) {
      showToast(`⚠ Ticketmaster u této akce neuvádí ceny — zkontroluj odkaz v sekci Vstupenky`, true);
    } else if (filled.length) {
      showToast(`✓ Doplněno automaticky: ${filled.join(", ")}`);
    } else {
      showToast(`„${tmEvent.artistName}" — doplň chybějící data a ulož`);
    }

  } catch (err) {
    setEnrichmentBar(false);
    console.warn("Enrichment chyba:", err);
    showToast("Data o místě se nepodařilo načíst — vyplň ručně");
  }
}

// -----------------------------------------------
// Event modal
// -----------------------------------------------

document.getElementById("add-event-btn").addEventListener("click", () => {
  resetEventForm();
  selectedSpotifyArtist = null;
  delete document.getElementById("event-form").dataset.attractionId;
  resetTourPanel();
  openEventModal();
});

document.getElementById("event-modal-close").addEventListener("click", closeEventModal);
document.getElementById("event-cancel-btn").addEventListener("click", closeEventModal);
document.getElementById("event-modal").addEventListener("click", (e) => {
  if (e.target.id === "event-modal") closeEventModal();
});

document.getElementById("f-eventDate").addEventListener("change", (e) => {
  document.getElementById("f-dayOfWeek").value = dayOfWeekFromDate(e.target.value);
  refreshAlgoScorePanel();
});

document.getElementById("event-form").addEventListener("input", refreshAlgoScorePanel);
document.getElementById("event-form").addEventListener("change", refreshAlgoScorePanel);

document.getElementById("event-save-btn").addEventListener("click", async () => {
  const form = document.getElementById("event-form");
  if (!form.reportValidity()) return;

  const data = collectEventFormData();
  // Přidej tmId a attractionId pokud jsou (z Discovery)
  if (form.dataset.tmId) data.tmId = form.dataset.tmId;
  if (form.dataset.attractionId) data.attractionId = form.dataset.attractionId;

  const editId = form.dataset.editId;
  try {
    if (editId) {
      await updateEvent(currentUser.uid, editId, data);
      showToast("Událost uložena");
    } else {
      await createEvent(currentUser.uid, data);
      showToast("Přidáno do sledování");
    }
    closeEventModal();
  } catch (err) {
    showToast("Chyba při ukládání: " + err.message, true);
  }
});

// -----------------------------------------------
// Turné analýza + cenové helpery
// -----------------------------------------------

function fillPriceField(id, value) {
  if (value == null) return;
  const el = document.getElementById(id);
  if (el && !el.value) el.value = Math.round(value);
}

function resetTourPanel() {
  const panel = document.getElementById("tour-panel");
  const content = document.getElementById("tour-content");
  // Panel zobrazíme jen pokud máme z čeho analyzovat
  const hasArtist = document.getElementById("f-artistName").value.trim().length > 0;
  panel.style.display = hasArtist ? "block" : "none";
  content.innerHTML = 'Klikni „Načíst" pro přehled celého turné interpreta.';
}

async function loadTourAnalysis() {
  if (!currentUser) return;
  const content = document.getElementById("tour-content");
  const form = document.getElementById("event-form");
  const artistName = document.getElementById("f-artistName").value.trim();
  const attractionId = form.dataset.attractionId || null;

  if (!artistName && !attractionId) {
    content.textContent = "Nejdřív vyber interpreta.";
    return;
  }

  content.innerHTML = '<span class="spinner"></span> Analyzuji turné…';

  try {
    const tour = await analyzeTour(currentUser.uid, attractionId, artistName);
    if (!tour) {
      content.textContent = "Turné se nepodařilo načíst (interpret nemá v Ticketmaster další akce nebo chybí API klíč).";
      return;
    }
    renderTourPanel(tour);
    // Automaticky doplň počet koncertů do formuláře
    const showCountEl = document.getElementById("f-showCount");
    if (showCountEl && !showCountEl.value) showCountEl.value = tour.totalShows;
    refreshAlgoScorePanel();
  } catch (err) {
    content.textContent = "Chyba při analýze turné: " + err.message;
  }
}

function renderTourPanel(tour) {
  const content = document.getElementById("tour-content");
  const parts = [];

  parts.push(`<div style="display:flex; gap:18px; flex-wrap:wrap; margin-bottom:10px;">
    <div><span style="font-family:var(--font-mono); font-size:20px; font-weight:700; color:var(--accent);">${tour.totalShows}</span> <span style="font-size:11px; color:var(--text-faint);">koncertů</span></div>
    <div><span style="font-family:var(--font-mono); font-size:20px; font-weight:700; color:var(--text);">${tour.uniqueCities}</span> <span style="font-size:11px; color:var(--text-faint);">měst</span></div>
    <div><span style="font-family:var(--font-mono); font-size:20px; font-weight:700; color:var(--text);">${tour.uniqueCountries}</span> <span style="font-size:11px; color:var(--text-faint);">zemí</span></div>
  </div>`);

  // Vícedenní vystoupení (silný signál)
  const backToBackConsecutive = tour.backToBack.filter((b) => b.consecutive);
  if (backToBackConsecutive.length > 0) {
    parts.push(`<div style="padding:8px 10px; background:var(--positive-soft); border:1px solid #1f5c45; border-radius:6px; margin-bottom:6px; color:var(--positive); font-size:12px;">
      🔥 <strong>Hraje víc dní po sobě</strong> na: ${backToBackConsecutive.map((b) => escapeHTMLtext(b.venue)).join(", ")} — silný signál poptávky!
    </div>`);
  }

  if (tour.multiNightVenues.length > 0) {
    parts.push(`<div style="font-size:12px; color:var(--text-muted);">
      Víc koncertů na stejném místě: ${tour.multiNightVenues.map((v) => `${escapeHTMLtext(v.venue)} (${v.count}×)`).join(", ")}
    </div>`);
  }

  if (backToBackConsecutive.length === 0 && tour.multiNightVenues.length === 0) {
    parts.push(`<div style="font-size:12px; color:var(--text-faint);">Žádné vícedenní vystoupení — každé město jednou.</div>`);
  }

  content.innerHTML = parts.join("");
}

function escapeHTMLtext(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.getElementById("tour-refresh-btn").addEventListener("click", loadTourAnalysis);

// -----------------------------------------------
// AI analýza
// -----------------------------------------------

document.getElementById("ai-analyze-btn").addEventListener("click", async () => {
  if (!currentUser) return;
  const formData = collectEventFormData();
  const algoScore = refreshAlgoScorePanel();
  showAiLoading();
  try {
    const result = await runAiAnalysis(currentUser.uid, formData, algoScore);
    document.getElementById("event-form").dataset.aiAnalysis = JSON.stringify(result);
    showAiResult(result);
  } catch (err) {
    if (err.message === "NO_AI_SETTINGS") {
      showAiError("Nejdřív nastav AI proxy (Worker URL + Proxy Secret) v Nastavení ⚙");
    } else {
      showAiError("Analýza selhala: " + err.message);
    }
  }
});

// -----------------------------------------------
// Spotify autocomplete ve formuláři
// -----------------------------------------------

const artistInput = document.getElementById("f-artistName");

artistInput.addEventListener("input", () => {
  hideSpotifyChip();
  delete document.getElementById("event-form").dataset.spotifyData;
  clearTimeout(searchDebounce);
  const term = artistInput.value;
  if (term.trim().length < 2) { closeArtistSuggestions(); return; }
  searchDebounce = setTimeout(async () => {
    if (!currentUser) return;
    try {
      const results = await searchArtists(currentUser.uid, term);
      renderArtistSuggestions(results, onArtistPicked);
    } catch (err) {
      console.error("[TicketFlow] Spotify search chyba:", err);
      if (err.message === "NO_KEYS") {
        showToast("Nejdřív nastav Spotify proxy v Nastavení ⚙", true);
      } else {
        showToast("Spotify hledání selhalo: " + err.message, true);
      }
      closeArtistSuggestions();
    }
  }, 400);
});

function onArtistPicked(artist) {
  artistInput.value = artist.name;
  showSpotifyChip(artist);
  document.getElementById("event-form").dataset.spotifyData = JSON.stringify(artist);
  closeArtistSuggestions();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".artist-search-wrap")) closeArtistSuggestions();
});

// -----------------------------------------------
// Nastavení modal
// -----------------------------------------------

function setTmStatus(connected) {
  const badge = document.getElementById("tm-status");
  const text = document.getElementById("tm-status-text");
  badge.classList.toggle("connected", connected);
  text.textContent = connected ? "Připojeno" : "Nepřipojeno";
}

document.getElementById("settings-btn").addEventListener("click", async () => {
  if (!currentUser) return;
  const [tmKey, spotifyKeys, aiSettings] = await Promise.all([
    getTmKey(currentUser.uid).catch(() => null),
    getSpotifyKeys(currentUser.uid).catch(() => null),
    getAiSettings(currentUser.uid).catch(() => null)
  ]);
  document.getElementById("f-tm-api-key").value = tmKey || "";
  document.getElementById("f-spotify-worker-url").value = spotifyKeys?.workerUrl || "";
  document.getElementById("f-spotify-proxy-key").value = spotifyKeys?.proxyKey || "";
  document.getElementById("f-ai-worker-url").value = aiSettings?.workerUrl || "";
  document.getElementById("f-ai-proxy-key").value = aiSettings?.proxyKey || "";
  document.getElementById("f-ai-web-search").checked = !!aiSettings?.useWebSearch;
  openSettingsModal();
});

document.getElementById("settings-modal-close").addEventListener("click", closeSettingsModal);
document.getElementById("settings-cancel-btn").addEventListener("click", closeSettingsModal);
document.getElementById("settings-modal").addEventListener("click", (e) => {
  if (e.target.id === "settings-modal") closeSettingsModal();
});

// Diagnostika — otestuje enrichment API přímo z prohlížeče uživatele
document.getElementById("test-enrichment-btn").addEventListener("click", async () => {
  const box = document.getElementById("enrichment-test-result");
  box.style.display = "block";
  box.textContent = "Testuji zdroje dat…\n";

  const { fetchVenueCapacity, fetchCityPopulation } = await import("./enrichment.js");

  // Test 1: Wikipedia kapacita (O2 Arena Prague — jistě má wiki stránku)
  try {
    const cap = await fetchVenueCapacity("O2 Arena", "Prague");
    box.textContent += cap ? `✅ Kapacita arény (Wikipedia): ${cap.toLocaleString("cs-CZ")}\n` : "⚠️ Kapacita: stránka nenalezena (zkus jinou arénu)\n";
  } catch (e) { box.textContent += `❌ Wikipedia kapacita selhala: ${e.message}\n`; }

  // Test 2: Wikipedia populace
  try {
    const pop = await fetchCityPopulation("Prague", "Czech Republic");
    box.textContent += pop ? `✅ Populace města (Wikipedia): ${pop.toLocaleString("cs-CZ")}\n` : "⚠️ Populace: nenalezena\n";
  } catch (e) { box.textContent += `❌ Wikipedia populace selhala: ${e.message}\n`; }

  box.textContent += "\nHotovo. Ceny vstupenek se testují přímo při přidávání akce z Discovery (viz konzole F12).";
});

// Diagnostika — otestuje Spotify proxy Worker (musí být uložen a uložení potvrzeno)
document.getElementById("test-spotify-btn").addEventListener("click", async () => {
  const box = document.getElementById("spotify-test-result");
  box.style.display = "block";
  box.textContent = "Ukládám aktuální hodnoty z formuláře a testuji…\n";

  const workerUrl = document.getElementById("f-spotify-worker-url").value.trim();
  const proxyKey = document.getElementById("f-spotify-proxy-key").value.trim();

  if (!workerUrl || !proxyKey) {
    box.textContent += "❌ Vyplň Worker URL i Proxy Secret výše, pak zkus znovu.";
    return;
  }

  try {
    await saveSpotifyKeys(currentUser.uid, workerUrl, proxyKey);
    const results = await searchArtists(currentUser.uid, "Charlie Puth", 1);
    if (results.length) {
      box.textContent += `✅ Spotify proxy funguje! Nalezeno: ${results[0].name} (popularita ${results[0].popularity}, ${results[0].followers?.toLocaleString("cs-CZ")} followers)`;
      setSpotifyStatus(true);
    } else {
      box.textContent += "⚠️ Proxy odpověděl, ale bez výsledků — zkus jiné jméno.";
    }
  } catch (err) {
    box.textContent += `❌ Chyba: ${err.message}\n\nZkontroluj: je Worker nasazený? Sedí Proxy Secret v Nastavení appky i ve Worker secrets? Má Worker správně nastavené SPOTIFY_CLIENT_ID a SPOTIFY_CLIENT_SECRET?`;
  }
});

document.getElementById("settings-save-btn").addEventListener("click", async () => {
  const tmKey = document.getElementById("f-tm-api-key").value.trim();
  const spotifyWorkerUrl = document.getElementById("f-spotify-worker-url").value.trim();
  const spotifyProxyKey = document.getElementById("f-spotify-proxy-key").value.trim();
  const workerUrl = document.getElementById("f-ai-worker-url").value.trim();
  const proxyKey = document.getElementById("f-ai-proxy-key").value.trim();
  const useWebSearch = document.getElementById("f-ai-web-search").checked;

  try {
    if (tmKey) { await saveTmKey(currentUser.uid, tmKey); setTmStatus(true); }
    if (spotifyWorkerUrl && spotifyProxyKey) {
      await saveSpotifyKeys(currentUser.uid, spotifyWorkerUrl, spotifyProxyKey);
      setSpotifyStatus(true);
    }
    if (workerUrl && proxyKey) { await saveAiSettings(currentUser.uid, { workerUrl, proxyKey, useWebSearch }); setAiStatus(true); }
    showToast("Nastavení uloženo");
    closeSettingsModal();

    // Pokud byl TM klíč nově zadán, spusť search
    if (tmKey) runDiscoverySearch(0);
  } catch (err) {
    showToast("Chyba při ukládání: " + err.message, true);
  }
});
