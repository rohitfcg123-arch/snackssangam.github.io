/*
FILE: js/study.js
REFERENCE: CMA-ZONE-STUDY-FIRESTORE-V1
PURPOSE: Subject-first study timer with Firebase Cloud Firestore persistence.
EDITABLE AREAS: Firestore collection path and tracker behaviour.
DEPENDENCIES: pages/study.html, css/study.css, js/academic.js, js/firebase.js.
IMPORTANT NOTES: Study data is stored under users/{UID}/studyDays/{YYYY-MM-DD}. LocalStorage is not used for study records.
LAST UPDATED: 2026-10-04
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const HOME_KEY = "cma_zone_home_v1";
const params = new URLSearchParams(window.location.search);
const queryElective = params.get("elective") || "";

let currentUser = null;
let state = { days: {}, active: null };
let SUBJECTS = [];
let saving = false;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function studyDocRef(dateKey = todayKey()) {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "studyDays", dateKey);
}

async function loadFirestoreState() {
  if (!currentUser) return { days: {}, active: null };

  try {
    const snap = await getDoc(studyDocRef());
    if (!snap.exists()) return { days: {}, active: null };

    const data = snap.data();
    return {
      days: {
        [todayKey()]: {
          totals: data.totals || {},
          sessions: data.sessions || []
        }
      },
      active: data.active || null
    };
  } catch (error) {
    console.error("Firestore study read failed:", error);
    showFirestoreError(error);
    return { days: {}, active: null };
  }
}

async function saveTodayToFirestore() {
  if (!currentUser || saving) return;

  saving = true;
  try {
    const day = state.days[todayKey()] || { totals: {}, sessions: [] };

    await setDoc(
      studyDocRef(),
      {
        date: todayKey(),
        totals: day.totals || {},
        sessions: day.sessions || [],
        active: state.active || null,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Firestore study write failed:", error);
    showFirestoreError(error);
  } finally {
    saving = false;
  }
}

function showFirestoreError(error) {
  if (error?.code === "permission-denied") {
    const status = document.getElementById("activeStatus");
    if (status) status.textContent = "Firestore permission denied. Check Firebase Firestore Rules.";
  }
}

function loadHomeSelection() {
  const queryLevel = params.get("level");
  const queryGroup = params.get("group");

  if (queryLevel && queryGroup && ACADEMIC[queryLevel]) {
    const groups = ACADEMIC[queryLevel].groups;
    const validGroup = queryGroup === "both" ? queryLevel !== "foundation" : !!groups[queryGroup];

    if (validGroup) {
      const selection = { level: queryLevel, group: queryGroup, elective: queryElective };
      localStorage.setItem(HOME_KEY, JSON.stringify(selection));
      return selection;
    }
  }

  try {
    return JSON.parse(localStorage.getItem(HOME_KEY) || "{}");
  } catch {
    return {};
  }
}

function getSelectedSubjects() {
  const selection = loadHomeSelection();
  if (!selection.level || !selection.group || !ACADEMIC[selection.level]) return [];

  const groups = ACADEMIC[selection.level].groups;

  if (selection.group === "both") {
    return ["g1", "g2", "g3", "g4"]
      .filter(key => groups[key])
      .flatMap(key => groups[key]);
  }

  const selected = groups[selection.group] || [];

  if (selection.level === "final" && selection.group === "g4" && selection.elective) {
    const elective = groups.electives?.find(subject => subject[0] === selection.elective);
    return elective ? [...selected, elective] : selected;
  }

  return selected;
}

function getDay() {
  const key = todayKey();
  if (!state.days[key]) state.days[key] = { totals: {}, sessions: [] };
  return state.days[key];
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function elapsedActive() {
  return state.active
    ? Math.max(0, (Date.now() - Number(state.active.startedAt || 0)) / 1000)
    : 0;
}

function subjectTotal(id) {
  const day = getDay();
  return (day.totals[id] || 0) + (state.active?.subjectId === id ? elapsedActive() : 0);
}

function dayTotal() {
  return SUBJECTS.reduce((sum, subject) => sum + subjectTotal(subject[0]), 0);
}

function subjectName(id) {
  return SUBJECTS.find(subject => subject[0] === id)?.[1] || id;
}

async function commitActive() {
  if (!state.active) return;

  const duration = elapsedActive();
  const day = getDay();

  day.totals[state.active.subjectId] =
    (day.totals[state.active.subjectId] || 0) + duration;

  day.sessions.push({
    subjectId: state.active.subjectId,
    start: state.active.startedAt,
    end: Date.now(),
    duration
  });

  state.active = null;
  await saveTodayToFirestore();
}

async function startSubject(id) {
  if (!currentUser) return;

  if (state.active?.subjectId === id) {
    await commitActive();
  } else {
    if (state.active) await commitActive();

    state.active = {
      subjectId: id,
      startedAt: Date.now()
    };

    await saveTodayToFirestore();
  }

  render();
}

function render() {
  const total = document.getElementById("todayTotal");
  const activeStatus = document.getElementById("activeStatus");
  const list = document.getElementById("subjectList");

  if (!total || !activeStatus || !list) return;

  total.textContent = formatTime(dayTotal());

  if (!currentUser) {
    activeStatus.textContent = "Login first to track your study.";
    list.innerHTML = '<div class="empty-state">Please login to start your personal study tracker.</div>';
    return;
  }

  if (!SUBJECTS.length) {
    activeStatus.textContent = "Select your course and group on Home first.";
    list.innerHTML = '<div class="empty-state">No subjects selected yet. Go to Home and choose your course and group.</div>';
    return;
  }

  activeStatus.textContent = state.active
    ? "Tracking: " + subjectName(state.active.subjectId)
    : "Choose a subject to begin.";

  list.innerHTML = SUBJECTS.map(subject => {
    const id = subject[0];
    const name = subject[1];
    const active = state.active?.subjectId === id;

    return `
      <button class="subject-row ${active ? "active" : ""}" type="button" data-subject="${id}">
        <span class="subject-play">${active ? "Ⅱ" : "▶"}</span>
        <span>
          <span class="subject-name">${name}</span>
          <span class="subject-meta">${active ? "Currently tracking" : "Tap to start / pause"}</span>
        </span>
        <span class="subject-time">${formatTime(subjectTotal(id))}</span>
      </button>`;
  }).join("");

  list.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => startSubject(button.dataset.subject));
  });
}

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!currentUser) {
    state = { days: {}, active: null };
    SUBJECTS = [];
    render();
    return;
  }

  state = await loadFirestoreState();
  SUBJECTS = getSelectedSubjects();
  render();
});

render();
setInterval(render, 1000);
window.addEventListener("beforeunload", () => {
  if (currentUser) saveTodayToFirestore();
});
