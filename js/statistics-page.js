/*
FILE: js/statistics-page.js
REFERENCE: CMA-ZONE-STATISTICS-PAGE-V1
PURPOSE: Dedicated statistics dashboard using the same Firestore studyDays data as the Study timer.
EDITABLE AREAS: KPI calculations, weekly target, dashboard cards.
DEPENDENCIES: pages/statistics.html, css/statistics.css, js/firebase.js, js/academic.js.
IMPORTANT NOTES: Accuracy, MCQ and PYQ scores are not fabricated because the current study tracker does not store those values.
LAST UPDATED: 2026-10-05
*/
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const HOME_KEY="cma_zone_home_v1";
const CACHE_PREFIX="cma_zone_custom_subjects_v1:";
let user=null, days={}, customSubjects=[];
const $=id=>document.getElementById(id);

function todayKey(){const d=new Date();return d.toISOString().slice(0,10)}
function date(k){const [y,m,d]=k.split("-").map(Number);return new Date(Date.UTC(y,m-1,d))}
function key(d){return d.toISOString().slice(0,10)}
function add(k,n){const d=date(k);d.setUTCDate(d.getUTCDate()+n);return key(d)}
function monday(k){const d=date(k),w=d.getUTCDay();d.setUTCDate(d.getUTCDate()+(w===0?-6:1-w));return key(d)}
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h?h+"h "+m+"m":m+"m"}
function clock(sec){sec=Math.max(0,Math.floor(sec||0));return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,"0")).join(":")}
function label(k){return date(k).toLocaleDateString("en-IN",{timeZone:"UTC",day:"numeric",month:"short"})}
function elapsed(a){return a?Math.max(0,(Date.now()-Number(a.startedAt||0))/1000):0}
function total(day){if(!day)return 0;return Object.values(day.totals||{}).reduce((a,b)=>a+Number(b||0),0)+elapsed(day.active)}
function cachedCustom(){try{return JSON.parse(localStorage.getItem(CACHE_PREFIX+user.uid)||"[]")}catch{return[]}}
function selection(){try{return JSON.parse(localStorage.getItem(HOME_KEY)||"{}")}catch{return{}}}
function subjectMap(){
 const out={}; const s=selection();
 if(s.level&&s.group&&typeof ACADEMIC!=="undefined"&&ACADEMIC[s.level]){
  const g=ACADEMIC[s.level].groups;
  const list=s.group==="both"?["g1","g2","g3","g4"].filter(x=>g[x]).flatMap(x=>g[x]):(g[s.group]||[]);
  list.forEach(x=>out[x[0]]=x[1]);
  if(s.level==="final"&&s.group==="g4"&&s.elective){const e=g.electives?.find(x=>x[0]===s.elective);if(e)out[e[0]]=e[1]}
 }
 customSubjects.forEach(x=>out[x[0]]=x[1]); return out;
}
async function load(){
 if(!user){days={};customSubjects=[];return}
 const [ds,c]=await Promise.all([
  getDocs(collection(db,"users",user.uid,"studyDays")),
  getDoc(doc(db,"users",user.uid,"studyDays","__config__"))
 ]);
 days={};ds.forEach(x=>{if(x.id!=="__config__")days[x.id]=x.data()});
 const remote=c.exists()&&Array.isArray(c.data().customSubjects)?c.data().customSubjects:[];
 const local=cachedCustom();
 customSubjects=[...remote,...local].filter((x,i,a)=>Array.isArray(x)&&x.length>=2&&a.findIndex(y=>String(y[0])===String(x[0]))===i).map(x=>[String(x[0]),String(x[1])]);
 if(customSubjects.length)localStorage.setItem(CACHE_PREFIX+user.uid,JSON.stringify(customSubjects));
}
function allDates(){
 const end=todayKey(), keys=Object.keys(days);
 const dates=[...keys,end].filter((x,i,a)=>a.indexOf(x)===i).sort();
 return dates;
}
function render(){
 const s=selection(), names=subjectMap(), dates=allDates();
 const totals=dates.map(k=>({key:k,seconds:total(days[k])}));
 const totalTime=totals.reduce((a,x)=>a+x.seconds,0), active=totals.filter(x=>x.seconds>0);
 const avg=active.length?totalTime/active.length:0;
 const best=active.slice().sort((a,b)=>b.seconds-a.seconds)[0];
 $("totalTime").textContent=fmt(totalTime);
 $("activeDays").textContent=active.length;
 $("dailyAverage").textContent=fmt(avg);
 $("bestDay").textContent=best?fmt(best.seconds):"—";
 $("bestDayLabel").textContent=best?label(best.key):"No study yet";
 const selectedCount=Object.keys(names).length, tracked=Object.keys(names).filter(id=>totals.some(x=>(days[x.key]?.totals?.[id]||0)>0)).length;
 const pct=selectedCount?Math.round(tracked/selectedCount*100):0;
 $("trackedPercent").textContent=pct+"%"; $("trackedSubjects").textContent=tracked;
 $("selectedSubjects").textContent=selectedCount||0; $("customSubjects").textContent=customSubjects.length;
 let sessions=0; Object.values(days).forEach(d=>sessions+=(d.sessions||[]).length); $("sessionCount").textContent=sessions;
 $("overviewText").textContent=selectedCount?tracked+" of "+selectedCount+" selected subjects have recorded study time.":"Select a course/group or add a custom subject.";
 $("overviewRing").style.setProperty("--progress",pct*3.6+"deg");
 $("selectionBadge").textContent=s.level&&s.group?(ACADEMIC?.[s.level]?.label||s.level)+" • "+(s.group==="both"?"Both Groups":s.group.toUpperCase()):"No selection saved";
 const countdown=JSON.parse(localStorage.getItem("cma_zone_countdowns_v2")||"{}");
 const attemptDate=countdown.attemptDate||s.attemptDate||"";
 $("attemptBadge").textContent=countdown.attemptName||s.attemptName||"Attempt not set";
 $("examCountdown").textContent=attemptDate?daysUntil(attemptDate):"—";
 $("examLabel").textContent=attemptDate?(countdown.attemptName||"Exam attempt")+" • "+attemptDate:"Set your course/group on Home";
 $("revisionCountdown").textContent=countdown.revisionDate?daysUntil(countdown.revisionDate):"—";
 $("revisionLabel").textContent=countdown.revisionDate?(countdown.revisionName||"Revision")+" • "+countdown.revisionDate:"No revision countdown set";
 renderSubjects(names);
 renderHeatmap();
 renderWeek();
 renderTrend();
 renderWeak(names);
 renderRecent(names);
}
function daysUntil(d){const t=new Date(d+"T00:00:00").getTime(),n=Date.now();return Math.max(0,Math.ceil((t-n)/86400000))+" days"}
function renderSubjects(names){
 const by={}; Object.values(days).forEach(d=>Object.entries(d.totals||{}).forEach(([id,v])=>by[id]=(by[id]||0)+Number(v||0)));
 const rows=Object.entries(names).map(([id,name])=>({id,name,seconds:by[id]||0})).sort((a,b)=>b.seconds-a.seconds);
 const max=Math.max(1,...rows.map(x=>x.seconds));
 $("subjectPerformance").innerHTML=rows.length?rows.map(x=>'<div class="subject-row-stat"><div class="subject-row-name"><strong>'+escape(x.name)+'</strong><span>'+fmt(x.seconds)+'</span></div><div class="subject-track"><i style="width:'+Math.round(x.seconds/max*100)+'%"></i></div></div>').join(""):'<div class="empty-stat">No subjects available yet.</div>';
}
function renderHeatmap(){
 const arr=Array.from({length:28},(_,i)=>{const k=add(todayKey(),i-27);return{k,seconds:total(days[k])}});
 const max=Math.max(1,...arr.map(x=>x.seconds));
 $("consistencyLabel").textContent=arr.filter(x=>x.seconds>0).length+" active days";
 $("heatmap").innerHTML=arr.map(x=>'<button title="'+label(x.k)+' • '+fmt(x.seconds)+'" class="heat-cell h'+Math.min(4,Math.ceil(x.seconds/max*4))+'" data-date="'+x.k+'"></button>').join("");
}
function renderWeek(){
 const start=monday(todayKey()), arr=Array.from({length:7},(_,i)=>{const k=add(start,i);return{k,seconds:total(days[k])}});
 const sum=arr.reduce((a,x)=>a+x.seconds,0), max=Math.max(1,...arr.map(x=>x.seconds));
 $("weekTotal").textContent=fmt(sum);
 $("weekHours").textContent=fmt(sum);
 $("weekDays").textContent=arr.filter(x=>x.seconds>0).length+"/7";
 const targetHours=30, targetDays=7;
 const hp=Math.min(100,Math.round(sum/(targetHours*3600)*100)), dp=Math.min(100,Math.round(arr.filter(x=>x.seconds>0).length/targetDays*100));
 $("weekBar").style.width=hp+"%";$("weekDayBar").style.width=dp+"%";$("weekPct").textContent=hp+"%";$("weekDayPct").textContent=dp+"%";
 $("weeklyChart").innerHTML=arr.map(x=>'<div class="chart-col"><span>'+fmt(x.seconds)+'</span><i style="height:'+Math.max(4,Math.round(x.seconds/max*150))+'px"></i><small>'+date(x.k).toLocaleDateString("en-IN",{timeZone:"UTC",weekday:"short"})+'</small></div>').join("");
}
function renderTrend(){/* kept in weekly chart for the compact dashboard */}
function renderWeak(names){
 const rows=Object.entries(names).map(([id,name])=>{let s=0;Object.values(days).forEach(d=>s+=Number(d.totals?.[id]||0));return{name,seconds:s}}).sort((a,b)=>a.seconds-b.seconds).slice(0,5);
 $("weakAreas").innerHTML=rows.length?rows.map(x=>'<div class="weak-row"><span>'+escape(x.name)+'</span><strong>'+fmt(x.seconds)+'</strong><small>'+(!x.seconds?"Not started":"Lowest tracked time")+'</small></div>').join(""):'<div class="empty-stat">Start tracking subjects to identify low-activity areas.</div>';
}
function renderRecent(names){
 const rows=[]; Object.entries(days).forEach(([k,d])=>(d.sessions||[]).forEach(s=>rows.push({...s,date:k})));
 rows.sort((a,b)=>Number(b.end||0)-Number(a.end||0));
 $("recentActivity").innerHTML=rows.slice(0,6).map(x=>'<div class="recent-row"><span class="recent-dot"></span><div><strong>'+escape(names[x.subjectId]||x.subjectId)+'</strong><small>'+label(x.date)+' • '+fmt(x.duration)+'</small></div><b>'+new Date(Number(x.end||0)).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+'</b></div>').join("")||'<div class="empty-stat">No sessions recorded yet.</div>';
}
function escape(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
onAuthStateChanged(auth,async u=>{user=u;try{await load();render()}catch(e){console.error(e)}});