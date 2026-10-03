/*
FILE: js/study.js
REFERENCE: CMA-ZONE-STUDY-V3
PURPOSE: Subject-first study timer with student-specific local study data.
EDITABLE AREAS: Storage key and tracker behaviour.
DEPENDENCIES: pages/study.html, css/study.css, js/academic.js, js/firebase.js.
IMPORTANT NOTES: Study data is isolated by Firebase Auth UID on this device. Firestore sync is a separate future step.
LAST UPDATED: 2026-10-04
*/

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const HOME_KEY = "cma_zone_home_v1";
const params = new URLSearchParams(window.location.search);
const queryElective = params.get("elective") || "";
let currentUser = null;
let state = { days: {}, active: null };
let SUBJECTS = [];

function storageKey() {
  return currentUser ? "cma_zone_study_v1_" + currentUser.uid : null;
}
function loadState() {
  const key = storageKey();
  if (!key) return { days: {}, active: null };
  try { return JSON.parse(localStorage.getItem(key) || '{"days":{},"active":null}'); }
  catch { return { days: {}, active: null }; }
}
function saveState() {
  const key = storageKey();
  if (key) localStorage.setItem(key, JSON.stringify(state));
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
  try { return JSON.parse(localStorage.getItem(HOME_KEY) || "{}"); } catch { return {}; }
}
function getSelectedSubjects() {
  const selection = loadHomeSelection();
  if (!selection.level || !selection.group || !ACADEMIC[selection.level]) return [];
  const groups = ACADEMIC[selection.level].groups;
  if (selection.group === "both") return ["g1","g2","g3","g4"].filter(key => groups[key]).flatMap(key => groups[key]);
  const selected = groups[selection.group] || [];
  if (selection.level === "final" && selection.group === "g4" && selection.elective) {
    const elective = groups.electives?.find(subject => subject[0] === selection.elective);
    return elective ? [...selected, elective] : selected;
  }
  return selected;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function getDay() {
  const key = todayKey();
  if (!state.days[key]) state.days[key] = { totals: {}, sessions: [] };
  return state.days[key];
}
function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), s = safe % 60;
  return [h,m,s].map(v => String(v).padStart(2,"0")).join(":");
}
function elapsedActive() { return state.active ? Math.max(0, (Date.now() - state.active.startedAt) / 1000) : 0; }
function subjectTotal(id) {
  const day = getDay();
  return (day.totals[id] || 0) + (state.active?.subjectId === id ? elapsedActive() : 0);
}
function dayTotal() { return SUBJECTS.reduce((sum, subject) => sum + subjectTotal(subject[0]), 0); }
function subjectName(id) { return SUBJECTS.find(subject => subject[0] === id)?.[1] || id; }
function commitActive() {
  if (!state.active) return;
  const duration = elapsedActive(), day = getDay();
  day.totals[state.active.subjectId] = (day.totals[state.active.subjectId] || 0) + duration;
  day.sessions.push({ subjectId: state.active.subjectId, start: state.active.startedAt, end: Date.now(), duration });
  state.active = null;
  saveState();
}
function startSubject(id) {
  if (!currentUser) return;
  if (state.active?.subjectId === id) commitActive();
  else {
    if (state.active) commitActive();
    state.active = { subjectId: id, startedAt: Date.now() };
    saveState();
  }
  render();
}
function render() {
  const total = document.getElementById("todayTotal"), activeStatus = document.getElementById("activeStatus"), list = document.getElementById("subjectList");
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
  activeStatus.textContent = state.active ? "Tracking: " + subjectName(state.active.subjectId) : "Choose a subject to begin.";
  list.innerHTML = SUBJECTS.map(subject => {
    const id = subject[0], name = subject[1], active = state.active?.subjectId === id;
    return `
      <button class="subject-row ${active ? "active" : ""}" type="button" data-subject="${id}">
        <span class="subject-play">${active ? "Ⅱ" : "▶"}</span>
        <span><span class="subject-name">${name}</span><span class="subject-meta">${active ? "Currently tracking" : "Tap to start / pause"}</span></span>
        <span class="subject-time">${formatTime(subjectTotal(id))}</span>
      </button>`;
  }).join("");
  list.querySelectorAll("[data-subject]").forEach(button => button.addEventListener("click", () => startSubject(button.dataset.subject)));
}
onAuthStateChanged(auth, user => {
  if (state.active && !user) state.active = null;
  currentUser = user;
  state = loadState();
  SUBJECTS = getSelectedSubjects();
  render();
});
render();
setInterval(render, 1000);
window.addEventListener("beforeunload", saveState);
