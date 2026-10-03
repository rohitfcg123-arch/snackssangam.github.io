/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V3
PURPOSE: Academic selection, automatic exam countdown, and independent revision countdown.
EDITABLE AREAS: Storage key and official exam schedule.
DEPENDENCIES: index.html, css/home.css, js/academic.js, browser localStorage.
IMPORTANT NOTES: Subjects come only from js/academic.js. Exam countdown uses the December 2026 ICMAI schedule and the first exam date applicable to the selected course/group.
LAST UPDATED: 2026-10-04
*/

const STORE = "cma_zone_home_v1";
const state = JSON.parse(localStorage.getItem(STORE) || "{}");
const $ = id => document.getElementById(id);
const level = $("levelSelect");
const group = $("groupSelect");
const subjects = $("subjectList");

/* December 2026 ICMAI examination dates. */
const EXAM_DATES = {
  foundation: "2026-12-13",
  inter: {
    g1: "2026-12-10",
    g2: "2026-12-11",
    both: "2026-12-10"
  },
  final: {
    g3: "2026-12-10",
    g4: "2026-12-11",
    both: "2026-12-10",
    electives: "2026-12-17"
  }
};

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function groupLabel(key) {
  if (key === "g1") return "Group 1";
  if (key === "g2") return "Group 2";
  if (key === "g3") return "Group 3";
  if (key === "g4") return "Group 4";
  if (key === "electives") return "Electives";
  return "Foundation";
}

function groupOptions() {
  group.innerHTML = '<option value="">Select group</option>';

  if (!level.value || !ACADEMIC[level.value]) {
    group.disabled = true;
    return;
  }

  const data = ACADEMIC[level.value].groups;

  Object.keys(data).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = groupLabel(key);
    group.appendChild(option);
  });

  if (level.value !== "foundation") {
    const option = document.createElement("option");
    option.value = "both";
    option.textContent = "Both Groups";
    group.appendChild(option);
  }

  group.disabled = false;
}

function list() {
  if (!level.value || !group.value || !ACADEMIC[level.value]) return [];

  const data = ACADEMIC[level.value].groups;

  if (group.value === "both") {
    return ["g1", "g2", "g3", "g4"]
      .filter(key => data[key])
      .flatMap(key => data[key]);
  }

  return data[group.value] || [];
}

function render() {
  const items = list();
  subjects.innerHTML = "";

  if (!items.length) {
    subjects.innerHTML =
      '<div class="empty-state">Select your level and group to see subjects.</div>';
    $("profileStatus").textContent = "Select your level and group.";
    return;
  }

  items.forEach((subject, index) => {
    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML =
      '<span class="subject-number">' + String(index + 1).padStart(2, "0") + '</span>' +
      '<div><strong>' + subject[0] + '</strong><span>' + subject[1] + '</span></div>';
    subjects.appendChild(card);
  });

  $("profileStatus").textContent =
    ACADEMIC[level.value].label + " • " +
    group.options[group.selectedIndex].text + " selected.";
}

function automaticExamDate() {
  if (!level.value || !group.value) return null;
  if (level.value === "foundation") return EXAM_DATES.foundation;
  return EXAM_DATES[level.value]?.[group.value] || null;
}

function syncExamDateToSelection() {
  const date = automaticExamDate();
  if (!date) return;

  state.attemptDate = date;
  state.attemptName = "December 2026 Attempt";
  $("attemptName").value = state.attemptName;
  $("attemptDate").value = date;
  save();
}

level.onchange = () => {
  groupOptions();
  state.level = level.value;
  state.group = "";
  state.attemptDate = "";
  state.attemptName = "";
  save();
  render();
  tick();
};

group.onchange = () => {
  state.level = level.value;
  state.group = group.value;
  syncExamDateToSelection();
  save();
  render();
  tick();
};

$("saveProfile").onclick = () => {
  state.level = level.value;
  state.group = group.value;
  syncExamDateToSelection();
  save();
  $("profileStatus").textContent = "Selection saved on this device.";
  tick();
};

function days(date) {
  if (!date) return null;

  const target = new Date(date + "T23:59:59");
  return Math.max(0, Math.ceil((target - Date.now()) / 86400000));
}

function tick() {
  const attemptDays = days(state.attemptDate);

  $("attemptCountdown").textContent =
    attemptDays === null ? "—" : attemptDays + " days";

  $("attemptDateLabel").textContent =
    state.attemptDate
      ? (state.attemptName || "December 2026 Attempt") +
        " • First exam: " + state.attemptDate
      : "Select your course and group";

  const revisionDays = days(state.revisionDate);

  $("revisionCountdown").textContent =
    revisionDays === null ? "—" : revisionDays + " days";
}

$("editAttempt").onclick = () => {
  $("attemptEditor").classList.toggle("hidden");
};

$("saveAttempt").onclick = () => {
  state.attemptName = $("attemptName").value.trim() || "Attempt";
  state.attemptDate = $("attemptDate").value;
  save();
  $("attemptEditor").classList.add("hidden");
  tick();
};

$("editRevision").onclick = () => {
  $("revisionEditor").classList.toggle("hidden");
  $("revisionEmpty").classList.toggle("hidden", false);
};

$("saveRevision").onclick = () => {
  state.revisionName = $("revisionNameInput").value.trim() || "Revision";
  state.revisionDate = $("revisionDate").value;

  save();

  $("revisionName").textContent = state.revisionName;
  $("revisionDateLabel").textContent = state.revisionDate || "";
  $("revisionEmpty").classList.add("hidden");
  $("revisionEditor").classList.add("hidden");
  $("revisionView").classList.remove("hidden");

  tick();
};

if (state.level && ACADEMIC[state.level]) {
  level.value = state.level;
  groupOptions();
  group.value = state.group || "";
  render();
}

if (state.attemptName) $("attemptName").value = state.attemptName;
if (state.attemptDate) $("attemptDate").value = state.attemptDate;

if (state.revisionName) {
  $("revisionName").textContent = state.revisionName;
  $("revisionDateLabel").textContent = state.revisionDate || "";
  $("revisionEmpty").classList.add("hidden");
  $("revisionView").classList.remove("hidden");
}

tick();
setInterval(tick, 60000);
