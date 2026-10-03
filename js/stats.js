/*
FILE: js/stats.js
REFERENCE: CMA-ZONE-STUDY-STATS-V3
PURPOSE: Live student study dashboard with period, day, week, month and trend views.
EDITABLE AREAS: Dashboard calculations, navigation and chart presentation.
DEPENDENCIES: index.html, css/home.css, js/firebase.js, js/academic.js.
IMPORTANT NOTES: Study data comes from Cloud Firestore. Date keys match js/study.js.
LAST UPDATED: 2026-10-04
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const view = document.getElementById("reportView");
const tabs = document.querySelectorAll("[data-report-view]");
let user = null, days = {}, customSubjects = [];
let selectedDay = today(), weekStart = monday(today()), monthKey = today().slice(0,7), periodEnd = today();

function today(){ return new Date().toISOString().slice(0,10); }
function date(k){ const [y,m,d]=k.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)); }
function key(d){ return d.toISOString().slice(0,10); }
function add(k,n){ const d=date(k); d.setUTCDate(d.getUTCDate()+n); return key(d); }
function monday(k){ const d=date(k), w=d.getUTCDay(); d.setUTCDate(d.getUTCDate()+(w===0?-6:1-w)); return key(d); }
function shiftMonth(k,n){ const [y,m]=k.split("-").map(Number); return key(new Date(Date.UTC(y,m-1+n,1))).slice(0,7); }
function fmt(n){ n=Math.max(0,Math.floor(n||0)); return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,"0")).join(":"); }
function short(n){ n=Math.max(0,Math.floor(n||0)); const h=Math.floor(n/3600),m=Math.floor(n%3600/60); return h?(h+"h "+m+"m"):m+"m"; }
function label(k,opt={day:"numeric",month:"short"}){ return date(k).toLocaleDateString("en-IN",{timeZone:"UTC",...opt}); }
function elapsed(a){ return a?Math.max(0,(Date.now()-Number(a.startedAt||0))/1000):0; }
function total(day){ if(!day)return 0; return Object.values(day.totals||{}).reduce((a,b)=>a+Number(b||0),0)+elapsed(day.active); }
function range(n,end=periodEnd){ return Array.from({length:n},(_,i)=>{const k=add(end,i-n+1);return {key:k,seconds:total(days[k])};}); }

function names(){
  const out={}, st=JSON.parse(localStorage.getItem("cma_zone_home_v1")||"{}");
  if(typeof ACADEMIC!=="undefined" && st.level && st.group && ACADEMIC[st.level]){
    const g=ACADEMIC[st.level].groups;
    const list=st.group==="both"?["g1","g2","g3","g4"].filter(x=>g[x]).flatMap(x=>g[x]):(g[st.group]||[]);
    list.forEach(x=>out[x[0]]=x[1]);
    if(st.level==="final"&&st.group==="g4"&&st.elective){
      const e=g.electives?.find(x=>x[0]===st.elective); if(e) out[e[0]]=e[1];
    }
  }
  customSubjects.forEach(x=>out[x[0]]=x[1]);
  return out;
}

async function load(){
  if(!user){days={};customSubjects=[];return;}
  try{
    const snap=await getDocs(collection(db,"users",user.uid,"studyDays"));
    days={}; snap.forEach(x=>{if(x.id!=="__config__")days[x.id]=x.data();});
    const c=await getDoc(doc(db,"users",user.uid,"studyDays","__config__"));
    customSubjects=c.exists()&&Array.isArray(c.data().customSubjects)?c.data().customSubjects:[]; 
  }catch(e){console.error(e);days={};customSubjects=[];}
}

function nav(title,prev,next,nextDisabled=false){
  return '<div class="stats-navigation"><button type="button" class="stats-nav-button" data-action="'+prev+'">‹</button><strong>'+title+'</strong><button type="button" class="stats-nav-button" data-action="'+next+'" '+(nextDisabled?"disabled":"")+'>›</button></div>';
}
function bind(){
  view.querySelectorAll("[data-action]").forEach(b=>b.onclick=async()=>{
    const a=b.dataset.action;
    if(a==="day-prev")selectedDay=add(selectedDay,-1);
    if(a==="day-next")selectedDay=add(selectedDay,1);
    if(a==="week-prev")weekStart=add(weekStart,-7);
    if(a==="week-next")weekStart=add(weekStart,7);
    if(a==="month-prev")monthKey=shiftMonth(monthKey,-1);
    if(a==="month-next")monthKey=shiftMonth(monthKey,1);
    if(a==="period-prev")periodEnd=add(periodEnd,-28);
    if(a==="period-next")periodEnd=add(periodEnd,28);
    await load(); render(activeView());
  });
  view.querySelectorAll("[data-day]").forEach(b=>b.onclick=async()=>{selectedDay=b.dataset.day;await load();render("day");});
  view.querySelectorAll("[data-month]").forEach(b=>b.onclick=async()=>{monthKey=b.dataset.month;await load();render("month");});
}
function activeView(){return document.querySelector("[data-report-view].active")?.dataset.reportView||"period";}

function renderPeriod(){
  const a=range(28), totalTime=a.reduce((s,x)=>s+x.seconds,0), active=a.filter(x=>x.seconds>0).length, avg=active?totalTime/active:0;
  const n=names(), by={};
  a.forEach(x=>Object.entries(days[x.key]?.totals||{}).forEach(([id,v])=>by[id]=(by[id]||0)+Number(v||0)));
  const d=days[today()]; if(d?.active?.subjectId)by[d.active.subjectId]=(by[d.active.subjectId]||0)+elapsed(d.active);
  const entries=Object.entries(by).filter(([id,v])=>n[id]&&v>0).sort((x,y)=>y[1]-x[1]), max=Math.max(1,...a.map(x=>x.seconds));
  const colors=["#e67e22","#4db6ac","#8e6ac8","#2f6fed"];
  let cumulative=0, stops=entries.slice(0,4).map(([id,v],i)=>{const st=totalTime?cumulative/totalTime*100:0;cumulative+=v;return colors[i]+" "+st+"% "+(totalTime?cumulative/totalTime*100:0)+"%";}).join(", ");
  view.innerHTML=nav(label(periodEnd,{day:"numeric",month:"short",year:"numeric"})+" · Last 28 days","period-prev","period-next",periodEnd>=today())+
  '<div class="report-summary-grid"><div><span>Total time</span><strong>'+fmt(totalTime)+'</strong></div><div><span>Daily average</span><strong>'+short(avg)+'</strong></div></div>'+
  '<div class="sample-calendar"><div class="calendar-title">Last 28 days <small>'+label(a[0].key)+' ~ '+label(a[27].key)+'</small></div><div class="calendar-days">'+a.map(x=>'<button type="button" class="'+(x.seconds?"study ":"")+(x.key===today()?"today":"")+'" data-day="'+x.key+'">'+date(x.key).getUTCDate()+'</button>').join("")+'</div><div class="calendar-foot">Active days '+active+' · Total '+short(totalTime)+'</div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>Subject ratio</strong><span>Actual study time</span></div></div><div class="donut-row"><div class="donut" style="background:conic-gradient('+(stops||"#e8ecf2 0 100%")+')"></div><div class="donut-legend">'+(entries.length?entries.slice(0,6).map(([id,v],i)=>'<div><i class="'+["orange","teal","purple","blue"][i%4]+'"></i><span>'+n[id]+'</span><b>'+short(v)+' · '+Math.round(v/totalTime*100)+'%</b></div>').join(""):'<div class="empty-timeline">No study activity yet.</div>')+'</div></div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>Study time per day</strong><span>Daily maximum: '+short(Math.max(...a.map(x=>x.seconds),0))+'</span></div></div><div class="stats-bar-chart">'+a.map(x=>'<button type="button" class="stats-day-bar" data-day="'+x.key+'" title="'+label(x.key,{dateStyle:"full"})+' — '+short(x.seconds)+'"><span style="height:'+Math.max(3,x.seconds/max*100)+'%"></span><small>'+date(x.key).getUTCDate()+'</small></button>').join("")+'</div></div>';
  bind();
}

function monthCalendar(k){
  const first=k.slice(0,8)+"01", w=date(first).getUTCDay(), off=w===0?6:w-1; return add(first,-off);
}
function renderDay(){
  const d=days[selectedDay]||{}, n=names(), sessions=d.sessions||[], keys=Array.from({length:42},(_,i)=>add(monthCalendar(selectedDay),i));
  view.innerHTML=nav(label(selectedDay,{weekday:"short",day:"numeric",month:"short",year:"numeric"}),"day-prev","day-next",selectedDay>=today())+
  '<div class="day-calendar"><div class="day-week">'+["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=>'<span>'+x+'</span>').join("")+'</div><div class="day-grid">'+keys.map(k=>'<button type="button" class="'+(k===selectedDay?"selected ":"")+(k.slice(0,7)!==selectedDay.slice(0,7)?"muted-day":"")+'" data-day="'+k+'">'+date(k).getUTCDate()+(total(days[k])?'<small>'+short(total(days[k]))+'</small>':'')+'</button>').join("")+'</div></div>'+
  '<div class="report-summary-grid"><div><span>Total time</span><strong>'+fmt(total(d))+'</strong></div><div><span>Sessions</span><strong>'+(sessions.length+(d.active?1:0))+'</strong></div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>Study timeline</strong><span>'+label(selectedDay,{dateStyle:"full"})+'</span></div></div><div class="timeline-list">'+(sessions.length?sessions.map(x=>'<div class="timeline-row"><span class="timeline-dot"></span><span><strong>'+(n[x.subjectId]||x.subjectId)+'</strong><small>'+new Date(x.start).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+' – '+new Date(x.end).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+'</small></span><b>'+fmt(x.duration)+'</b></div>').join(""):'<div class="empty-timeline">No completed study session recorded for this date.</div>')+(d.active?'<div class="timeline-row active-session"><span class="timeline-dot"></span><span><strong>'+(n[d.active.subjectId]||d.active.subjectId)+'</strong><small>Currently running</small></span><b>'+fmt(elapsed(d.active))+'</b></div>':'')+'</div></div>';
  bind();
}

function renderWeek(){
  const keys=Array.from({length:7},(_,i)=>add(weekStart,i)), vals=keys.map(k=>total(days[k])), sum=vals.reduce((a,b)=>a+b,0), active=vals.filter(Boolean).length, avg=active?sum/active:0, max=Math.max(1,...vals);
  view.innerHTML=nav(label(keys[0])+" – "+label(keys[6],{day:"numeric",month:"short",year:"numeric"}),"week-prev","week-next",keys[6]>=today())+
  '<div class="report-summary-grid"><div><span>Total time</span><strong>'+fmt(sum)+'</strong></div><div><span>Daily average</span><strong>'+short(avg)+'</strong></div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>Weekly study progress</strong><span>'+active+' active days</span></div><b>'+short(sum)+'</b></div><div class="week-bars">'+keys.map((k,i)=>'<button type="button" class="week-bar-item" data-day="'+k+'"><span style="height:'+Math.max(4,vals[i]/max*100)+'%"></span><small>'+label(k,{weekday:"short"})+'</small><b>'+short(vals[i])+'</b></button>').join("")+'</div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>Consistency</strong><span>Days with recorded study time</span></div></div><div class="consistency-row">'+keys.map(k=>'<button type="button" class="'+(total(days[k])?"filled":"")+'" data-day="'+k+'">'+date(k).getUTCDate()+'</button>').join("")+'</div></div>';
  bind();
}

function renderMonth(){
  const y=Number(monthKey.slice(0,4)), m=Number(monthKey.slice(5,7)), count=new Date(Date.UTC(y,m,0)).getUTCDate(), keys=Array.from({length:count},(_,i)=>monthKey+"-"+String(i+1).padStart(2,"0")), vals=keys.map(k=>total(days[k])), sum=vals.reduce((a,b)=>a+b,0), active=vals.filter(Boolean).length, avg=active?sum/active:0, max=Math.max(1,...vals), current=today().slice(0,7);
  const months=Array.from({length:12},(_,i)=>String(y)+"-"+String(i+1).padStart(2,"0"));
  view.innerHTML=nav(String(y),"month-prev","month-next",monthKey>=current)+
  '<div class="month-grid">'+months.map(k=>{const t=Object.entries(days).filter(([d])=>d.startsWith(k)).reduce((s,[,v])=>s+total(v),0);return '<button type="button" class="'+(k===monthKey?"selected ":"")+(t?"active":"")+'" data-month="'+k+'">'+label(k+"-01",{month:"short"})+(t?'<strong>'+short(t)+'</strong>':'')+'</button>';}).join("")+'</div>'+
  '<div class="report-summary-grid"><div><span>Total time</span><strong>'+fmt(sum)+'</strong></div><div><span>Daily average</span><strong>'+short(avg)+'</strong></div></div>'+
  '<div class="report-card"><div class="report-card-head"><div><strong>'+label(monthKey+"-01",{month:"long",year:"numeric"})+'</strong><span>'+active+' active days</span></div><b>'+short(sum)+'</b></div><div class="month-day-chart">'+keys.map((k,i)=>'<button type="button" class="month-day-bar" data-day="'+k+'" title="'+label(k,{dateStyle:"full"})+' — '+short(vals[i])+'"><span style="height:'+Math.max(2,vals[i]/max*100)+'%"></span><small>'+date(k).getUTCDate()+'</small></button>').join("")+'</div></div>';
  bind();
}

function renderTrend(){
  const a=range(14), max=Math.max(1,...a.map(x=>x.seconds)), last7=a.slice(7).reduce((s,x)=>s+x.seconds,0), prev7=a.slice(0,7).reduce((s,x)=>s+x.seconds,0);
  view.innerHTML='<div class="trend-filters"><button class="active" type="button">Daily</button><button type="button">Weekly</button><button type="button">Monthly</button></div><div class="report-card"><div class="report-card-head"><div><strong>14-day study trend</strong><span>Actual study time</span></div></div><div class="trend-bars">'+a.map(x=>'<button type="button" data-day="'+x.key+'" title="'+label(x.key,{dateStyle:"full"})+' — '+short(x.seconds)+'"><span style="height:'+Math.max(3,x.seconds/max*100)+'%"></span><small>'+date(x.key).getUTCDate()+'</small></button>').join("")+'</div></div><div class="report-summary-grid"><div><span>Last 7 days</span><strong>'+short(last7)+'</strong></div><div><span>Previous 7 days</span><strong>'+short(prev7)+'</strong></div></div><div class="report-card"><div class="report-card-head"><div><strong>Consistency</strong><span>Days with recorded study time</span></div></div><div class="empty-timeline">'+a.filter(x=>x.seconds>0).length+' of 14 days have recorded study activity.</div></div>';
  bind();
}

function render(v="period"){
  if(!view)return;
  if(!user){view.innerHTML='<div class="empty-timeline">Login to see your personal study statistics.</div>';return;}
  if(v==="period")renderPeriod();else if(v==="day")renderDay();else if(v==="week")renderWeek();else if(v==="month")renderMonth();else renderTrend();
}
tabs.forEach(t=>t.onclick=async()=>{tabs.forEach(x=>x.classList.toggle("active",x===t));await load();render(t.dataset.reportView);});
onAuthStateChanged(auth,async u=>{user=u;await load();render(activeView());});
setInterval(async()=>{if(user){await load();render(activeView());}},5000);
render();
