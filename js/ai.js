// AI analýza (Claude přes Cloudflare Worker proxy) — TicketFlow
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function saveAiSettings(uid, { workerUrl, proxyKey, useWebSearch }) {
  await setDoc(doc(db, "users", uid, "settings", "ai"), {
    workerUrl: workerUrl.trim(),
    proxyKey: proxyKey.trim(),
    useWebSearch: !!useWebSearch,
    updatedAt: new Date().toISOString()
  });
}

export async function getAiSettings(uid) {
  const snap = await getDoc(doc(db, "users", uid, "settings", "ai"));
  return snap.exists() ? snap.data() : null;
}

export async function hasAiSettings(uid) {
  const s = await getAiSettings(uid);
  return !!(s && s.workerUrl && s.proxyKey);
}

// Pošle data události na proxy Worker, který zavolá Claude API a vrátí strukturovanou analýzu.
export async function runAiAnalysis(uid, eventData, algoScore) {
  const settings = await getAiSettings(uid);
  if (!settings || !settings.workerUrl || !settings.proxyKey) {
    throw new Error("NO_AI_SETTINGS");
  }

  const res = await fetch(settings.workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Key": settings.proxyKey
    },
    body: JSON.stringify({
      event: eventData,
      algoScore: algoScore || null,
      useWebSearch: !!settings.useWebSearch
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PROXY_ERROR (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data || typeof data.score !== "number") {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    score: data.score,
    label: data.label || "",
    reasoning: data.reasoning || "",
    risks: Array.isArray(data.risks) ? data.risks : [],
    additionalChecks: Array.isArray(data.additionalChecks) ? data.additionalChecks : [],
    confidence: data.confidence || "medium",
    analyzedAt: new Date().toISOString()
  };
}
