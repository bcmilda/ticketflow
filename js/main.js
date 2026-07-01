// Hlavní vstupní bod — TicketFlow
import { login, logout, watchAuth } from "./auth.js";
import {
  watchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  dayOfWeekFromDate
} from "./events.js";
import {
  searchArtists,
  saveSpotifyKeys,
  getSpotifyKeys,
  hasSpotifyKeys
} from "./spotify.js";
import {
  saveAiSettings,
  getAiSettings,
  hasAiSettings,
  runAiAnalysis
} from "./ai.js";
import {
  renderEvents,
  filterEvents,
  updateStats,
  resetEventForm,
  populateEventForm,
  collectEventFormData,
  openEventModal,
  closeEventModal,
  showSpotifyChip,
  hideSpotifyChip,
  renderArtistSuggestions,
  closeArtistSuggestions,
  openSettingsModal,
  closeSettingsModal,
  setSpotifyStatus,
  setAiStatus,
  refreshAlgoScorePanel,
  showAiLoading,
  showAiResult,
  showAiError,
  showToast
} from "./ui.js";

let currentUser = null;
let allEvents = [];
let unsubscribeEvents = null;
let selectedSpotifyArtist = null;
let searchDebounce = null;

// ---------------------------------------------
// Auth
// ---------------------------------------------

watchAuth(async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    document.getElementById("user-email").textContent = user.email || "";

    if (unsubscribeEvents) unsubscribeEvents();
    unsubscribeEvents = watchEvents(user.uid, (events) => {
      allEvents = events;
      refreshGrid();
    });

    const connected = await hasSpotifyKeys(user.uid).catch(() => false);
    setSpotifyStatus(connected);
    const aiConnected = await hasAiSettings(user.uid).catch(() => false);
    setAiStatus(aiConnected);
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-shell").style.display = "none";
    if (unsubscribeEvents) unsubscribeEvents();
    allEvents = [];
  }
});

document.getElementById("login-btn").addEventListener("click", async () => {
  try {
    await login();
  } catch (err) {
    showToast("Přihlášení selhalo: " + err.message, true);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => logout());

// ---------------------------------------------
// Dashboard rendering / filtering
// ---------------------------------------------

function refreshGrid() {
  const term = document.getElementById("search-input").value;
  const status = document.getElementById("status-filter").value;
  const filtered = filterEvents(allEvents, term, status);
  renderEvents(filtered);
  updateStats(allEvents);
}

document.getElementById("search-input").addEventListener("input", refreshGrid);
document.getElementById("status-filter").addEventListener("change", refreshGrid);

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
    if (confirm(`Smazat událost „${ev.artistName}“?`)) {
      deleteEvent(currentUser.uid, id)
        .then(() => showToast("Událost smazána"))
        .catch((err) => showToast("Chyba: " + err.message, true));
    }
  }
});

// ---------------------------------------------
// Event modal — open / close / save
// ---------------------------------------------

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

// přepočítej algoritmické skóre při jakékoliv změně ve formuláři
document.getElementById("event-form").addEventListener("input", refreshAlgoScorePanel);
document.getElementById("event-form").addEventListener("change", refreshAlgoScorePanel);

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

document.getElementById("event-save-btn").addEventListener("click", async () => {
  const form = document.getElementById("event-form");
  if (!form.reportValidity()) return;

  const data = collectEventFormData();
  const editId = form.dataset.editId;

  try {
    if (editId) {
      await updateEvent(currentUser.uid, editId, data);
      showToast("Událost uložena");
    } else {
      await createEvent(currentUser.uid, data);
      showToast("Událost přidána");
    }
    closeEventModal();
  } catch (err) {
    showToast("Chyba při ukládání: " + err.message, true);
  }
});

// ---------------------------------------------
// Spotify artist search (autocomplete)
// ---------------------------------------------

const artistInput = document.getElementById("f-artistName");

artistInput.addEventListener("input", () => {
  hideSpotifyChip();
  delete document.getElementById("event-form").dataset.spotifyData;

  clearTimeout(searchDebounce);
  const term = artistInput.value;
  if (term.trim().length < 2) {
    closeArtistSuggestions();
    return;
  }
  searchDebounce = setTimeout(async () => {
    if (!currentUser) return;
    try {
      const results = await searchArtists(currentUser.uid, term);
      renderArtistSuggestions(results, onArtistPicked);
    } catch (err) {
      if (err.message === "NO_KEYS") {
        showToast("Nejdřív nastav Spotify klíče v Nastavení ⚙", true);
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

// ---------------------------------------------
// Settings modal — Spotify keys
// ---------------------------------------------

document.getElementById("settings-btn").addEventListener("click", async () => {
  if (!currentUser) return;
  const keys = await getSpotifyKeys(currentUser.uid).catch(() => null);
  document.getElementById("f-spotify-client-id").value = keys?.clientId || "";
  document.getElementById("f-spotify-client-secret").value = keys?.clientSecret || "";

  const aiSettings = await getAiSettings(currentUser.uid).catch(() => null);
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
  const clientId = document.getElementById("f-spotify-client-id").value;
  const clientSecret = document.getElementById("f-spotify-client-secret").value;
  const workerUrl = document.getElementById("f-ai-worker-url").value;
  const proxyKey = document.getElementById("f-ai-proxy-key").value;
  const useWebSearch = document.getElementById("f-ai-web-search").checked;

  try {
    if (clientId || clientSecret) {
      if (!clientId || !clientSecret) {
        showToast("Vyplň Client ID i Client Secret (Spotify)", true);
        return;
      }
      await saveSpotifyKeys(currentUser.uid, clientId, clientSecret);
      setSpotifyStatus(true);
    }

    if (workerUrl || proxyKey) {
      if (!workerUrl || !proxyKey) {
        showToast("Vyplň Worker URL i Proxy Secret (AI)", true);
        return;
      }
      await saveAiSettings(currentUser.uid, { workerUrl, proxyKey, useWebSearch });
      setAiStatus(true);
    }

    showToast("Nastavení uloženo");
    closeSettingsModal();
  } catch (err) {
    showToast("Chyba při ukládání nastavení: " + err.message, true);
  }
});
