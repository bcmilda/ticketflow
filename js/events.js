// Práce s událostmi ve Firestore — TicketFlow
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

function eventsCol(uid) {
  return collection(db, "users", uid, "events");
}

export function watchEvents(uid, callback) {
  const q = query(eventsCol(uid), orderBy("eventDate", "asc"));
  return onSnapshot(q, (snap) => {
    const events = [];
    snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
    callback(events);
  });
}

export async function createEvent(uid, data) {
  return addDoc(eventsCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateEvent(uid, eventId, data) {
  return updateDoc(doc(db, "users", uid, "events", eventId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteEvent(uid, eventId) {
  return deleteDoc(doc(db, "users", uid, "events", eventId));
}

// --- Pomocné výpočty ---

export function calcMargin(purchasePrice, targetSellPrice) {
  const p = Number(purchasePrice) || 0;
  const t = Number(targetSellPrice) || 0;
  const abs = t - p;
  const pct = p > 0 ? (abs / p) * 100 : 0;
  return { abs, pct };
}

export function calcQueueRatio(queueSize, capacity) {
  const q = Number(queueSize) || 0;
  const c = Number(capacity) || 0;
  if (c <= 0) return null;
  return q / c;
}

const DAY_NAMES_CZ = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

export function dayOfWeekFromDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return DAY_NAMES_CZ[d.getDay()];
}
