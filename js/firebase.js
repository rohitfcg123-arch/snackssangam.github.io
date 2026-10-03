/*
FILE: js/firebase.js
REFERENCE: FIREBASE-BACKEND-V1
PURPOSE: Initialize Firebase for CMA Zone and expose Authentication + Cloud Firestore.
EDITABLE AREAS: firebaseConfig only when Firebase project/app changes.
DEPENDENCIES: Firebase Web SDK 12.19.0 via official Google CDN.
IMPORTANT NOTES: Firestore is connected but no study data is written yet. Existing study logic is intentionally unchanged in this step.
LAST UPDATED: 2026-10-04
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhnfCewVByEc_ASkvx8rjS9ulasIkX5Ls",
  authDomain: "cma-zone-tracker.firebaseapp.com",
  projectId: "cma-zone-tracker",
  storageBucket: "cma-zone-tracker.firebasestorage.app",
  messagingSenderId: "635442275899",
  appId: "1:635442275899:web:fed4a624aa9f7d89ae5e1e",
  measurementId: "G-EQR8GHBTLD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
