/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V3
PURPOSE: Academic selection, automatic exam countdown, and independent revision countdown.
EDITABLE AREAS: Storage key and official exam schedule.
DEPENDENCIES: index.html, css/home.css, js/academic.js, browser localStorage.
IMPORTANT NOTES: Subjects come only from js/academic.js. Exam countdown uses the December 2026 ICMAI schedule and the first exam date applicable to the selected course/group.
LAST UPDATED: 2026-10-04
*/

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const STORE = "cma_zone_home_v1";
const state = JSON.parse(localStorage.getItem(STORE) || "{}");
const $ = id => document.getElementById(id);
const level = $("levelSelect");
const group = $("groupSelect");
const subjects = $("subjectList");
const startStudy = $("startStudy");
const electiveWrap = $("electiveWrap");
const electiveSelect = $("electiveSelect");
const greetingCard = $("greetingCard");
const greetingTitle = $("greetingTitle");
const greetingQuote = $("greetingQuote");
const logoutButton = $("logoutButton");
const loginButton = $("loginButton");
const headerLogout = $("headerLogout");

const MOTIVATIONAL_QUOTES = [
  "Small progress every day becomes a big result.",
  "Your consistency today builds your confidence tomorrow.",
  "One focused session at a time. You’ve got this.",
  "Don’t wait for motivation. Build momentum.",
  "Study with purpose. Revise with confidence. Perform with clarity."
];

function getGreetingName(user) {
  const name = (user?.displayName || "").trim();
  if (name) return name.split(/\s+/)[0];
  const emailName = (user?.email || "Student").split("@")[0].replace(/[._-]+/g, " ").trim();
  return emailName ? emailName.split(/\s+/)[0] : "Student";
}

function showStudentGreeting(user) {
  if (!greetingCard) return;
  if (!user) {
    greetingCard.classList.add("hidden");
    loginButton?.classList.remove("hidden");
    headerLogout?.classList.add("hidden");
    return;
  }
  loginButton?.classList.add("hidden");
  headerLogout?.classList.remove("hidden");
  const name = getGreetingName(user);
  greetingTitle.textContent = "Hi " + name + " 👋";
  greetingQuote.textContent = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  greetingCard.classList.remove("hidden");
}

onAuthStateChanged(auth, showStudentGreeting);
async function performLogout() {
  await signOut(auth);
  window.location.reload();
}

logoutButton?.addEventListener("click", performLogout);
headerLogout?.addEventListener("click", performLogout);

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

function countdownParts(date) {
  if (!date) return null;

  const target = new Date(date + "T00:00:00").getTime();
  const remaining = Math.max(0, target - Date.now());

  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000)
  };
}

function countdownHTML(parts) {
  if (!parts) return "—";

  return '<div class="countdown-units">' +
    '<div class="countdown-unit"><strong>' + String(parts.days).padStart(2, "0") + '</strong><span>Days</span></div>' +
    '<div class="countdown-unit"><strong>' + String(parts.hours).padStart(2, "0") + '</strong><span>Hours</span></div>' +
    '<div class="countdown-unit"><strong>' + String(parts.minutes).padStart(2, "0") + '</strong><span>Minutes</span></div>' +
    '<div class="countdown-unit"><strong>' + String(parts.seconds).padStart(2, "0") + '</strong><span>Seconds</span></div>' +
    '</div>';
}

function tick() {
  const attemptParts = countdownParts(state.attemptDate);

  $("attemptCountdown").innerHTML = countdownHTML(attemptParts);

  $("attemptDateLabel").textContent =
    state.attemptDate
      ? (state.attemptName || "December 2026 Attempt") +
        " • First exam: " + state.attemptDate
      : "Select your course and group";

  const revisionParts = countdownParts(state.revisionDate);

  $("revisionCountdown").innerHTML = countdownHTML(revisionParts);
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


const reportView = $("reportView");
const reportTabs = document.querySelectorAll("[data-report-view]");

function reportBar(label, value, height, tone) {
  return '<div class="sample-bar-item"><div class="sample-bar-track"><span class="' + tone + '" style="height:' + height + '%"></span></div><small>' + label + '</small><b>' + value + '</b></div>';
}

function renderReport(view) {
  if (!reportView) return;

  if (view === "period") {
    reportView.innerHTML =
      '<div class="report-summary-grid">' +
        '<div><span>Total time</span><strong>51:52:38</strong></div>' +
        '<div><span>Daily average</span><strong>2:43:49</strong></div>' +
      '</div>' +
      '<div class="sample-calendar"><div class="calendar-title">Last 28 days <small>9/7 ~ 10/4</small></div>' +
        '<div class="calendar-days">' +
          '<span>7</span><span class="study">8</span><span>9</span><span class="study">10</span><span>11</span><span class="study">12</span><span class="study">13</span>' +
          '<span>14</span><span>15</span><span>16</span><span>17</span><span class="study">18</span><span>19</span><span>20</span>' +
          '<span>21</span><span>22</span><span>23</span><span>24</span><span class="study">25</span><span class="study">26</span><span class="study">27</span>' +
          '<span class="study">28</span><span>29</span><span class="study">30</span><span>1</span><span>2</span><span class="today">3</span><span>4</span>' +
        '</div><div class="calendar-foot">Average 3h &nbsp; • &nbsp; Total 50h</div>' +
      '</div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Subject ratio</strong><span>Study time by subject</span></div></div>' +
        '<div class="donut-row"><div class="donut"></div><div class="donut-legend">' +
          '<div><i class="orange"></i>Direct and Tax <b>40%</b></div><div><i class="teal"></i>Corporate and Laws <b>33%</b></div><div><i class="purple"></i>Strategic <b>27%</b></div>' +
        '</div></div>' +
      '</div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Subject time per day</strong><span>Daily maximum: 6h 18m</span></div></div>' +
        '<div class="sample-bars">' +
          reportBar("SFM","2h 10m",58,"purple") + reportBar("SCM","1h 46m",47,"teal") + reportBar("CEL","1h 22m",36,"blue") + reportBar("DIT","1h 00m",26,"orange") +
        '</div>' +
      '</div>';
  } else if (view === "day") {
    reportView.innerHTML =
      '<div class="report-heading-line"><strong>Sat, Oct 3, 2026</strong><span>Oct</span></div>' +
      '<div class="day-calendar"><div class="day-week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
        '<div class="day-grid">' +
          '<span>28<small>3:11</small></span><span>29</span><span>30<small>1:57</small></span><span>1<small>1:46</small></span><span>2</span><span class="selected">3</span><span>4</span>' +
          '<span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span>' +
          '<span>12</span><span>13</span><span>14</span><span>15</span><span>16</span><span>17</span><span>18</span>' +
        '</div></div>' +
      '<div class="report-card day-detail"><div class="report-card-head"><div><strong>Study timeline</strong><span>Selected day</span></div><b>0:00:00</b></div><div class="empty-timeline">No sample study session recorded for the selected day.</div></div>';
  } else if (view === "week") {
    reportView.innerHTML =
      '<div class="report-summary-grid"><div><span>Total time</span><strong>6:55:21</strong></div><div><span>Daily average</span><strong>2:18:27</strong></div></div>' +
      '<div class="week-selector"><b>2026 Q3</b><span>9/28 ~ 10/4</span></div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Weekly study progress</strong><span>Mon to Sun</span></div><b>6:55:21</b></div><div class="sample-bars week-bars">' +
        reportBar("Mon","0:00",10,"blue") + reportBar("Tue","1:10",40,"orange") + reportBar("Wed","1:35",55,"teal") + reportBar("Thu","0:45",32,"purple") + reportBar("Fri","0:00",10,"blue") + reportBar("Sat","1:25",50,"orange") + reportBar("Sun","2:00",70,"teal") +
      '</div></div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Study start / end regularity</strong><span>Consistency pattern</span></div></div><div class="regularity-chart"><span style="height:54%"></span><span style="height:70%"></span><span style="height:62%"></span><span style="height:82%"></span><span style="height:58%"></span><span style="height:74%"></span></div><div class="chart-legend"><span>● Start time</span><span>● End time</span></div></div>';
  } else if (view === "month") {
    reportView.innerHTML =
      '<div class="month-picker"><button type="button">‹</button><strong>2026</strong><button type="button">›</button></div>' +
      '<div class="month-grid">' +
        '<div>Jan</div><div>Feb</div><div>Mar</div><div>Apr</div><div>May</div><div>Jun</div><div>Jul</div><div class="active">Aug<strong>13:47:35</strong></div><div class="active">Sep<strong>78:41:31</strong></div><div class="selected">Oct<strong>1:46:55</strong></div><div>Nov</div><div>Dec</div>' +
      '</div>' +
      '<div class="report-summary-grid"><div><span>Total time</span><strong>1:46:55</strong></div><div><span>Daily average</span><strong>1:46:55</strong></div></div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>October 2026</strong><span>Monthly progress</span></div></div><div class="month-trend"><span style="height:12%"></span><span style="height:20%"></span><span style="height:28%"></span><span style="height:45%"></span><span style="height:68%"></span><span style="height:30%"></span><span style="height:82%"></span></div></div>';
  } else {
    reportView.innerHTML =
      '<div class="trend-filters"><button class="active" type="button">All</button><button type="button">Strategic Cost Management</button><button type="button">Strategic Financial Management</button><button type="button">Corporate Laws</button></div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Daily / Weekly / Monthly trend</strong><span>Study time progression</span></div></div>' +
        '<div class="trend-section"><small>Daily max: 6h 18m</small><div class="trend-bars">' +
          '<span style="height:28%"></span><span style="height:44%"></span><span style="height:36%"></span><span style="height:62%"></span><span style="height:52%"></span><span style="height:76%"></span><span style="height:58%"></span><span style="height:66%"></span>' +
        '</div><div class="axis">9/26 &nbsp;&nbsp; 9/27 &nbsp;&nbsp; 9/28 &nbsp;&nbsp; 9/30 &nbsp;&nbsp; 10/1 &nbsp;&nbsp; 10/3</div></div>' +
        '<div class="trend-section"><small>Weekly max: 35h 15m</small><div class="stacked-bars"><span style="height:30%"></span><span style="height:76%"></span><span style="height:60%"></span><span style="height:45%"></span><span style="height:25%"></span></div></div>' +
        '<div class="trend-section"><small>Monthly max: 78h 41m</small><div class="stacked-bars monthly"><span style="height:25%"></span><span style="height:76%"></span><span style="height:8%"></span></div></div>' +
      '</div>' +
      '<div class="report-card"><div class="report-card-head"><div><strong>Study start/end regularity</strong><span>Actual report will use your session timestamps</span></div></div><div class="regularity-lines"><span style="height:68%"></span><span style="height:82%"></span><span style="height:60%"></span><span style="height:76%"></span><span style="height:54%"></span><span style="height:70%"></span></div></div>';
  }
}

reportTabs.forEach(button => {
  button.addEventListener("click", () => {
    reportTabs.forEach(item => item.classList.toggle("active", item === button));
    renderReport(button.dataset.reportView);
  });
});

renderReport("period");

updateStartStudyLink();
tick();
setInterval(tick, 1000);
