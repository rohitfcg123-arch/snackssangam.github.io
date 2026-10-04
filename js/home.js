/*
FILE: js/home.js
REFERENCE: CMA-ZONE-HOME-V3
PURPOSE: Academic selection, automatic exam countdown, and independent revision countdown.
EDITABLE AREAS: Storage key and official exam schedule.
DEPENDENCIES: index.html, css/home.css, js/academic.js, browser localStorage.
IMPORTANT NOTES: Subjects come only from js/academic.js. Exam countdown uses the December 2026 ICMAI schedule and the first exam date applicable to the selected course/group.
LAST UPDATED: 2026-10-05
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const STORE = "cma_zone_home_v1";
const COUNTDOWN_STORE = "cma_zone_countdowns_v2";
let state = {};
let cloudReady = false;
let cloudUserId = "";

function writeLocalCache(){
  try{
    localStorage.setItem(STORE, JSON.stringify(state));
    localStorage.setItem(COUNTDOWN_STORE, JSON.stringify({
      attemptName: state.attemptName || "",
      attemptDate: state.attemptDate || "",
      revisionName: state.revisionName || "",
      revisionDate: state.revisionDate || ""
    }));
  }catch(e){}
}
const $ = id => document.getElementById(id);
const level = null;
const group = null;
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
let logoutInProgress=false;
async function performLogout(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if(logoutInProgress)return;
  logoutInProgress=true;
  const buttons=[logoutButton,headerLogout,$("menuLogout")].filter(Boolean);
  buttons.forEach(b=>{b.disabled=true;b.setAttribute("aria-busy","true")});
  try{
    await signOut(auth);
    window.location.replace("./pages/signin.html?loggedout=1");
  }catch(e){
    console.error("Home logout failed:",e);
    logoutInProgress=false;
    buttons.forEach(b=>{b.disabled=false;b.removeAttribute("aria-busy")});
    alert("Logout failed: "+(e?.code||e?.message||"Unknown error"));
  }
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

async function saveCloudState() {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db,"users",auth.currentUser.uid,"studyDays","config"),{
      courseLevel:state.level||"",group:state.group||"",elective:state.elective||"",
      attemptMonth:state.attemptMonth||"",attemptYear:Number(state.attemptYear)||0,
      attemptName:state.attemptName||"",attemptDate:state.attemptDate||"",
      revisionName:state.revisionName||"",revisionDate:state.revisionDate||"",
      updatedAt:Date.now()
    },{merge:true});
  } catch(e){ console.error("Cloud setup save failed:",e); }
}
async function loadCloudState(user) {
  if (!user) return false;
  cloudReady = false;
  cloudUserId = user.uid;
  try {
    const snap=await getDoc(doc(db,"users",user.uid,"studyDays","config"));
    if (!snap.exists()) {
      state = {};
      cloudReady = true;
      return true;
    }
    const d=snap.data()||{};
    state = {
      level: d.courseLevel || "",
      group: d.group || "",
      elective: d.elective || "",
      attemptMonth: d.attemptMonth || "",
      attemptYear: d.attemptYear ? Number(d.attemptYear) : 0,
      attemptName: d.attemptName || "",
      attemptDate: d.attemptDate || "",
      revisionName: d.revisionName || "",
      revisionDate: d.revisionDate || ""
    };
    if(d.courseLevel) state.level=d.courseLevel;
    if(d.group) state.group=d.group;
    if(d.elective!==undefined) state.elective=d.elective;
    if(d.attemptMonth) state.attemptMonth=d.attemptMonth;
    if(d.attemptYear) state.attemptYear=Number(d.attemptYear);
    if(d.attemptName) state.attemptName=d.attemptName;
    if(d.attemptDate) state.attemptDate=d.attemptDate;
    if(d.revisionName) state.revisionName=d.revisionName;
    if(d.revisionDate) state.revisionDate=d.revisionDate;
    localStorage.setItem(STORE,JSON.stringify(state));
    localStorage.setItem(COUNTDOWN_STORE,JSON.stringify({attemptName:state.attemptName||"",attemptDate:state.attemptDate||"",revisionName:state.revisionName||"",revisionDate:state.revisionDate||""}));
  } catch(e){ console.error("Cloud setup load failed:",e); cloudReady = false; return false; }
}
function save() {
  if (!cloudReady || !auth.currentUser || cloudUserId !== auth.currentUser.uid) {
    console.warn("Cloud is not ready; refusing to treat localStorage as source of truth.");
    return;
  }
  void saveCloudState().then(writeLocalCache);
}

function groupLabel(key) {
  if (key === "g1") return "Group 1";
  if (key === "g2") return "Group 2";
  if (key === "g3") return "Group 3";
  if (key === "g4") return "Group 4";
  if (key === "electives") return "Electives";
  return "Foundation";
}

// Course selection has moved to pages/course.html. Home only reads the saved selection.
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

function renderCloudCourseSummary(){
  const courseEl=$("homeCourseText"), attemptEl=$("homeAttemptText"), countEl=$("homeExamCountdown"), dateEl=$("homeExamDate");
  if(!courseEl || !attemptEl || !countEl || !dateEl) return;
  if(!cloudReady){
    courseEl.textContent="Loading cloud data…";
    attemptEl.textContent="Loading exam attempt…";
    countEl.textContent="—";
    dateEl.textContent="Syncing with Firebase…";
    return;
  }
  const levelNames={foundation:"Foundation",inter:"Intermediate",final:"Final"};
  const groupNames={g1:"Group 1",g2:"Group 2",g3:"Group 3",g4:"Group 4",both:"Both Groups"};
  courseEl.textContent=state.level ? (levelNames[state.level] || state.level) + (state.group ? " • " + (groupNames[state.group] || state.group) : "") : "Course not saved";
  attemptEl.textContent=state.attemptName || "Select exam attempt";
  const parts=countdownParts(state.attemptDate);
  countEl.innerHTML=countdownHTML(parts);
  dateEl.textContent=state.attemptDate ? "Exam date: " + state.attemptDate : "Open Course to set your exam.";
}

function tick() {
  renderCloudCourseSummary();
  const attemptParts = countdownParts(state.attemptDate);

  $("attemptCountdown")?.replaceChildren(); if ($("attemptCountdown")) $("attemptCountdown").innerHTML = countdownHTML(attemptParts);

  if ($("attemptDateLabel")) $("attemptDateLabel").textContent =
    state.attemptDate
      ? (state.attemptName || "December 2026 Attempt") +
        " • First exam: " + state.attemptDate
      : "Select your course and group";

  const revisionParts = countdownParts(state.revisionDate);

  if ($("revisionCountdown")) $("revisionCountdown").innerHTML = countdownHTML(revisionParts);
}

$("editAttempt")?.addEventListener("click", () => {
  $("attemptEditor").classList.toggle("hidden");
});

$("saveAttempt")?.addEventListener("click", () => {
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
});

$("editRevision")?.addEventListener("click", () => {
  $("revisionEditor").classList.toggle("hidden");
  $("revisionEmpty").classList.toggle("hidden", false);
});

$("saveRevision")?.addEventListener("click", () => {
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


if (state.attemptName && $("attemptName")) $("attemptName").value = state.attemptName;
if (state.attemptDate && $("attemptDate")) $("attemptDate").value = state.attemptDate;

if (state.revisionName) {
  $("revisionName").textContent = state.revisionName;
  $("revisionDateLabel").textContent = state.revisionDate || "";
  $("revisionEmpty").classList.add("hidden");
  $("revisionView").classList.remove("hidden");
}


// Course setup is handled on pages/course.html.
tick();
setInterval(tick, 1000);

const STUDY_CONFIG_DOC="config";let homeStudyUser=null,homeStudyState={totals:{},sessions:[],active:null},homeCustomSubjects=[];
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
function renderHomeChoices(){const box=$("homeStudySubjectList");if(!box)return;const list=homeSubjects();box.innerHTML=list.map(x=>'<button class="home-study-subject-option" type="button" data-study-id="'+x[0]+'"><span class="home-subject-icon">'+(x[2]==="custom"?"＋":"▶")+'</span><span><strong>'+x[1]+'</strong><small>'+(x[2]==="custom"?"Custom subject":"CMA subject")+'</small></span><b class="subject-play">▶</b></button>').join("")||'<div class="empty-state">No subjects configured. Open Course from the menu to add subjects.</div>';box.querySelectorAll("[data-study-id]").forEach(b=>b.onclick=()=>homeStart(b.dataset.studyId))}
async function openChooser(){
  homeStudyUser=homeStudyUser||auth.currentUser;
  if(!homeStudyUser){alert("Please login first to start study.");return}
  $("studySubjectModal")?.classList.remove("hidden");
  try{await homeLoadStudy()}catch(e){console.error(e)}
  renderHomeChoices();
}
function closeChooser(){$("studySubjectModal")?.classList.add("hidden")}
async function homeStart(id){
  homeStudyUser=homeStudyUser||auth.currentUser;
  if(!homeStudyUser)return;if(homeStudyState.active){const a=homeStudyState.active,d=homeElapsed();homeStudyState.totals[a.subjectId]=(homeStudyState.totals[a.subjectId]||0)+d;homeStudyState.sessions.push({subjectId:a.subjectId,start:a.startedAt,end:Date.now(),duration:d})}homeStudyState.active={subjectId:id,startedAt:Date.now()};await homeSave();closeChooser();renderHomeActive()}
async function homeStop(){if(!homeStudyState.active)return;const a=homeStudyState.active,d=homeElapsed();homeStudyState.totals[a.subjectId]=(homeStudyState.totals[a.subjectId]||0)+d;homeStudyState.sessions.push({subjectId:a.subjectId,start:a.startedAt,end:Date.now(),duration:d});homeStudyState.active=null;await homeSave();renderHomeActive()}
function renderHomeActive(){const c=$("homeActiveStudy"),b=$("startStudy");if(!c||!b)return;if(!homeStudyState.active){c.classList.add("hidden");b.classList.remove("hidden");return}c.classList.remove("hidden");b.classList.add("hidden");$("activeStudySubject").textContent=homeSubjectName(homeStudyState.active.subjectId);$("activeStudyTimer").textContent=homeFormat(homeElapsed());$("activeStudyStarted").textContent="Started "+new Date(homeStudyState.active.startedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});$("activeStudyToday").textContent="Today • "+homeFormat(Object.values(homeStudyState.totals).reduce((a,v)=>a+Number(v||0),0)+homeElapsed())+" total"}
async function homeAddCustom(){const n=prompt("Enter custom subject name");if(!n?.trim()||!homeStudyUser)return;const name=n.trim();if(homeCustomSubjects.some(x=>x[1].toLowerCase()===name.toLowerCase())){alert("This subject is already added.");return}homeCustomSubjects.push(["custom_"+Date.now(),name,"custom"]);try{localStorage.setItem(homeCacheKey(),JSON.stringify(homeCustomSubjects));await setDoc(homeConfigRef(),{customSubjects:homeCustomSubjects,updatedAt:Date.now()},{merge:true})}catch(e){console.error(e)}renderHomeChoices()}
$("startStudy")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openChooser();});$("closeStudySubject")?.addEventListener("click",closeChooser);$("studySubjectModal")?.addEventListener("click",e=>{if(e.target.id==="studySubjectModal")closeChooser()});$("stopStudy")?.addEventListener("click",homeStop);
onAuthStateChanged(auth,async user=>{
  homeStudyUser=user;
  if(user){
    await loadCloudState(user);
    renderCloudCourseSummary();
    await homeLoadStudy();
    renderHomeActive();
    tick();
  }else{
    cloudReady=false;
    cloudUserId="";
    state={};
    homeStudyState={totals:{},sessions:[],active:null};
    renderCloudCourseSummary();
    renderHomeActive();
  }
});
setInterval(renderHomeActive,1000);


$("quickRevision")?.addEventListener("click",()=>{$("editRevision")?.click();document.getElementById("revisionEditor")?.scrollIntoView({behavior:"smooth",block:"center"})});
$("quickDaily")?.addEventListener("click",()=>{$("levelSelect")?.scrollIntoView({behavior:"smooth",block:"center"});$("levelSelect")?.focus()});

/* Side drawer */
const menuToggle=$("menuToggle"),menuClose=$("menuClose"),menuOverlay=$("menuOverlay"),sideMenu=$("sideMenu");
function openMenu(){sideMenu?.classList.add("open");menuOverlay?.classList.remove("hidden");sideMenu?.setAttribute("aria-hidden","false");document.body.classList.add("menu-open")}
function closeMenu(){sideMenu?.classList.remove("open");menuOverlay?.classList.add("hidden");sideMenu?.setAttribute("aria-hidden","true");document.body.classList.remove("menu-open")}
menuToggle?.addEventListener("click",openMenu);menuClose?.addEventListener("click",closeMenu);menuOverlay?.addEventListener("click",closeMenu);
document.querySelectorAll("[data-menu]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();closeMenu();const key=a.dataset.menu;if(key==="settings")alert("Settings section is coming here. Course settings are available in Course.");else if(key==="students")alert("Student details will be available here.");else if(key==="revision")$("quickRevision")?.click();else if(key==="countdown")$("editAttempt")?.click();else alert("This section is ready for the next module.")}));
$("menuLogout")?.addEventListener("click",performLogout);
