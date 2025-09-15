import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { get, getDatabase, onValue, push, ref, serverTimestamp, set, update } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const app = initializeApp({
  apiKey: "AIzaSyA5Lbelr0RkaqYEjXGmP7b3GCKgYf3ZETA",
  authDomain: "joryai.firebaseapp.com",
  projectId: "joryai",
  storageBucket: "joryai.firebasestorage.app",
  messagingSenderId: "795696052228",
  appId: "1:795696052228:web:9d61ee4d1aedf6c77ddd51"
});

const db = getDatabase(app);
window.firebaseDb = db;
window.firebaseUtils = { get, onValue, push, ref, serverTimestamp, set, update };