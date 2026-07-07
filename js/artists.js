// Tabulka interpretů — TicketFlow
// Sbírá interprety a jejich Spotify metriky do vlastního žebříčku
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { getArtist } from "./spotify.js";

function artistsCol(uid) {
  return collection(db, "users", uid, "artists");
}

export function watchArtists(uid, callback) {
  const q = query(artistsCol(uid), orderBy("popularity", "desc"));
  return onSnapshot(q, (snap) => {
    const artists = [];
    snap.forEach((d) => artists.push({ id: d.id, ...d.data() }));
    callback(artists);
  });
}

export async function addArtist(uid, spotifyArtist) {
  // Zkontroluj duplicity podle Spotify ID
  const existing = await getDocs(artistsCol(uid));
  let dupe = null;
  existing.forEach((d) => {
    if (d.data().spotifyId === spotifyArtist.id) dupe = d.id;
  });

  const data = {
    spotifyId: spotifyArtist.id,
    name: spotifyArtist.name,
    popularity: spotifyArtist.popularity ?? 0,
    followers: spotifyArtist.followers ?? 0,
    genres: spotifyArtist.genres || [],
    imageUrl: spotifyArtist.imageUrl || null,
    spotifyUrl: spotifyArtist.spotifyUrl || null,
    updatedAt: serverTimestamp()
  };

  if (dupe) {
    await updateDoc(doc(db, "users", uid, "artists", dupe), data);
    return { updated: true };
  } else {
    await addDoc(artistsCol(uid), { ...data, createdAt: serverTimestamp() });
    return { added: true };
  }
}

export async function deleteArtist(uid, artistId) {
  return deleteDoc(doc(db, "users", uid, "artists", artistId));
}

// Aktualizuje Spotify metriky všech uložených interpretů (popularity/followers se mění v čase)
export async function refreshAllArtists(uid, onProgress) {
  const snap = await getDocs(artistsCol(uid));
  const artists = [];
  snap.forEach((d) => artists.push({ id: d.id, ...d.data() }));

  let done = 0;
  for (const artist of artists) {
    if (!artist.spotifyId) continue;
    try {
      const fresh = await getArtist(uid, artist.spotifyId);
      await updateDoc(doc(db, "users", uid, "artists", artist.id), {
        popularity: fresh.popularity ?? artist.popularity,
        followers: fresh.followers ?? artist.followers,
        genres: fresh.genres || artist.genres,
        imageUrl: fresh.imageUrl || artist.imageUrl,
        updatedAt: serverTimestamp()
      });
    } catch { /* přeskoč chybu */ }
    done++;
    if (onProgress) onProgress(done, artists.length);
    await new Promise((r) => setTimeout(r, 200));
  }
  return done;
}
