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
const startStudy = $("startStudy");
const electiveWrap = $("electiveWrap");
const electiveSelect = $("electiveSelect");

function enforceStartStudyPlacement() {
  if (!startStudy || !subjects) return;
  const heroActions = document.querySelector(".hero-actions");
  if (heroActions && heroActions.contains(startStudy)) {
    heroActions.removeChild(startStudy);
  }
  if (startStudy.parentElement !== subjects.parentElement) {
    subjects.parentElement.appendChild(startStudy);
  }
}

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

function renderElectiveOptions() {
  if (!electiveWrap || !electiveSelect) return;

  const show = level.value === "final" && group.value === "g4";
  electiveWrap.classList.toggle("hidden", !show);

  if (!show) {
    electiveSelect.value = "";
    return;
  }

  electiveSelect.innerHTML = '<option value="">Select elective</option>';
  ACADEMIC.final.groups.electives.forEach((subject, index) => {
    const option = document.createElement("option");
    option.value = subject[0];
    option.textContent = subject[0] + " — " + subject[1];
    electiveSelect.appendChild(option);
  });

  electiveSelect.value = state.elective || "";
}

function groupOptions() {
  group.innerHTML = '<option value="">Select group</option>';

  if (!level.value || !ACADEMIC[level.value]) {
    group.disabled = true;
    return;
  }

  const data = ACADEMIC[level.value].groups;

  Object.keys(data).filter(key => key !== "electives").forEach(key => {
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
  renderElectiveOptions();
}

function list() {
  if (!level.value || !group.value || !ACADEMIC[level.value]) return [];

  const data = ACADEMIC[level.value].groups;

  if (group.value === "both") {
    return ["g1", "g2", "g3", "g4"]
      .filter(key => data[key])
      .flatMap(key => data[key]);
  }

  const selected = data[group.value] || [];
  if (level.value === "final" && group.value === "g4" && state.elective) {
    const elective = data.electives.find(subject => subject[0] === state.elective);
    return elective ? [...selected, elective] : selected;
  }
  return selected;
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
  state.elective = "";
  state.attemptDate = "";
  state.attemptName = "";
  save();
  render();
  updateStartStudyLink();
  tick();
};

group.onchange = () => {
  state.level = level.value;
  state.group = group.value;
  state.elective = "";
  renderElectiveOptions();
  syncExamDateToSelection();
  save();
  render();
  updateStartStudyLink();
  tick();
};

function updateStartStudyLink() {
  if (!startStudy) return;
  if (level.value && group.value) {
    const needsElective = level.value === "final" && group.value === "g4";
    if (needsElective && !state.elective) {
      startStudy.href = "pages/study.html";
      startStudy.classList.add("disabled-link");
      return;
    }
    startStudy.href = "pages/study.html?level=" + encodeURIComponent(level.value) + "&group=" + encodeURIComponent(group.value) + "&elective=" + encodeURIComponent(state.elective || "");
    startStudy.classList.remove("disabled-link");
  } else {
    startStudy.href = "pages/study.html";
    startStudy.classList.add("disabled-link");
  }
}

if (electiveSelect) {
  electiveSelect.onchange = () => {
    state.elective = electiveSelect.value;
    save();
    render();
    updateStartStudyLink();
  };
}

$("saveProfile").onclick = () => {
  state.level = level.value;
  state.group = group.value;
  state.elective = electiveSelect?.value || "";
  syncExamDateToSelection();
  save();
  $("profileStatus").textContent = "Selection saved on this device.";
  updateStartStudyLink();
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
  renderElectiveOptions();
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

updateStartStudyLink();
tick();
setInterval(tick, 60000);
