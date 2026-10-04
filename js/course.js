/*
FILE: js/course.js
REFERENCE: CMA-ZONE-COURSE-V4
PURPOSE: Course/group/attempt selection, explicit save, and custom-subject management.
EDITABLE AREAS: Storage keys, labels and exam-attempt year range.
DEPENDENCIES: academic.js, firebase.js, Firestore users/{uid}/studyDays/config.
IMPORTANT: Firestore document ID "config" is used because "__config__" is reserved.
*/

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const STORE = "cma_zone_home_v1";
const CUSTOM_PREFIX = "cma_zone_custom_subjects_v1:";
const CONFIG_DOC = "config";

const $ = id => document.getElementById(id);

let state = {};
let user = null;
let custom = [];


/* -----------------------------
   LOCAL STATE
----------------------------- */

function loadState() {
  try {
    state = JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    state = {};
  }
}

function saveState() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function customStorageKey() {
  return user ? CUSTOM_PREFIX + user.uid : "";
}


/* -----------------------------
   FIRESTORE CONFIG
----------------------------- */

function configRef() {
  if (!user) return null;

  return doc(
    db,
    "users",
    user.uid,
    "studyDays",
    CONFIG_DOC
  );
}


/* -----------------------------
   BUILT-IN SUBJECTS
----------------------------- */

function builtIn() {
  if (
    !state.level ||
    !state.group ||
    !ACADEMIC[state.level]
  ) {
    return [];
  }

  const groups = ACADEMIC[state.level].groups;

  if (state.group === "both") {
    return ["g1", "g2", "g3", "g4"]
      .filter(key => groups[key])
      .flatMap(key => groups[key]);
  }

  let subjects = groups[state.group] || [];

  if (
    state.level === "final" &&
    state.group === "g4" &&
    state.elective
  ) {
    const elective = groups.electives?.find(
      item => item[0] === state.elective
    );

    if (elective) {
      subjects = [...subjects, elective];
    }
  }

  return subjects;
}

function names() {
  return [...builtIn(), ...custom];
}


/* -----------------------------
   LOAD CUSTOM SUBJECTS
----------------------------- */

async function loadCloudCourse() {
  if (!user) return;
  try {
    const snap = await getDoc(configRef());
    if (!snap.exists()) return;
    const remote = snap.data();
    if (remote.courseLevel) state.level = remote.courseLevel;
    if (remote.group) state.group = remote.group;
    if (remote.elective !== undefined) state.elective = remote.elective || "";
    if (remote.attemptMonth) state.attemptMonth = remote.attemptMonth;
    if (remote.attemptYear) state.attemptYear = Number(remote.attemptYear);
    if (remote.attemptName) state.attemptName = remote.attemptName;
    if (remote.attemptDate) state.attemptDate = remote.attemptDate;
    if (Array.isArray(remote.customSubjects)) {
      custom = remote.customSubjects
        .filter(item => Array.isArray(item) && item.length >= 2)
        .map(item => [String(item[0]), String(item[1]), "custom"]);
      localStorage.setItem(customStorageKey(), JSON.stringify(custom));
    }
    saveState();
  } catch (error) {
    console.error("Cloud course load failed:", error);
  }
}

async function loadCustom() {
  if (!user) return;

  try {
    const ref = configRef();
    const snap = await getDoc(ref);

    const remote =
      snap.exists() &&
      Array.isArray(snap.data().customSubjects)
        ? snap.data().customSubjects
        : [];

    let local = [];

    try {
      local = JSON.parse(
        localStorage.getItem(customStorageKey()) || "[]"
      );
    } catch {
      local = [];
    }

    custom = [
      ...remote,
      ...local
    ]
      .filter(
        (item, index, array) =>
          Array.isArray(item) &&
          item.length >= 2 &&
          array.findIndex(
            x => x[0] === item[0]
          ) === index
      )
      .map(item => [
        String(item[0]),
        String(item[1]),
        "custom"
      ]);

    localStorage.setItem(
      customStorageKey(),
      JSON.stringify(custom)
    );

  } catch (error) {
    console.error(
      "Custom subject cloud load failed:",
      error
    );
  }
}


/* -----------------------------
   COURSE LEVEL
----------------------------- */

function renderLevels() {
  const box = $("levelGrid");

  if (!box) return;

  box.innerHTML = Object.entries(ACADEMIC)
    .map(([id, data]) => `
      <button
        class="course-choice level-choice ${
          state.level === id ? "selected" : ""
        }"
        data-level="${id}"
        type="button"
      >
        <span>
          ${
            {
              foundation: "🎓",
              inter: "📖",
              final: "🏆"
            }[id] || "📚"
          }
        </span>

        <strong>${data.label}</strong>

        <small>Select level</small>
      </button>
    `)
    .join("");

  box
    .querySelectorAll("[data-level]")
    .forEach(button => {
      button.onclick = () => {
        state.level = button.dataset.level;
        state.group = "";
        state.elective = "";

        saveState();
        render();
      };
    });
}


/* -----------------------------
   EXAM ATTEMPT
----------------------------- */

function renderAttempt() {
  const month = $("attemptMonth");
  const year = $("attemptYear");

  if (!month || !year) return;

  const currentYear =
    new Date().getFullYear();

  year.innerHTML = Array.from(
    { length: 6 },
    (_, index) => currentYear + index
  )
    .map(
      yearValue =>
        `<option value="${yearValue}">
          ${yearValue}
        </option>`
    )
    .join("");

  month.value =
    state.attemptMonth || "december";

  year.value = String(
    state.attemptYear || currentYear
  );

  syncExamDate();

  const date = state.attemptDate
    ? new Date(
        state.attemptDate + "T00:00:00"
      )
    : null;

  const label = date
    ? date.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "long",
          year: "numeric"
        }
      )
    : "";

  const info = $("attemptInfo");

  if (info) {
    info.textContent = label
      ? `Exam starts on ${label} • Countdown is automatic on Home.`
      : "Select an attempt to start the countdown.";
  }
}


/* -----------------------------
   FINAL GROUP 4 ELECTIVE
----------------------------- */

function renderElective() {
  const card = $("electiveCard");
  const select = $("electiveCourse");

  if (!card || !select) return;

  const show =
    state.level === "final" &&
    state.group === "g4";

  card.classList.toggle(
    "hidden",
    !show
  );

  if (!show) return;

  select.innerHTML =
    `<option value="">Select elective</option>` +
    (
      ACADEMIC.final.groups.electives || []
    )
      .map(
        item =>
          `<option value="${item[0]}">
            ${item[0]} — ${item[1]}
          </option>`
      )
      .join("");

  select.value =
    state.elective || "";
}


/* -----------------------------
   GROUPS
----------------------------- */

function renderGroups() {
  const card = $("groupCard");

  if (!card) return;

  if (!state.level) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  const data =
    ACADEMIC[state.level].groups;

  let keys = Object.keys(data)
    .filter(key => key !== "electives");

  if (state.level !== "foundation") {
    keys.push("both");
  }

  const labels = {
    g1: "Group 1",
    g2: "Group 2",
    g3: "Group 3",
    g4: "Group 4",
    foundation: "Foundation",
    both: "Both Groups"
  };

  $("groupGrid").innerHTML =
    keys
      .map(
        key => `
          <button
            class="course-choice group-choice ${
              state.group === key
                ? "selected"
                : ""
            }"
            data-group="${key}"
            type="button"
          >
            <span>▣</span>

            <strong>
              ${labels[key] || key}
            </strong>

            <small>
              ${
                (data[key] || []).length ||
                "All"
              } subjects
            </small>
          </button>
        `
      )
      .join("");

  $("groupGrid")
    .querySelectorAll("[data-group]")
    .forEach(button => {
      button.onclick = () => {
        state.group =
          button.dataset.group;

        state.elective = "";

        saveState();
        render();
      };
    });
}


/* -----------------------------
   SUBJECTS
----------------------------- */

function renderSubjects() {
  const card = $("subjectCard");

  if (!card) return;

  if (
    !state.level ||
    !state.group
  ) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  const rows = names();

  $("courseSubjects").innerHTML =
    rows
      .map(
        item => `
          <div class="course-subject-row">

            <span class="course-subject-icon">
              ${
                item[2] === "custom"
                  ? "＋"
                  : "▥"
              }
            </span>

            <div>
              <strong>${item[1]}</strong>

              <small>
                ${
                  item[2] === "custom"
                    ? "Custom subject"
                    : "CMA syllabus"
                }
              </small>
            </div>

            ${
              item[2] === "custom"
                ? `
                  <button
                    type="button"
                    data-remove="${item[0]}"
                  >
                    −
                  </button>
                `
                : ""
            }

          </div>
        `
      )
      .join("") ||
    `<p class="empty-state">
      No subjects found.
    </p>`;

  $("courseSubjects")
    .querySelectorAll("[data-remove]")
    .forEach(button => {
      button.onclick = () =>
        removeCustom(
          button.dataset.remove
        );
    });

  const note = $("courseSaveNote");

  if (note) {
    note.textContent =
      `${rows.length} subjects available on Home → Start Study.`;
  }
}


/* -----------------------------
   CUSTOM SUBJECT ADD
----------------------------- */

async function addCustom() {
  const input =
    prompt("Enter custom subject name");

  if (!input?.trim()) return;

  const name = input.trim();

  if (
    custom.some(
      item =>
        item[1].toLowerCase() ===
        name.toLowerCase()
    )
  ) {
    alert(
      "This subject is already added."
    );
    return;
  }

  const newSubject = [
    "custom_" + Date.now(),
    name,
    "custom"
  ];

  custom.push(newSubject);

  localStorage.setItem(
    customStorageKey(),
    JSON.stringify(custom)
  );

  if (user) {
    try {
      await setDoc(
        configRef(),
        {
          customSubjects: custom,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        "Custom subject cloud save failed:",
        error
      );

      alert(
        "Custom subject cloud save failed: " +
        (
          error?.code ||
          "unknown"
        )
      );
    }
  }

  renderSubjects();
}


/* -----------------------------
   CUSTOM SUBJECT REMOVE
----------------------------- */

async function removeCustom(id) {
  custom = custom.filter(
    item => item[0] !== id
  );

  localStorage.setItem(
    customStorageKey(),
    JSON.stringify(custom)
  );

  if (user) {
    try {
      await setDoc(
        configRef(),
        {
          customSubjects: custom,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        "Custom subject cloud delete failed:",
        error
      );

      alert(
        "Custom subject cloud save failed: " +
        (
          error?.code ||
          "unknown"
        )
      );
    }
  }

  renderSubjects();
}


/* -----------------------------
   AUTOMATIC EXAM DATE
----------------------------- */

function syncExamDate() {
  const month =
    state.attemptMonth ||
    "december";

  const year =
    Number(state.attemptYear) ||
    new Date().getFullYear();

  state.attemptMonth = month;
  state.attemptYear = year;

  state.attemptDate =
    year +
    "-" +
    (
      month === "june"
        ? "06"
        : "12"
    ) +
    "-10";

  state.attemptName =
    (
      month === "june"
        ? "June"
        : "December"
    ) +
    " " +
    year +
    " Attempt";

  saveState();
}


/* -----------------------------
   SAVE COMPLETE COURSE SETUP
----------------------------- */

async function saveCourseSetup() {
  if (
    !state.level ||
    !state.group ||
    !state.attemptMonth ||
    !state.attemptYear
  ) {
    alert(
      "Please select Course, Group and Exam Attempt first."
    );
    return;
  }

  syncExamDate();

  const payload = {
    courseLevel: state.level,
    group: state.group,
    elective: state.elective || "",

    attemptMonth:
      state.attemptMonth,

    attemptYear:
      Number(state.attemptYear),

    attemptName:
      state.attemptName,

    attemptDate:
      state.attemptDate,

    customSubjects:
      custom,

    updatedAt:
      Date.now()
  };

  saveState();

  if (user) {
    try {
      await setDoc(
        configRef(),
        payload,
        { merge: true }
      );

      console.log(
        "Course setup saved to Firestore."
      );

    } catch (error) {
      console.error(
        "Cloud course save failed:",
        error
      );

      alert(
        "Cloud save failed: " +
        (
          error?.code ||
          "unknown"
        ) +
        " — " +
        (
          error?.message ||
          "Check Firestore Rules/network."
        )
      );

      return;
    }
  }

  const status =
    $("saveCourseStatus");

  if (status) {
    const levelName =
      state.level === "foundation"
        ? "Foundation"
        : (
            ACADEMIC[state.level]?.label ||
            state.level
          );

    const groupNames = {
      g1: "Group 1",
      g2: "Group 2",
      g3: "Group 3",
      g4: "Group 4",
      both: "Both Groups",
      foundation: "Foundation"
    };

    status.textContent =
      "✓ Saved: " +
      levelName +
      " • " +
      (
        groupNames[state.group] ||
        state.group
      ) +
      " • " +
      state.attemptName;
  }

  window.setTimeout(
    () => {
      window.location.href =
        "../index.html";
    },
    350
  );
}


/* -----------------------------
   RENDER
----------------------------- */

function render() {
  renderLevels();
  renderAttempt();
  renderGroups();
  renderElective();
  renderSubjects();
}


/* -----------------------------
   EVENT LISTENERS
----------------------------- */

$("attemptMonth")?.addEventListener(
  "change",
  () => {
    state.attemptMonth =
      $("attemptMonth").value;

    syncExamDate();
    renderAttempt();
  }
);

$("attemptYear")?.addEventListener(
  "change",
  () => {
    state.attemptYear =
      Number(
        $("attemptYear").value
      );

    syncExamDate();
    renderAttempt();
  }
);

$("electiveCourse")?.addEventListener(
  "change",
  () => {
    state.elective =
      $("electiveCourse").value;

    saveState();
    render();
  }
);

$("addCustomCourse")?.addEventListener(
  "click",
  addCustom
);

$("saveCourse")?.addEventListener(
  "click",
  saveCourseSetup
);

$("saveCourseQuick")?.addEventListener(
  "click",
  saveCourseSetup
);


/* -----------------------------
   INITIALISE
----------------------------- */

loadState();

onAuthStateChanged(
  auth,
  async currentUser => {
    user = currentUser;

    if (user) {
      await loadCustom();
    }

    render();
  }
);
