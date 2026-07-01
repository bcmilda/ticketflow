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
  if (!clientId || !clientSecret) {
    showToast("Vyplň Client ID i Client Secret", true);
    return;
  }
  try {
    await saveSpotifyKeys(currentUser.uid, clientId, clientSecret);
    setSpotifyStatus(true);
    showToast("Spotify klíče uloženy");
    closeSettingsModal();
  } catch (err) {
    showToast("Chyba při ukládání klíčů: " + err.message, true);
  }
});
