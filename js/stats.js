/*
FILE: js/stats.js
REFERENCE: CMA-ZONE-STUDY-STATS-V1
PURPOSE: Render Study Statistics from the currently logged-in student's study data.
EDITABLE AREAS: Statistics calculations and report presentation.
DEPENDENCIES: js/firebase.js, js/academic.js, js/home.js, localStorage UID study data.
IMPORTANT NOTES: No demo statistics are generated. Each student's statistics use only cma_zone_study_v1_<Firebase UID> on this device.
LAST UPDATED: 2026-10-04
*/

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const reportView = document.getElementById("reportView");
const tabs = document.querySelectorAll("[data-report-view]");
let user = null;

const key = () => user ? "cma_zone_study_v1_" + user.uid : null;
const study = () => {
  try { return JSON.parse(localStorage.getItem(key()) || '{"days":{},"active":null}'); }
  catch { return { days:{}, active:null }; }
};
const dateKey = d => d.toISOString().slice(0,10);
const dayTotal = (s,k) => Object.values(s.days?.[k]?.totals || {}).reduce((a,b)=>a+Number(b||0),0);
const total = s => Object.values(s.days||{}).reduce((a,d)=>a+Object.values(d.totals||{}).reduce((x,y)=>x+Number(y||0),0),0);
const fmt = n => { n=Math.max(0,Math.floor(n)); return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,"0")).join(":"); };
const short = n => { n=Math.max(0,Math.floor(n)); return Math.floor(n/3600)+"h "+Math.floor(n%3600/60)+"m"; };

function days(count) {
  const s=study(), out=[], now=new Date();
  for(let i=count-1;i>=0;i--){
    const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    out.push({date:d,key:dateKey(d),seconds:dayTotal(s,dateKey(d))});
  }
  return out;
}

function subjects() {
  const level=document.getElementById("levelSelect")?.value;
  const group=document.getElementById("groupSelect")?.value;
  const state=JSON.parse(localStorage.getItem("cma_zone_home_v1")||"{}");
  const map={};
  if(!level||!group||!ACADEMIC[level]) return map;
  const data=ACADEMIC[level].groups;
  const list=group==="both" ? ["g1","g2","g3","g4"].filter(k=>data[k]).flatMap(k=>data[k]) : (data[group]||[]);
  list.forEach(s=>map[s[0]]=s[1]);
  if(level==="final"&&group==="g4"&&state.elective){
    const e=data.electives?.find(s=>s[0]===state.elective);
    if(e) map[e[0]]=e[1];
  }
  return map;
}

function bar(label,value,height,tone){
  return '<div class="sample-bar-item"><div class="sample-bar-track"><span class="'+tone+'" style="height:'+Math.max(8,height)+'%"></span></div><small>'+label+'</small><b>'+value+'</b></div>';
}

function render(view="period"){
  if(!reportView) return;
  const s=study(), recent=days(28), all=total(s), active=recent.filter(d=>d.seconds>0).length, avg=active?all/active:0, names=subjects();
  const bySubject={};
  Object.values(s.days||{}).forEach(d=>Object.entries(d.totals||{}).forEach(([id,v])=>bySubject[id]=(bySubject[id]||0)+Number(v||0)));
  const entries=Object.entries(bySubject).filter(([id])=>names[id]).sort((a,b)=>b[1]-a[1]);

  if(view==="period"){
    const max=Math.max(1,...entries.map(([,v])=>v));
    const rows=entries.length?entries.slice(0,6).map(([id,v],i)=>bar(names[id].split(" (")[0],short(v),v/max*100,["orange","teal","purple","blue"][i%4])).join(""):'<div class="empty-timeline">No study activity yet. Start a subject timer to build your statistics.</div>';
    reportView.innerHTML='<div class="report-summary-grid"><div><span>Total time</span><strong>'+fmt(all)+'</strong></div><div><span>Daily average</span><strong>'+short(avg)+'</strong></div></div><div class="sample-calendar"><div class="calendar-title">Last 28 days</div><div class="calendar-days">'+recent.map(d=>'<span class="'+(d.seconds?'study':'')+'">'+d.date.getDate()+'</span>').join("")+'</div><div class="calendar-foot">Active days '+active+' &nbsp; • &nbsp; Total '+short(all)+'</div></div><div class="report-card"><div class="report-card-head"><div><strong>Subject time</strong><span>Actual study time by subject</span></div></div><div class="sample-bars">'+rows+'</div></div>';
  } else if(view==="day"){
    const today=dateKey(new Date()), sessions=s.days?.[today]?.sessions||[], secs=dayTotal(s,today);
    reportView.innerHTML='<div class="report-summary-grid"><div><span>Today</span><strong>'+fmt(secs)+'</strong></div><div><span>Sessions</span><strong>'+sessions.length+'</strong></div></div><div class="report-card day-detail"><div class="report-card-head"><div><strong>Study timeline</strong><span>Today</span></div></div>'+(sessions.length?sessions.map(x=>'<div class="empty-timeline">'+(names[x.subjectId]||x.subjectId)+' — '+fmt(x.duration)+'</div>').join(""):'<div class="empty-timeline">No study session recorded today.</div>')+'</div>';
  } else if(view==="week"){
    const week=days(7), max=Math.max(1,...week.map(d=>d.seconds));
    reportView.innerHTML='<div class="report-summary-grid"><div><span>Last 7 days</span><strong>'+fmt(week.reduce((a,d)=>a+d.seconds,0))+'</strong></div><div><span>Active days</span><strong>'+week.filter(d=>d.seconds).length+'</strong></div></div><div class="report-card"><div class="report-card-head"><div><strong>Weekly study progress</strong><span>Actual study time</span></div></div><div class="sample-bars week-bars">'+week.map(d=>bar(d.date.toLocaleDateString("en",{weekday:"short"}),short(d.seconds),d.seconds/max*100,"teal")).join("")+'</div></div>';
  } else if(view==="month"){
    const now=new Date(), prefix=dateKey(now).slice(0,7), month=Object.entries(s.days||{}).filter(([k])=>k.startsWith(prefix)), mt=month.reduce((a,[,d])=>a+Object.values(d.totals||{}).reduce((x,y)=>x+Number(y||0),0),0);
    reportView.innerHTML='<div class="report-summary-grid"><div><span>This month</span><strong>'+fmt(mt)+'</strong></div><div><span>Active days</span><strong>'+month.filter(([,d])=>Object.values(d.totals||{}).some(v=>Number(v)>0)).length+'</strong></div></div><div class="report-card"><div class="report-card-head"><div><strong>Monthly progress</strong><span>'+now.toLocaleDateString("en",{month:"long",year:"numeric"})+'</span></div></div><div class="empty-timeline">'+(mt?'Study activity is being tracked from your actual sessions.':'No study activity this month yet.')+'</div></div>';
  } else {
    const trend=days(14), max=Math.max(1,...trend.map(d=>d.seconds));
    reportView.innerHTML='<div class="report-card"><div class="report-card-head"><div><strong>14-day study trend</strong><span>Actual study sessions</span></div></div><div class="sample-bars">'+trend.map(d=>bar(d.date.getDate(),short(d.seconds),d.seconds/max*100,"purple")).join("")+'</div></div><div class="report-card"><div class="report-card-head"><div><strong>Consistency</strong><span>Days with recorded study time</span></div></div><div class="empty-timeline">'+trend.filter(d=>d.seconds).length+' of 14 days have recorded study activity.</div></div>';
  }
}

tabs.forEach(t=>t.addEventListener("click",()=>{ tabs.forEach(x=>x.classList.toggle("active",x===t)); render(t.dataset.reportView); }));
onAuthStateChanged(auth,u=>{ user=u; render(document.querySelector("[data-report-view].active")?.dataset.reportView||"period"); });
render("period");
