/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V4
PURPOSE: Home dashboard, cloud course restoration, exam/revision countdowns, and study tracking.
EDITABLE AREAS: Storage keys and countdown behaviour.
DEPENDENCIES: index.html, css/home.css, js/academic.js, js/firebase.js, Firestore.
IMPORTANT: Firestore config document ID is "config"; "__config__" is reserved.
*/

import {
  auth,
  db
} from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* -----------------------------
   STORAGE
----------------------------- */

const STORE =
  "cma_zone_home_v1";

const COUNTDOWN_STORE =
  "cma_zone_countdowns_v2";

const CONFIG_DOC =
  "config";


let state = {};

try {
  state =
    JSON.parse(
      localStorage.getItem(STORE) ||
      "{}"
    );
} catch {
  state = {};
}


let savedCountdowns = {};

try {
  savedCountdowns =
    JSON.parse(
      localStorage.getItem(
        COUNTDOWN_STORE
      ) || "{}"
    );
} catch {
  savedCountdowns = {};
}


/* -----------------------------
   RESTORE OLD LOCAL COUNTDOWN
----------------------------- */

if (
  savedCountdowns.attemptName &&
  !state.attemptName
) {
  state.attemptName =
    savedCountdowns.attemptName;
}

if (
  savedCountdowns.attemptDate &&
  !state.attemptDate
) {
  state.attemptDate =
    savedCountdowns.attemptDate;
}

if (
  savedCountdowns.revisionName &&
  !state.revisionName
) {
  state.revisionName =
    savedCountdowns.revisionName;
}

if (
  savedCountdowns.revisionDate &&
  !state.revisionDate
) {
  state.revisionDate =
    savedCountdowns.revisionDate;
}


const $ =
  id =>
    document.getElementById(id);


const startStudy =
  $("startStudy");

const subjects =
  null;

const greetingCard =
  $("greetingCard");

const greetingTitle =
  $("greetingTitle");

const greetingQuote =
  $("greetingQuote");

const logoutButton =
  $("logoutButton");

const loginButton =
  $("loginButton");

const headerLogout =
  $("headerLogout");


/* -----------------------------
   MOTIVATIONAL QUOTES
----------------------------- */

const MOTIVATIONAL_QUOTES = [
  "Small progress every day becomes a big result.",
  "Your consistency today builds your confidence tomorrow.",
  "One focused session at a time. You’ve got this.",
  "Don’t wait for motivation. Build momentum.",
  "Study with purpose. Revise with confidence. Perform with clarity."
];


/* -----------------------------
   USER NAME
----------------------------- */

function getGreetingName(user) {
  const name =
    (user?.displayName || "")
      .trim();

  if (name) {
    return name.split(/\s+/)[0];
  }

  const emailName =
    (
      user?.email ||
      "Student"
    )
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim();

  return emailName
    ? emailName.split(/\s+/)[0]
    : "Student";
}


/* -----------------------------
   GREETING
----------------------------- */

function showStudentGreeting(user) {
  if (!greetingCard) return;

  if (!user) {
    greetingCard.classList.add(
      "hidden"
    );

    loginButton?.classList.remove(
      "hidden"
    );

    headerLogout?.classList.add(
      "hidden"
    );

    return;
  }

  loginButton?.classList.add(
    "hidden"
  );

  headerLogout?.classList.remove(
    "hidden"
  );

  const name =
    getGreetingName(user);

  if (greetingTitle) {
    greetingTitle.textContent =
      "Hi " +
      name +
      " 👋";
  }

  if (greetingQuote) {
    greetingQuote.textContent =
      MOTIVATIONAL_QUOTES[
        Math.floor(
          Math.random() *
          MOTIVATIONAL_QUOTES.length
        )
      ];
  }

  greetingCard.classList.remove(
    "hidden"
  );
}


/* -----------------------------
   LOGOUT
----------------------------- */

onAuthStateChanged(
  auth,
  showStudentGreeting
);

let logoutInProgress =
  false;


async function performLogout(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (logoutInProgress) return;

  logoutInProgress = true;

  const buttons = [
    logoutButton,
    headerLogout,
    $("menuLogout")
  ].filter(Boolean);

  buttons.forEach(
    button => {
      button.disabled = true;
      button.setAttribute(
        "aria-busy",
        "true"
      );
    }
  );

  try {
    await signOut(auth);

    window.location.replace(
      "./pages/signin.html?loggedout=1"
    );

  } catch (error) {
    console.error(
      "Home logout failed:",
      error
    );

    logoutInProgress = false;

    buttons.forEach(
      button => {
        button.disabled = false;
        button.removeAttribute(
          "aria-busy"
        );
      }
    );

    alert(
      "Logout failed: " +
      (
        error?.code ||
        error?.message ||
        "Unknown error"
      )
    );
  }
}


logoutButton?.addEventListener(
  "click",
  performLogout
);

headerLogout?.addEventListener(
  "click",
  performLogout
);


/* -----------------------------
   EXAM COUNTDOWN
----------------------------- */

function countdownParts(date) {
  if (!date) return null;

  const target =
    new Date(
      date + "T00:00:00"
    ).getTime();

  const remaining =
    Math.max(
      0,
      target - Date.now()
    );

  return {
    days:
      Math.floor(
        remaining /
        86400000
      ),

    hours:
      Math.floor(
        (remaining %
          86400000) /
        3600000
      ),

    minutes:
      Math.floor(
        (remaining %
          3600000) /
        60000
      ),

    seconds:
      Math.floor(
        (remaining %
          60000) /
        1000
      )
  };
}


function countdownHTML(parts) {
  if (!parts) {
    return "—";
  }

  return `
    <div class="countdown-units">

      <div class="countdown-unit">
        <strong>
          ${String(parts.days).padStart(2, "0")}
        </strong>
        <span>Days</span>
      </div>

      <div class="countdown-unit">
        <strong>
          ${String(parts.hours).padStart(2, "0")}
        </strong>
        <span>Hours</span>
      </div>

      <div class="countdown-unit">
        <strong>
          ${String(parts.minutes).padStart(2, "0")}
        </strong>
        <span>Minutes</span>
      </div>

      <div class="countdown-unit">
        <strong>
          ${String(parts.seconds).padStart(2, "0")}
        </strong>
        <span>Seconds</span>
      </div>

    </div>
  `;
}


/* -----------------------------
   CLOUD COURSE CONFIG
----------------------------- */

function configRef(user = auth.currentUser) {
  if (!user) return null;

  return doc(
    db,
    "users",
    user.uid,
    "studyDays",
    CONFIG_DOC
  );
}


async function saveCloudState() {
  const user =
    auth.currentUser;

  if (!user) return;

  try {
    await setDoc(
      configRef(user),
      {
        courseLevel:
          state.level || "",

        group:
          state.group || "",

        elective:
          state.elective || "",

        attemptMonth:
          state.attemptMonth || "",

        attemptYear:
          Number(
            state.attemptYear
          ) || 0,

        attemptName:
          state.attemptName || "",

        attemptDate:
          state.attemptDate || "",

        revisionName:
          state.revisionName || "",

        revisionDate:
          state.revisionDate || "",

        updatedAt:
          Date.now()
      },
      {
        merge: true
      }
    );

  } catch (error) {
    console.error(
      "Cloud setup save failed:",
      error
    );
  }
}


async function loadCloudState(user) {
  if (!user) return;

  try {
    const snap =
      await getDoc(
        configRef(user)
      );

    if (!snap.exists()) {
      return;
    }

    const data =
      snap.data() || {};


    if (
      data.courseLevel
    ) {
      state.level =
        data.courseLevel;
    }

    if (data.group) {
      state.group =
        data.group;
    }

    if (
      data.elective !==
      undefined
    ) {
      state.elective =
        data.elective;
    }

    if (
      data.attemptMonth
    ) {
      state.attemptMonth =
        data.attemptMonth;
    }

    if (
      data.attemptYear
    ) {
      state.attemptYear =
        Number(
          data.attemptYear
        );
    }

    if (data.attemptName) {
      state.attemptName =
        data.attemptName;
    }

    if (data.attemptDate) {
      state.attemptDate =
        data.attemptDate;
    }

    if (
      data.revisionName
    ) {
      state.revisionName =
        data.revisionName;
    }

    if (
      data.revisionDate
    ) {
      state.revisionDate =
        data.revisionDate;
    }


    localStorage.setItem(
      STORE,
      JSON.stringify(state)
    );


    localStorage.setItem(
      COUNTDOWN_STORE,
      JSON.stringify({
        attemptName:
          state.attemptName || "",

        attemptDate:
          state.attemptDate || "",

        revisionName:
          state.revisionName || "",

        revisionDate:
          state.revisionDate || ""
      })
    );

  } catch (error) {
    console.error(
      "Cloud setup load failed:",
      error
    );
  }
}


/* -----------------------------
   LOCAL + CLOUD SAVE
----------------------------- */

function save() {
  localStorage.setItem(
    STORE,
    JSON.stringify(state)
  );

  localStorage.setItem(
    COUNTDOWN_STORE,
    JSON.stringify({
      attemptName:
        state.attemptName || "",

      attemptDate:
        state.attemptDate || "",

      revisionName:
        state.revisionName || "",

      revisionDate:
        state.revisionDate || ""
    })
  );

  void saveCloudState();
}


/* -----------------------------
   COUNTDOWN RENDER
----------------------------- */

function tick() {
  const attemptParts =
    countdownParts(
      state.attemptDate
    );

  if (
    $("attemptCountdown")
  ) {
    $("attemptCountdown").innerHTML =
      countdownHTML(
        attemptParts
      );
  }

  if (
    $("attemptDateLabel")
  ) {
    $("attemptDateLabel")
      .textContent =
      state.attemptDate
        ? (
            state.attemptName ||
            "Exam Attempt"
          ) +
          " • First exam: " +
          state.attemptDate
        : "Select your course and group";
  }


  const revisionParts =
    countdownParts(
      state.revisionDate
    );

  if (
    $("revisionCountdown")
  ) {
    $("revisionCountdown").innerHTML =
      countdownHTML(
        revisionParts
      );
  }
}


/* -----------------------------
   ATTEMPT EDITOR
----------------------------- */

$("editAttempt")?.addEventListener(
  "click",
  () => {
    $("attemptEditor")
      ?.classList.toggle(
        "hidden"
      );
  }
);


$("saveAttempt")?.addEventListener(
  "click",
  () => {
    const name =
      $("attemptName")
        ?.value
        .trim();

    const date =
      $("attemptDate")
        ?.value;

    if (!date) {
      $("attemptDate")?.focus();
      return;
    }

    state.attemptName =
      name || "Attempt";

    state.attemptDate =
      date;

    save();

    $("attemptEditor")
      ?.classList.add(
        "hidden"
      );

    tick();
  }
);


/* -----------------------------
   REVISION EDITOR
----------------------------- */

$("editRevision")?.addEventListener(
  "click",
  () => {
    $("revisionEditor")
      ?.classList.toggle(
        "hidden"
      );

    $("revisionEmpty")
      ?.classList.toggle(
        "hidden",
        false
      );
  }
);


$("saveRevision")?.addEventListener(
  "click",
  () => {
    const name =
      $("revisionNameInput")
        ?.value
        .trim();

    const date =
      $("revisionDate")
        ?.value;

    if (!date) {
      $("revisionDate")?.focus();
      return;
    }

    state.revisionName =
      name || "Revision";

    state.revisionDate =
      date;

    save();


    if ($("revisionName")) {
      $("revisionName")
        .textContent =
        state.revisionName;
    }

    if ($("revisionDateLabel")) {
      $("revisionDateLabel")
        .textContent =
        state.revisionDate;
    }

    $("revisionEmpty")
      ?.classList.add(
        "hidden"
      );

    $("revisionEditor")
      ?.classList.add(
        "hidden"
      );

    $("revisionView")
      ?.classList.remove(
        "hidden"
      );

    tick();
  }
);


/* -----------------------------
   INITIAL FORM VALUES
----------------------------- */

if (
  state.attemptName &&
  $("attemptName")
) {
  $("attemptName").value =
    state.attemptName;
}

if (
  state.attemptDate &&
  $("attemptDate")
) {
  $("attemptDate").value =
    state.attemptDate;
}


if (state.revisionName) {
  if ($("revisionName")) {
    $("revisionName").textContent =
      state.revisionName;
  }

  if ($("revisionDateLabel")) {
    $("revisionDateLabel").textContent =
      state.revisionDate || "";
  }

  $("revisionEmpty")
    ?.classList.add(
      "hidden"
    );

  $("revisionView")
    ?.classList.remove(
      "hidden"
    );
}


/* -----------------------------
   STUDY TRACKER
----------------------------- */

const STUDY_CONFIG_DOC =
  "config";

let homeStudyUser =
  null;

let homeStudyState = {
  totals: {},
  sessions: [],
  active: null
};

let homeCustomSubjects =
  [];


function homeToday() {
  const date =
    new Date();

  return (
    date.getFullYear() +
    "-" +
    String(
      date.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      date.getDate()
    ).padStart(2, "0")
  );
}


function homeStudyRef() {
  if (!homeStudyUser) {
    return null;
  }

  return doc(
    db,
    "users",
    homeStudyUser.uid,
    "studyDays",
    homeToday()
  );
}


function homeConfigRef() {
  if (!homeStudyUser) {
    return null;
  }

  return doc(
    db,
    "users",
    homeStudyUser.uid,
    "studyDays",
    STUDY_CONFIG_DOC
  );
}


function homeCacheKey() {
  return homeStudyUser
    ? "cma_zone_custom_subjects_v1:" +
      homeStudyUser.uid
    : "";
}


/* -----------------------------
   STUDY SUBJECTS
----------------------------- */

function homeBuiltInSubjects() {
  if (
    !state.level ||
    !state.group ||
    !ACADEMIC[state.level]
  ) {
    return [];
  }

  const groups =
    ACADEMIC[state.level]
      .groups;

  if (
    state.group === "both"
  ) {
    return [
      "g1",
      "g2",
      "g3",
      "g4"
    ]
      .filter(
        key => groups[key]
      )
      .flatMap(
        key => groups[key]
      );
  }

  const subjects =
    groups[state.group] || [];

  if (
    state.level === "final" &&
    state.group === "g4" &&
    state.elective
  ) {
    const elective =
      groups.electives?.find(
        item =>
          item[0] ===
          state.elective
      );

    return elective
      ? [...subjects, elective]
      : subjects;
  }

  return subjects;
}


function homeSubjects() {
  return [
    ...homeBuiltInSubjects(),
    ...homeCustomSubjects
  ];
}


function homeSubjectName(id) {
  const found =
    homeSubjects().find(
      item => item[0] === id
    );

  return found
    ? found[1]
    : id;
}


/* -----------------------------
   STUDY TIMER
----------------------------- */

function homeElapsed() {
  if (
    !homeStudyState.active
  ) {
    return 0;
  }

  return Math.max(
    0,
    (
      Date.now() -
      Number(
        homeStudyState.active
          .startedAt || 0
      )
    ) / 1000
  );
}


function homeFormat(seconds) {
  seconds =
    Math.max(
      0,
      Math.floor(seconds)
    );

  return [
    Math.floor(
      seconds / 3600
    ),

    Math.floor(
      (seconds % 3600) / 60
    ),

    seconds % 60
  ]
    .map(
      value =>
        String(value)
          .padStart(2, "0")
    )
    .join(":");
}


/* -----------------------------
   LOAD STUDY DATA
----------------------------- */

async function homeLoadStudy() {
  if (!homeStudyUser) return;

  try {
    const snap =
      await getDoc(
        homeStudyRef()
      );

    if (snap.exists()) {
      const data =
        snap.data();

      homeStudyState = {
        totals:
          data.totals || {},

        sessions:
          data.sessions || [],

        active:
          data.active || null
      };
    }

  } catch (error) {
    console.error(
      "Study data load failed:",
      error
    );
  }


  try {
    const configSnap =
      await getDoc(
        homeConfigRef()
      );

    const remote =
      configSnap.exists() &&
      Array.isArray(
        configSnap.data()
          .customSubjects
      )
        ? configSnap.data()
            .customSubjects
        : [];

    let cache = [];

    try {
      cache =
        JSON.parse(
          localStorage.getItem(
            homeCacheKey()
          ) || "[]"
        );
    } catch {
      cache = [];
    }


    homeCustomSubjects = [
      ...remote,
      ...cache
    ]
      .filter(
        (item, index, array) =>
          Array.isArray(item) &&
          item.length >= 2 &&
          array.findIndex(
            x => x[0] === item[0]
          ) === index
      )
      .map(
        item => [
          String(item[0]),
          String(item[1]),
          "custom"
        ]
      );

    localStorage.setItem(
      homeCacheKey(),
      JSON.stringify(
        homeCustomSubjects
      )
    );

  } catch (error) {
    console.error(
      "Custom subjects load failed:",
      error
    );

    homeCustomSubjects = [];
  }
}


/* -----------------------------
   SAVE STUDY DATA
----------------------------- */

async function homeSave() {
  if (!homeStudyUser) {
    return;
  }

  try {
    await setDoc(
      homeStudyRef(),
      {
        date:
          homeToday(),

        totals:
          homeStudyState.totals,

        sessions:
          homeStudyState.sessions,

        active:
          homeStudyState.active,

        updatedAt:
          Date.now()
      },
      {
        merge: true
      }
    );

  } catch (error) {
    console.error(
      "Study save failed:",
      error
    );
  }
}


/* -----------------------------
   SUBJECT CHOOSER
----------------------------- */

function renderHomeChoices() {
  const box =
    $("homeStudySubjectList");

  if (!box) return;

  const list =
    homeSubjects();

  box.innerHTML =
    list
      .map(
        item => `
          <button
            class="home-study-subject-option"
            type="button"
            data-study-id="${item[0]}"
          >

            <span class="home-subject-icon">
              ${
                item[2] === "custom"
                  ? "＋"
                  : "▶"
              }
            </span>

            <span>
              <strong>
                ${item[1]}
              </strong>

              <small>
                ${
                  item[2] === "custom"
                    ? "Custom subject"
                    : "CMA subject"
                }
              </small>
            </span>

            <b class="subject-play">
              ▶
            </b>

          </button>
        `
      )
      .join("") ||
    `
      <div class="empty-state">
        No subjects configured.
        Open Course from the menu to add subjects.
      </div>
    `;

  box
    .querySelectorAll(
      "[data-study-id]"
    )
    .forEach(button => {
      button.onclick = () =>
        homeStart(
          button.dataset.studyId
        );
    });
}


async function openChooser() {
  homeStudyUser =
    homeStudyUser ||
    auth.currentUser;

  if (!homeStudyUser) {
    alert(
      "Please login first to start study."
    );
    return;
  }

  $("studySubjectModal")
    ?.classList.remove(
      "hidden"
    );

  await homeLoadStudy();

  renderHomeChoices();
}


function closeChooser() {
  $("studySubjectModal")
    ?.classList.add(
      "hidden"
    );
}


/* -----------------------------
   START STUDY
----------------------------- */

async function homeStart(id) {
  homeStudyUser =
    homeStudyUser ||
