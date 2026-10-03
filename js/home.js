/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V2
PURPOSE: Academic selection and independent attempt/revision countdowns.
EDITABLE AREAS: Storage key and countdown settings.
DEPENDENCIES: index.html, css/home.css, js/academic.js, browser localStorage.
IMPORTANT NOTES: Academic names come only from js/academic.js. V1 stores settings locally; account sync/auth comes later.
LAST UPDATED: 2026-10-04
*/

const STORE = "cma_zone_home_v1";
const state = JSON.parse(localStorage.getItem(STORE) || "{}");
const $ = id => document.getElementById(id);
const level = $("levelSelect");
const group = $("groupSelect");
const subjects = $("subjectList");

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

  if (!level.value) {
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
  if (!level.value || !group.value) return [];

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
    subjects.innerHTML = '<div class="empty-state">Select your level and group to see subjects.</div>';
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

level.onchange = () => {
  groupOptions();
  state.level = level.value;
  state.group = "";
  save();
  render();
};

group.onchange = () => {
  state.level = level.value;
  state.group = group.value;
  save();
  render();
};

$("saveProfile").onclick = () => {
  state.level = level.value;
  state.group = group.value;
  save();
  $("profileStatus").textContent = "Selection saved on this device.";
};

function days(date) {
  if (!date) return null;
  return Math.max(0, Math.ceil(
    (new Date(date + "T23:59:59") - Date.now()) / 86400000
  ));
}

function tick() {
  const attemptDays = days(state.attemptDate);

  $("attemptCountdown").textContent =
    attemptDays === null ? "—" : attemptDays + " days";

  $("attemptDateLabel").textContent =
    state.attemptDate
      ? (state.attemptName || "Attempt") + " • " + state.attemptDate
      : "Set your attempt date";

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
  $("revisionEmpty").classList.add("hidden");
};

$("saveRevision").onclick = () => {
  state.revisionName = $("revisionNameInput").value.trim() || "Revision";
  state.revisionDate = $("revisionDate").value;
  save();
  $("revisionName").textContent = state.revisionName;
  $("revisionDateLabel").textContent = state.revisionDate;
  $("revisionEmpty").classList.add("hidden");
  $("revisionEditor").classList.add("hidden");
  $("revisionView").classList.remove("hidden");
  tick();
};

if (state.level) {
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
