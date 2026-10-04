/*
FILE: js/study.js
REFERENCE: CMA-ZONE-STUDY-FIRESTORE-V3
PURPOSE: Subject-first study timer with Firestore persistence plus student-managed custom subjects.
EDITABLE AREAS: Firestore paths, subject rendering and custom-subject behaviour.
DEPENDENCIES: pages/study.html, css/study.css, js/academic.js, js/firebase.js.
IMPORTANT NOTES: Study records use users/{UID}/studyDays/{YYYY-MM-DD}. Custom subjects use users/{UID}/studyDays/__config__ so no new Firestore rule is required.
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
const CONFIG_DOC_ID = "__config__";
const params = new URLSearchParams(window.location.search);
const queryElective = params.get("elective") || "";

let currentUser = null;
let state = { days: {}, active: null };
let SUBJECTS = [];
let customSubjects = [];
let saving = false;
const CUSTOM_CACHE_PREFIX = "cma_zone_custom_subjects_v1:";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function studyDocRef(dateKey = todayKey()) {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "studyDays", dateKey);
}

function configDocRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "studyDays", CONFIG_DOC_ID);
}

function customCacheKey(){
  return currentUser ? CUSTOM_CACHE_PREFIX + currentUser.uid : "";
}
function readCachedCustomSubjects(){
  if(!currentUser) return [];
  try{
    const items=JSON.parse(localStorage.getItem(customCacheKey())||"[]");
    return Array.isArray(items)
      ? items.filter(item=>Array.isArray(item)&&item.length>=2&&item[0]&&item[1])
        .map(item=>[String(item[0]),String(item[1]),"custom"])
      : [];
  }catch{return [];}
}
function writeCachedCustomSubjects(items){
  if(!currentUser) return;
  try{localStorage.setItem(customCacheKey(),JSON.stringify(items));}catch{}
}

async function loadCustomSubjects() {
  if (!currentUser) return [];
  const cached=readCachedCustomSubjects();

  try {
    const snap = await getDoc(configDocRef());
    if (!snap.exists()) return [];

    const items = Array.isArray(snap.data().customSubjects)
      ? snap.data().customSubjects
      : [];

    const remote=items
      .filter(item => Array.isArray(item) && item.length >= 2 && item[0] && item[1])
      .map(item => [String(item[0]), String(item[1]), "custom"]);
    const merged=[...remote,...cached].filter((item,i,arr)=>
      arr.findIndex(x=>String(x[0])===String(item[0]))===i
    );
    writeCachedCustomSubjects(merged);
    return merged;
  } catch (error) {
    console.error("Firestore custom subject read failed:", error);
    showFirestoreError(error);
    return cached;
  }
}

async function saveCustomSubjects() {
  if (!currentUser) return;
  writeCachedCustomSubjects(customSubjects);

  try {
    await setDoc(
      configDocRef(),
      {
        customSubjects,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Firestore custom subject write failed:", error);
    showFirestoreError(error);
  }
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
  const status = document.getElementById("activeStatus");
  if (!status) return;

  if (error?.code === "permission-denied") {
    status.textContent = "Firestore permission denied. Check Firebase Firestore Rules.";
  } else if (error?.code === "failed-precondition") {
    status.textContent = "Firestore is not ready. Check the Firebase project.";
  }
}

function loadHomeSelection() {
  const queryLevel = params.get("level");
  const queryGroup = params.get("group");

  if (queryLevel && queryGroup && ACADEMIC[queryLevel]) {
    const groups = ACADEMIC[queryLevel].groups;
    const validGroup = queryGroup === "both"
      ? queryLevel !== "foundation"
      : !!groups[queryGroup];

    if (validGroup) {
      const selection = {
        level: queryLevel,
        group: queryGroup,
        elective: queryElective
      };
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

function refreshSubjects() {
  SUBJECTS = [...getSelectedSubjects(), ...customSubjects];
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
  return (day.totals[id] || 0) +
    (state.active?.subjectId === id ? elapsedActive() : 0);
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

function openCustomSubjectEditor() {
  const modal = document.getElementById("customSubjectModal");
  const input = document.getElementById("customSubjectName");
  if (!modal || !input) return;

  input.value = "";
  modal.classList.remove("hidden");
  setTimeout(() => input.focus(), 50);
}

function closeCustomSubjectEditor() {
  document.getElementById("customSubjectModal")?.classList.add("hidden");
}

async function addCustomSubject() {
  const input = document.getElementById("customSubjectName");
  const name = input?.value.trim();

  if (!name) {
    input?.focus();
    return;
  }

  if (!currentUser) return;

  const duplicate = customSubjects.some(
    subject => subject[1].toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    input.value = "";
    input.placeholder = "Already added — enter another name";
    input.focus();
    return;
  }

  customSubjects.push([
    "custom_" + Date.now(),
    name,
    "custom"
  ]);

  // Persist locally immediately so a render/auth refresh cannot make the new subject disappear.
  writeCachedCustomSubjects(customSubjects);
  await saveCustomSubjects();
  refreshSubjects();
  closeCustomSubjectEditor();
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
    list.innerHTML =
      '<div class="empty-state">Please login to start your personal study tracker.</div>';
    return;
  }

  if (!SUBJECTS.length) {
    activeStatus.textContent = "Add a custom subject or choose your course and group.";
    list.innerHTML =
      '<div class="study-setup">' +
        '<strong>No subjects selected yet</strong>' +
        '<span>Choose your course and group on Home, or add a custom tracker below for revision, mock tests, reading, etc.</span>' +
        '<a href="../index.html">Choose course / group</a>' +
      '</div>' +
      '<button class="custom-add-row" id="addCustomSubject" type="button">' +
        '<span class="custom-add-icon">＋</span>' +
        '<span><strong>Add custom subject</strong><small>Revision, mock test, reading or anything else</small></span>' +
      '</button>';

    document.getElementById("addCustomSubject")
      ?.addEventListener("click", openCustomSubjectEditor);

    return;
  }

  activeStatus.textContent = state.active
    ? "Tracking: " + subjectName(state.active.subjectId)
    : "Choose a subject to begin.";

  list.innerHTML = SUBJECTS.map(subject => {
    const id = subject[0];
    const name = subject[1];
    const isCustom = subject[2] === "custom";
    const active = state.active?.subjectId === id;

    return `
      <button class="subject-row ${active ? "active" : ""}" type="button" data-subject="${id}">
        <span class="subject-play">${active ? "Ⅱ" : "▶"}</span>
        <span>
          <span class="subject-name">${name}</span>
          <span class="subject-meta">${isCustom ? "Custom tracker" : (active ? "Currently tracking" : "Tap to start / pause")}</span>
        </span>
        <span class="subject-time">${formatTime(subjectTotal(id))}</span>
      </button>`;
  }).join("") +
  `
    <button class="custom-add-row" id="addCustomSubject" type="button">
      <span class="custom-add-icon">＋</span>
      <span><strong>Add custom subject</strong><small>Add revision, mock test, reading or any extra study activity</small></span>
    </button>`;

  list.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => startSubject(button.dataset.subject));
  });

  document.getElementById("addCustomSubject")
    ?.addEventListener("click", openCustomSubjectEditor);
}

const customAddButton = document.getElementById("saveCustomSubject");
const customCancelButton = document.getElementById("cancelCustomSubject");
const customCloseButton = document.getElementById("closeCustomSubject");

customAddButton?.addEventListener("click", addCustomSubject);
customCancelButton?.addEventListener("click", closeCustomSubjectEditor);
customCloseButton?.addEventListener("click", closeCustomSubjectEditor);

document.getElementById("customSubjectModal")?.addEventListener("click", event => {
  if (event.target.id === "customSubjectModal") closeCustomSubjectEditor();
});

document.getElementById("customSubjectName")?.addEventListener("keydown", event => {
  if (event.key === "Enter") addCustomSubject();
  if (event.key === "Escape") closeCustomSubjectEditor();
});

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!currentUser) {
    state = { days: {}, active: null };
    SUBJECTS = [];
    customSubjects = [];
    render();
    return;
  }

  state = await loadFirestoreState();
  customSubjects = await loadCustomSubjects();
  refreshSubjects();
  render();
});

render();
setInterval(render, 1000);

window.addEventListener("beforeunload", () => {
  if (currentUser) saveTodayToFirestore();
});
