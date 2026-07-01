// Firebase inicializace — TicketFlow
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_FWEQkkFehNK3JnERurxt9PP001wQ8eg",
  authDomain: "ticketflow-8e17a.firebaseapp.com",
  projectId: "ticketflow-8e17a",
  storageBucket: "ticketflow-8e17a.firebasestorage.app",
  messagingSenderId: "965819500728",
  appId: "1:965819500728:web:444aa6e0c120f8ff504c4d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
