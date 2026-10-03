/*
FILE: js/study.js
REFERENCE: CMA-ZONE-STUDY-V2
PURPOSE: Subject-first study timer using the subjects selected on the Home screen.
EDITABLE AREAS: Storage key and tracker behaviour.
DEPENDENCIES: pages/study.html, css/study.css, js/academic.js, Home selection in localStorage.
IMPORTANT NOTES: This V1 stores data locally for testing only. One subject can be active at a time.
LAST UPDATED: 2026-10-04
*/

const STORAGE_KEY = "cma_zone_study_v1";
const HOME_KEY = "cma_zone_home_v1";

const state = loadState();
const SUBJECTS = getSelectedSubjects();

function loadHomeSelection() {
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

  return groups[selection.group] || [];
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDay() {
  return { totals: {}, sessions: [] };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return { days: {}, active: null };
    return saved;
  } catch {
    return { days: {}, active: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDay() {
  const key = todayKey();
  if (!state.days[key]) state.days[key] = createDay();
  return state.days[key];
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function elapsedActive() {
  if (!state.active) return 0;
  return Math.max(0, (Date.now() - state.active.startedAt) / 1000);
}

function subjectTotal(id) {
  const day = getDay();
  return (day.totals[id] || 0) +
    (state.active?.subjectId === id ? elapsedActive() : 0);
}

function dayTotal() {
  return SUBJECTS.reduce(
    (sum, subject) => sum + subjectTotal(subject[0]),
    0
  );
}

function subjectName(id) {
  return SUBJECTS.find(subject => subject[0] === id)?.[1] || id;
}

function commitActive() {
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
  saveState();
}

function startSubject(id) {
  if (state.active?.subjectId === id) {
    commitActive();
  } else {
    if (state.active) commitActive();
    state.active = {
      subjectId: id,
      startedAt: Date.now()
    };
    saveState();
  }

  render();
}

function render() {
  document.getElementById("todayTotal").textContent =
    formatTime(dayTotal());

  const activeStatus = document.getElementById("activeStatus");
  const list = document.getElementById("subjectList");

  if (!SUBJECTS.length) {
    activeStatus.textContent = "Select your course and group on Home first.";
    list.innerHTML =
      '<div class="empty-state">No subjects selected yet. Go to Home and choose your course and group.</div>';
    return;
  }

  if (state.active) {
    activeStatus.textContent =
      "Tracking: " + subjectName(state.active.subjectId);
  } else {
    activeStatus.textContent = "Choose a subject to begin.";
  }

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
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => startSubject(button.dataset.subject));
  });
}

render();
setInterval(render, 1000);
window.addEventListener("beforeunload", saveState);
