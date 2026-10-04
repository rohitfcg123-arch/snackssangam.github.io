/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V3
PURPOSE: Academic selection, automatic exam countdown, and independent revision countdown.
EDITABLE AREAS: Storage key and official exam schedule.
DEPENDENCIES: index.html, css/home.css, js/academic.js, browser localStorage.
IMPORTANT NOTES: Subjects come only from js/academic.js. Exam countdown uses the December 2026 ICMAI schedule and the first exam date applicable to the selected course/group.
LAST UPDATED: 2026-10-04
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const STORE = "cma_zone_home_v1";
const COUNTDOWN_STORE = "cma_zone_countdowns_v2";
const state = JSON.parse(localStorage.getItem(STORE) || "{}");
const savedCountdowns = JSON.parse(localStorage.getItem(COUNTDOWN_STORE) || "{}");

// Countdown data is intentionally independent from course/group selection.
// Changing subjects must never erase a saved attempt or revision target.
if (savedCountdowns.attemptName && !state.attemptName) state.attemptName = savedCountdowns.attemptName;
if (savedCountdowns.attemptDate && !state.attemptDate) state.attemptDate = savedCountdowns.attemptDate;
if (savedCountdowns.revisionName && !state.revisionName) state.revisionName = savedCountdowns.revisionName;
if (savedCountdowns.revisionDate && !state.revisionDate) state.revisionDate = savedCountdowns.revisionDate;
const $ = id => document.getElementById(id);
const level = $("levelSelect");
const group = $("groupSelect");
const subjects = null;
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
  localStorage.setItem(COUNTDOWN_STORE, JSON.stringify({
    attemptName: state.attemptName || "",
    attemptDate: state.attemptDate || "",
    revisionName: state.revisionName || "",
    revisionDate: state.revisionDate || ""
  }));
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
  if (!level || !group) return;
  $("profileStatus").textContent = (!level.value || !group.value || !ACADEMIC[level.value])
    ? "Select your level and group."
    : ACADEMIC[level.value].label + " • " + group.options[group.selectedIndex].text + " selected.";
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
  // Only supply the automatic attempt name/date when the user has not already
  // created a separate saved countdown.
  if (!state.attemptName) state.attemptName = "December 2026 Attempt";
  $("attemptName").value = state.attemptName;
  $("attemptDate").value = date;
  save();
}

level.onchange = () => {
  groupOptions();
  state.level = level.value;
  state.group = "";
  state.elective = "";
  // Do NOT clear attempt/revision countdowns when academic selection changes.
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

function updateStartStudyLink() {}
if (electiveSelect) {
  electiveSelect.onchange = () => {
    state.elective = electiveSelect.value;
    save();
    render();
    updateStartStudyLink();
  };
}

// Academic selection is saved automatically on level/group/elective changes.
const saveProfileButton = $("saveProfile");
if (saveProfileButton) {
  saveProfileButton.onclick = () => {
    state.level = level.value;
    state.group = group.value;
    state.elective = electiveSelect?.value || "";
    syncExamDateToSelection();
    save();
    $("profileStatus").textContent = "Selection saved on this device.";
    updateStartStudyLink();
    tick();
  };
}

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
  const name = $("attemptName").value.trim();
  const date = $("attemptDate").value;
  if (!date) {
    $("attemptDate").focus();
    return;
  }
  state.attemptName = name || "Attempt";
  state.attemptDate = date;
  save();
  $("attemptEditor").classList.add("hidden");
  tick();
};

$("editRevision").onclick = () => {
  $("revisionEditor").classList.toggle("hidden");
  $("revisionEmpty").classList.toggle("hidden", false);
};

$("saveRevision").onclick = () => {
  const name = $("revisionNameInput").value.trim();
  const date = $("revisionDate").value;
  if (!date) {
    $("revisionDate").focus();
    return;
  }
  state.revisionName = name || "Revision";
  state.revisionDate = date;

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
setInterval(tick, 1000);

const STUDY_CONFIG_DOC="__config__";let homeStudyUser=null,homeStudyState={totals:{},sessions:[],active:null},homeCustomSubjects=[];
const homeToday=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const homeStudyRef=()=>homeStudyUser?doc(db,"users",homeStudyUser.uid,"studyDays",homeToday()):null;
const homeConfigRef=()=>homeStudyUser?doc(db,"users",homeStudyUser.uid,"studyDays",STUDY_CONFIG_DOC):null;
const homeCacheKey=()=>homeStudyUser?"cma_zone_custom_subjects_v1:"+homeStudyUser.uid:"";
function homeBuiltInSubjects(){if(!state.level||!state.group||!ACADEMIC[state.level])return[];const g=ACADEMIC[state.level].groups;if(state.group==="both")return["g1","g2","g3","g4"].filter(k=>g[k]).flatMap(k=>g[k]);const a=g[state.group]||[];if(state.level==="final"&&state.group==="g4"&&state.elective){const e=g.electives?.find(x=>x[0]===state.elective);return e?[...a,e]:a}return a}
const homeSubjects=()=>[...homeBuiltInSubjects(),...homeCustomSubjects],homeSubjectName=id=>homeSubjects().find(x=>x[0]===id)?.[1]||id;
const homeElapsed=()=>homeStudyState.active?Math.max(0,(Date.now()-Number(homeStudyState.active.startedAt||0))/1000):0;
const homeFormat=sec=>{sec=Math.max(0,Math.floor(sec));return[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,"0")).join(":")};
async function homeLoadStudy(){if(!homeStudyUser)return;try{const s=await getDoc(homeStudyRef());if(s.exists()){const d=s.data();homeStudyState={totals:d.totals||{},sessions:d.sessions||[],active:d.active||null}}}catch(e){console.error(e)}try{const s=await getDoc(homeConfigRef()),r=s.exists()&&Array.isArray(s.data().customSubjects)?s.data().customSubjects:[],cache=JSON.parse(localStorage.getItem(homeCacheKey())||"[]");homeCustomSubjects=[...r,...cache].filter((x,i,a)=>Array.isArray(x)&&x.length>=2&&a.findIndex(y=>y[0]===x[0])===i).map(x=>[String(x[0]),String(x[1]),"custom"]);localStorage.setItem(homeCacheKey(),JSON.stringify(homeCustomSubjects))}catch{homeCustomSubjects=[]}}
async function homeSave(){if(!homeStudyUser)return;try{await setDoc(homeStudyRef(),{date:homeToday(),totals:homeStudyState.totals,sessions:homeStudyState.sessions,active:homeStudyState.active,updatedAt:Date.now()},{merge:true})}catch(e){console.error("Study save failed",e)}}
function renderHomeChoices(q=""){const box=$("homeStudySubjectList");if(!box)return;q=q.toLowerCase();const list=homeSubjects().filter(x=>!q||x[1].toLowerCase().includes(q));box.innerHTML=list.map(x=>'<button class="home-study-subject-option" type="button" data-study-id="'+x[0]+'"><span class="home-subject-icon">'+(x[2]==="custom"?"＋":"▥")+'</span><span><strong>'+x[1]+'</strong><small>'+(x[2]==="custom"?"Custom subject":"CMA subject")+'</small></span><b>›</b></button>').join("")+'<button class="home-study-custom-option" id="homeAddCustom" type="button"><span>＋</span><div><strong>Add Custom Subject</strong><small>Create your own tracker</small></div></button>';box.querySelectorAll("[data-study-id]").forEach(b=>b.onclick=()=>homeStart(b.dataset.studyId));$("homeAddCustom")?.addEventListener("click",homeAddCustom)}
function openChooser(){if(!homeStudyUser){alert("Please login first to start study.");return}$("studySubjectModal").classList.remove("hidden");$("studySubjectSearch").value="";renderHomeChoices();setTimeout(()=>$("studySubjectSearch").focus(),60)}
function closeChooser(){$("studySubjectModal")?.classList.add("hidden")}
async function homeStart(id){if(!homeStudyUser)return;if(homeStudyState.active){const a=homeStudyState.active,d=homeElapsed();homeStudyState.totals[a.subjectId]=(homeStudyState.totals[a.subjectId]||0)+d;homeStudyState.sessions.push({subjectId:a.subjectId,start:a.startedAt,end:Date.now(),duration:d})}homeStudyState.active={subjectId:id,startedAt:Date.now()};await homeSave();closeChooser();renderHomeActive()}
async function homeStop(){if(!homeStudyState.active)return;const a=homeStudyState.active,d=homeElapsed();homeStudyState.totals[a.subjectId]=(homeStudyState.totals[a.subjectId]||0)+d;homeStudyState.sessions.push({subjectId:a.subjectId,start:a.startedAt,end:Date.now(),duration:d});homeStudyState.active=null;await homeSave();renderHomeActive()}
function renderHomeActive(){const c=$("homeActiveStudy"),b=$("startStudy");if(!c||!b)return;if(!homeStudyState.active){c.classList.add("hidden");b.classList.remove("hidden");return}c.classList.remove("hidden");b.classList.add("hidden");$("activeStudySubject").textContent=homeSubjectName(homeStudyState.active.subjectId);$("activeStudyTimer").textContent=homeFormat(homeElapsed());$("activeStudyStarted").textContent="Started "+new Date(homeStudyState.active.startedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});$("activeStudyToday").textContent="Today • "+homeFormat(Object.values(homeStudyState.totals).reduce((a,v)=>a+Number(v||0),0)+homeElapsed())+" total"}
async function homeAddCustom(){const n=prompt("Enter custom subject name");if(!n?.trim()||!homeStudyUser)return;const name=n.trim();if(homeCustomSubjects.some(x=>x[1].toLowerCase()===name.toLowerCase())){alert("This subject is already added.");return}homeCustomSubjects.push(["custom_"+Date.now(),name,"custom"]);try{localStorage.setItem(homeCacheKey(),JSON.stringify(homeCustomSubjects));await setDoc(homeConfigRef(),{customSubjects:homeCustomSubjects,updatedAt:Date.now()},{merge:true})}catch(e){console.error(e)}renderHomeChoices($("studySubjectSearch").value)}
$("startStudy")?.addEventListener("click",openChooser);$("closeStudySubject")?.addEventListener("click",closeChooser);$("studySubjectModal")?.addEventListener("click",e=>{if(e.target.id==="studySubjectModal")closeChooser()});$("studySubjectSearch")?.addEventListener("input",e=>renderHomeChoices(e.target.value));$("stopStudy")?.addEventListener("click",homeStop);
onAuthStateChanged(auth,async user=>{homeStudyUser=user;if(user){await homeLoadStudy();renderHomeActive()}else{homeStudyState={totals:{},sessions:[],active:null};renderHomeActive()}});
setInterval(renderHomeActive,1000);

