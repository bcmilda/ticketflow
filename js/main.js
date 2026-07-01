// Hlavní vstupní bod — TicketFlow v2
import { login, logout, watchAuth } from "./auth.js";
import { watchEvents, createEvent, updateEvent, deleteEvent, dayOfWeekFromDate } from "./events.js";
import { searchArtists, saveSpotifyKeys, getSpotifyKeys, hasSpotifyKeys } from "./spotify.js";
import { saveTmKey, getTmKey, hasTmKey, searchEvents } from "./ticketmaster.js";
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
let selectedSpotifyArtist = null;
let searchDebounce = null;

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
  });
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

  for (const ev of events) {
    if (!ev.artistName || ev.artistName === "Neznámý") continue;
    try {
      const results = await searchArtists(currentUser.uid, ev.artistName, 1);
      if (results.length) {
        ev.spotify = results[0];
        patchCardWithSpotify(ev.tmId, results[0]);
      }
    } catch { /* Spotify chyba — přeskočíme */ }
    // malá pauza aby se nepřetížilo API
    await new Promise((r) => setTimeout(r, 200));
  }
}

// -----------------------------------------------
// Přidání akce ze Discovery do sledování
// -----------------------------------------------

async function onAddEventFromDiscovery(tmEvent) {
  if (!currentUser) return;

  // Předvyplň formulář daty z Ticketmaster + Spotify
  resetEventForm();
  populateEventForm({
    ...tmEvent,
    dayOfWeek: dayOfWeekFromDate(tmEvent.eventDate),
    purchasePrice: tmEvent.ticketPriceMin || null,
    targetSellPrice: null
  });

  if (tmEvent.spotify) {
    showSpotifyChip(tmEvent.spotify);
    document.getElementById("event-form").dataset.spotifyData = JSON.stringify(tmEvent.spotify);
  }

  // Ulož tmId pro deduplikaci
  document.getElementById("event-form").dataset.tmId = tmEvent.tmId;

  openEventModal();
  refreshAlgoScorePanel();

  showToast(`„${tmEvent.artistName}" — zkontroluj a ulož do sledování`);
}

// -----------------------------------------------
// Event modal
// -----------------------------------------------

document.getElementById("add-event-btn").addEventListener("click", () => {
  resetEventForm();
  selectedSpotifyArtist = null;
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
  // Přidej tmId pokud je (z Discovery)
  if (form.dataset.tmId) data.tmId = form.dataset.tmId;

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
      if (err.message === "NO_KEYS") showToast("Nejdřív nastav Spotify klíče v Nastavení ⚙", true);
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
  document.getElementById("f-spotify-client-id").value = spotifyKeys?.clientId || "";
  document.getElementById("f-spotify-client-secret").value = spotifyKeys?.clientSecret || "";
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

document.getElementById("settings-save-btn").addEventListener("click", async () => {
  const tmKey = document.getElementById("f-tm-api-key").value.trim();
  const clientId = document.getElementById("f-spotify-client-id").value.trim();
  const clientSecret = document.getElementById("f-spotify-client-secret").value.trim();
  const workerUrl = document.getElementById("f-ai-worker-url").value.trim();
  const proxyKey = document.getElementById("f-ai-proxy-key").value.trim();
  const useWebSearch = document.getElementById("f-ai-web-search").checked;

  try {
    if (tmKey) { await saveTmKey(currentUser.uid, tmKey); setTmStatus(true); }
    if (clientId && clientSecret) { await saveSpotifyKeys(currentUser.uid, clientId, clientSecret); setSpotifyStatus(true); }
    if (workerUrl && proxyKey) { await saveAiSettings(currentUser.uid, { workerUrl, proxyKey, useWebSearch }); setAiStatus(true); }
    showToast("Nastavení uloženo");
    closeSettingsModal();

    // Pokud byl TM klíč nově zadán, spusť search
    if (tmKey) runDiscoverySearch(0);
  } catch (err) {
    showToast("Chyba při ukládání: " + err.message, true);
  }
});
