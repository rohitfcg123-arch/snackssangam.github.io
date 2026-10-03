/*
FILE: js/stats.js
REFERENCE: CMA-ZONE-STUDY-STATS-FIRESTORE-V2
PURPOSE: Render Study Statistics from the logged-in student's Cloud Firestore study records.
EDITABLE AREAS: Statistics calculations and report presentation.
DEPENDENCIES: js/firebase.js, js/academic.js, js/home.js.
IMPORTANT NOTES: No study statistics are read from localStorage. Data comes from users/{UID}/studyDays.
LAST UPDATED: 2026-10-04
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const reportView = document.getElementById("reportView");
const tabs = document.querySelectorAll("[data-report-view]");
let user = null;
let cachedDays = {};

const dateKey = d => d.toISOString().slice(0, 10);

function activeElapsed(active) {
  return active
    ? Math.max(0, (Date.now() - Number(active.startedAt || 0)) / 1000)
    : 0;
}

function dayTotal(day) {
  const saved = Object.values(day?.totals || {}).reduce((a, b) => a + Number(b || 0), 0);
  return saved + activeElapsed(day?.active);
}

function totalStudySeconds() {
  return Object.values(cachedDays).reduce((sum, day) => sum + dayTotal(day), 0);
}

const fmt = n => {
  n = Math.max(0, Math.floor(n));
  return [
    Math.floor(n / 3600),
    Math.floor((n % 3600) / 60),
    n % 60
  ].map(v => String(v).padStart(2, "0")).join(":");
};

const short = n => {
  n = Math.max(0, Math.floor(n));
  return Math.floor(n / 3600) + "h " + Math.floor((n % 3600) / 60) + "m";
};

async function loadStudyDays() {
  if (!user) {
    cachedDays = {};
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "users", user.uid, "studyDays"));
    cachedDays = {};

    snapshot.forEach(item => {
      if (item.id === "__config__") return;
      cachedDays[item.id] = item.data();
    });
  } catch (error) {
    console.error("Firestore statistics read failed:", error);
    cachedDays = {};
  }
}

function recentDays(count) {
  const out = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);

    const key = dateKey(d);
    out.push({
      date: d,
      key,
      seconds: dayTotal(cachedDays[key])
    });
  }

  return out;
}

function subjects() {
  const level = document.getElementById("levelSelect")?.value;
  const group = document.getElementById("groupSelect")?.value;
  const homeState = JSON.parse(localStorage.getItem("cma_zone_home_v1") || "{}");
  const map = {};

  if (!level || !group || !ACADEMIC[level]) return map;

  const data = ACADEMIC[level].groups;

  const list = group === "both"
    ? ["g1", "g2", "g3", "g4"].filter(k => data[k]).flatMap(k => data[k])
    : (data[group] || []);

  list.forEach(s => map[s[0]] = s[1]);

  if (level === "final" && group === "g4" && homeState.elective) {
    const elective = data.electives?.find(s => s[0] === homeState.elective);
    if (elective) map[elective[0]] = elective[1];
  }

  return map;
}

function bar(label, value, height, tone) {
  return '<div class="sample-bar-item"><div class="sample-bar-track"><span class="' +
    tone + '" style="height:' + Math.max(8, height) +
    '%"></span></div><small>' + label + '</small><b>' + value + '</b></div>';
}

function render(view = "period") {
  if (!reportView) return;

  const recent = recentDays(28);
  const all = totalStudySeconds();
  const active = recent.filter(d => d.seconds > 0).length;
  const avg = active ? all / active : 0;
  const names = subjects();
  const bySubject = {};

  Object.values(cachedDays).forEach(day => {
    Object.entries(day.totals || {}).forEach(([id, value]) => {
      bySubject[id] = (bySubject[id] || 0) + Number(value || 0);
    });

    if (day.active?.subjectId) {
      bySubject[day.active.subjectId] =
        (bySubject[day.active.subjectId] || 0) + activeElapsed(day.active);
    }
  });

  const entries = Object.entries(bySubject)
    .filter(([id]) => names[id])
    .sort((a, b) => b[1] - a[1]);

  if (view === "period") {
    const max = Math.max(1, ...entries.map(([, v]) => v));

    const rows = entries.length
      ? entries.slice(0, 6).map(([id, value], i) =>
          bar(
            names[id].split(" (")[0],
            short(value),
            value / max * 100,
            ["orange", "teal", "purple", "blue"][i % 4]
          )
        ).join("")
      : '<div class="empty-timeline">No study activity yet. Start a subject timer to build your statistics.</div>';

    reportView.innerHTML =
      '<div class="report-summary-grid">' +
        '<div><span>Total time</span><strong>' + fmt(all) + '</strong></div>' +
        '<div><span>Daily average</span><strong>' + short(avg) + '</strong></div>' +
      '</div>' +
      '<div class="sample-calendar">' +
        '<div class="calendar-title">Last 28 days</div>' +
        '<div class="calendar-days">' +
          recent.map(d => '<span class="' + (d.seconds ? "study" : "") + '">' + d.date.getDate() + '</span>').join("") +
        '</div>' +
        '<div class="calendar-foot">Active days ' + active + ' &nbsp; • &nbsp; Total ' + short(all) + '</div>' +
      '</div>' +
      '<div class="report-card">' +
        '<div class="report-card-head"><div><strong>Subject time</strong><span>Actual study time by subject</span></div></div>' +
        '<div class="sample-bars">' + rows + '</div>' +
      '</div>';
  } else if (view === "day") {
    const today = dateKey(new Date());
    const day = cachedDays[today] || {};
    const sessions = day.sessions || [];
    const seconds = dayTotal(day);
    const sessionCount = sessions.length + (day.active ? 1 : 0);

    reportView.innerHTML =
      '<div class="report-summary-grid">' +
        '<div><span>Today</span><strong>' + fmt(seconds) + '</strong></div>' +
        '<div><span>Sessions</span><strong>' + sessionCount + '</strong></div>' +
      '</div>' +
      '<div class="report-card day-detail">' +
        '<div class="report-card-head"><div><strong>Study timeline</strong><span>Today</span></div></div>' +
        (sessions.length
          ? sessions.map(x => '<div class="empty-timeline">' +
              (names[x.subjectId] || x.subjectId) + ' — ' + fmt(x.duration) +
            '</div>').join("")
          : '<div class="empty-timeline">No completed study session recorded today.</div>') +
      '</div>';
  } else if (view === "week") {
    const week = recentDays(7);
    const max = Math.max(1, ...week.map(d => d.seconds));

    reportView.innerHTML =
      '<div class="report-summary-grid">' +
        '<div><span>Last 7 days</span><strong>' +
          fmt(week.reduce((a, d) => a + d.seconds, 0)) +
        '</strong></div>' +
        '<div><span>Active days</span><strong>' +
          week.filter(d => d.seconds).length +
        '</strong></div>' +
      '</div>' +
      '<div class="report-card">' +
        '<div class="report-card-head"><div><strong>Weekly study progress</strong><span>Actual study time</span></div></div>' +
        '<div class="sample-bars week-bars">' +
          week.map(d => bar(
            d.date.toLocaleDateString("en", { weekday: "short" }),
            short(d.seconds),
            d.seconds / max * 100,
            "teal"
          )).join("") +
        '</div>' +
      '</div>';
  } else if (view === "month") {
    const now = new Date();
    const prefix = dateKey(now).slice(0, 7);
    const month = Object.entries(cachedDays).filter(([key]) => key.startsWith(prefix));
    const monthTotal = month.reduce((sum, [, day]) => sum + dayTotal(day), 0);
    const activeDays = month.filter(([, day]) => dayTotal(day) > 0).length;

    reportView.innerHTML =
      '<div class="report-summary-grid">' +
        '<div><span>This month</span><strong>' + fmt(monthTotal) + '</strong></div>' +
        '<div><span>Active days</span><strong>' + activeDays + '</strong></div>' +
      '</div>' +
      '<div class="report-card">' +
        '<div class="report-card-head"><div><strong>Monthly progress</strong><span>' +
          now.toLocaleDateString("en", { month: "long", year: "numeric" }) +
        '</span></div></div>' +
        '<div class="empty-timeline">' +
          (monthTotal
            ? "Study activity is being tracked from your Firebase account."
            : "No study activity this month yet.") +
        '</div>' +
      '</div>';
  } else {
    const trend = recentDays(14);
    const max = Math.max(1, ...trend.map(d => d.seconds));

    reportView.innerHTML =
      '<div class="report-card">' +
        '<div class="report-card-head"><div><strong>14-day study trend</strong><span>Actual study sessions</span></div></div>' +
        '<div class="sample-bars">' +
          trend.map(d => bar(
            d.date.getDate(),
            short(d.seconds),
            d.seconds / max * 100,
            "purple"
          )).join("") +
        '</div>' +
      '</div>' +
      '<div class="report-card">' +
        '<div class="report-card-head"><div><strong>Consistency</strong><span>Days with recorded study time</span></div></div>' +
        '<div class="empty-timeline">' +
          trend.filter(d => d.seconds).length +
          ' of 14 days have recorded study activity.</div>' +
      '</div>';
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", async () => {
    tabs.forEach(item => item.classList.toggle("active", item === tab));
    await loadStudyDays();
    render(tab.dataset.reportView);
  });
});

onAuthStateChanged(auth, async current => {
  user = current;
  await loadStudyDays();
  render(document.querySelector("[data-report-view].active")?.dataset.reportView || "period");
});

setInterval(async () => {
  if (!user) return;
  await loadStudyDays();
  render(document.querySelector("[data-report-view].active")?.dataset.reportView || "period");
}, 5000);

render("period");
