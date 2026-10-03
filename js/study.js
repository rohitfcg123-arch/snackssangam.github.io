/*
FILE: js/study.js
REFERENCE: CMA-ZONE-STUDY-V1
PURPOSE: First real study-tracking engine: subject click starts, same subject pauses, another subject switches.
EDITABLE AREAS: Subject master for this screen and local persistence key.
DEPENDENCIES: pages/study.html, css/study.css, browser localStorage.
IMPORTANT NOTES: This V1 stores data locally for testing only. Production sync/authentication will be added after the verified foundation.
LAST UPDATED: 2026-10-04
*/

const STORAGE_KEY = "cma_zone_study_v1";

const SUBJECTS = [
  { id: "scm", name: "Strategic Cost Management" },
  { id: "sfm", name: "Strategic Financial Management" },
  { id: "law", name: "Corporate and Economic Laws" },
  { id: "dt", name: "Direct and International Taxation" }
];

const state = loadState();

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
  return [h, m, s].map((v, i) => i === 0 ? String(v).padStart(2, "0") : String(v).padStart(2, "0")).join(":");
}

function elapsedActive() {
  if (!state.active) return 0;
  return Math.max(0, (Date.now() - state.active.startedAt) / 1000);
}

function subjectTotal(id) {
  const day = getDay();
  return (day.totals[id] || 0) + (state.active?.subjectId === id ? elapsedActive() : 0);
}

function dayTotal() {
  return SUBJECTS.reduce((sum, subject) => sum + subjectTotal(subject.id), 0);
}

function subjectName(id) {
  return SUBJECTS.find(subject => subject.id === id)?.name || id;
}

function commitActive() {
  if (!state.active) return;
  const duration = elapsedActive();
  const day = getDay();
  day.totals[state.active.subjectId] = (day.totals[state.active.subjectId] || 0) + duration;
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
    state.active = { subjectId: id, startedAt: Date.now() };
    saveState();
  }
  render();
}

function render() {
  document.getElementById("todayTotal").textContent = formatTime(dayTotal());
  const activeStatus = document.getElementById("activeStatus");

  if (state.active) {
    activeStatus.textContent = "Tracking: " + subjectName(state.active.subjectId);
  } else {
    activeStatus.textContent = "Choose a subject to begin.";
  }

  const list = document.getElementById("subjectList");
  list.innerHTML = SUBJECTS.map(subject => {
    const active = state.active?.subjectId === subject.id;
    return `
      <button class="subject-row ${active ? "active" : ""}" type="button" data-subject="${subject.id}">
        <span class="subject-play">${active ? "Ⅱ" : "▶"}</span>
        <span>
          <span class="subject-name">${subject.name}</span>
          <span class="subject-meta">${active ? "Currently tracking" : "Tap to start / pause"}</span>
        </span>
        <span class="subject-time">${formatTime(subjectTotal(subject.id))}</span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => startSubject(button.dataset.subject));
  });
}

render();

setInterval(() => {
  render();
}, 1000);

window.addEventListener("beforeunload", saveState);