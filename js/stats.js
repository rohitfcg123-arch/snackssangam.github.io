/*
FILE: js/stats.js
REFERENCE: CMA-ZONE-STUDY-STATS-V4
PURPOSE: Live student study dashboard with period, day, week, month and trend views.
EDITABLE AREAS: Dashboard calculations, navigation and chart presentation.
DEPENDENCIES: index.html, css/home.css, js/firebase.js, js/academic.js.
IMPORTANT NOTES: Study data comes from Cloud Firestore. Date keys match js/study.js.
LAST UPDATED: 2026-10-05
*/

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const view = document.getElementById("reportView");
const tabs = document.querySelectorAll("[data-report-view]");
let user = null, days = {}, customSubjects = [];
let selectedDay = today(), weekStart = monday(today()), monthKey = today().slice(0,7), periodEnd = today();
let lastInteractionAt = 0;
const CUSTOM_CACHE_PREFIX = "cma_zone_custom_subjects_v1:";

function today(){
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,"0"), d=String(now.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
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

function getCachedCustomSubjects(){
  if(!user) return [];
  try{
    const raw=localStorage.getItem(CUSTOM_CACHE_PREFIX+user.uid);
    const items=JSON.parse(raw||"[]");
    return Array.isArray(items)
      ? items.filter(x=>Array.isArray(x)&&x.length>=2).map(x=>[String(x[0]),String(x[1])])
      : [];
  }catch{return [];}
}
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
  [...customSubjects,...getCachedCustomSubjects()].forEach(x=>out[x[0]]=x[1]);
  return out;
}

async function load(){
  if(!user){days={};customSubjects=[];return;}
  const cached=getCachedCustomSubjects();
  try{
    const snap=await getDocs(collection(db,"users",user.uid,"studyDays"));
    days={}; snap.forEach(x=>{if(x.id!=="__config__")days[x.id]=x.data();});
  }catch(e){console.error("Firestore studyDays read failed:",e);days={};}
  try{
    const c=await getDoc(doc(db,"users",user.uid,"studyDays","__config__"));
    const remote=c.exists()&&Array.isArray(c.data().customSubjects)
      ? c.data().customSubjects.filter(x=>Array.isArray(x)&&x.length>=2).map(x=>[String(x[0]),String(x[1])])
      : [];
    const merged=[...remote,...cached].filter((item,i,arr)=>arr.findIndex(x=>String(x[0])===String(item[0]))===i);
    customSubjects=merged;
  }catch(e){
    console.error("Firestore custom subject read failed:",e);
    customSubjects=cached;
  }
  if(customSubjects.length){
    try{localStorage.setItem(CUSTOM_CACHE_PREFIX+user.uid,JSON.stringify(customSubjects));}catch{}
  }
}

function safeJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}")}catch{return{}}}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function dashboardDates(){const all=[...Object.keys(days),today()];return [...new Set(all)].sort()}
function renderDashboard(){
  if(!user)return;
  const n=names(), ds=dashboardDates(), rows=ds.map(k=>({key:k,seconds:total(days[k])})), active=rows.filter(x=>x.seconds>0);
  const totalTime=active.reduce((s,x)=>s+x.seconds,0), avg=active.length?totalTime/active.length:0, best=active.slice().sort((a,b)=>b.seconds-a.seconds)[0];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set("totalTime",short(totalTime)||"0m");set("activeDays",active.length);set("dailyAverage",short(avg)||"0m");set("bestDay",best?short(best.seconds):"—");set("bestDayLabel",best?label(best.key):"No study yet");
  const st=safeJson("cma_zone_home_v1"), levelLabel=(typeof ACADEMIC!=="undefined"&&ACADEMIC[st.level])?ACADEMIC[st.level].label:(st.level||"");
  set("selectionBadge",st.level&&st.group?(levelLabel+" • "+(st.group==="both"?"Both Groups":String(st.group).toUpperCase())):"No selection saved");
  const count=safeJson("cma_zone_countdowns_v2"), attemptDate=count.attemptDate||st.attemptDate||"";
  set("attemptBadge",count.attemptName||st.attemptName||"Attempt not set");
  set("examCountdown",attemptDate?Math.max(0,Math.ceil((new Date(attemptDate+"T00:00:00").getTime()-Date.now())/86400000))+" days":"—");
  set("examLabel",attemptDate?(count.attemptName||st.attemptName||"Exam attempt")+" • "+attemptDate:"Set course/group on Home");
  set("revisionCountdown",count.revisionDate?Math.max(0,Math.ceil((new Date(count.revisionDate+"T00:00:00").getTime()-Date.now())/86400000))+" days":"—");
  set("revisionLabel",count.revisionDate?(count.revisionName||"Revision")+" • "+count.revisionDate:"No revision countdown set");
  const selectedIds=Object.keys(n), trackedIds=selectedIds.filter(id=>ds.some(k=>Number(days[k]?.totals?.[id]||0)>0));
  set("trackedPercent",(selectedIds.length?Math.round(trackedIds.length/selectedIds.length*100):0)+"%");set("trackedSubjects",trackedIds.length);set("selectedSubjects",selectedIds.length);set("customSubjects",customSubjects.length);
  const sessions=Object.values(days).reduce((s,d)=>s+(Array.isArray(d.sessions)?d.sessions.length:0),0);set("sessionCount",sessions);
  set("overviewText",selectedIds.length?(trackedIds.length+" of "+selectedIds.length+" selected subjects have recorded study time."):("No course/group selected. Your recorded study time is still shown above."));
  const ring=document.getElementById("overviewRing");if(ring)ring.style.setProperty("--progress",(selectedIds.length?trackedIds.length/selectedIds.length*360:0)+"deg");
  const by={};Object.values(days).forEach(d=>Object.entries(d.totals||{}).forEach(([id,v])=>by[id]=(by[id]||0)+Number(v||0)));
  if(days[today()]?.active?.subjectId)by[days[today()].active.subjectId]=(by[days[today()].active.subjectId]||0)+elapsed(days[today()].active);
  const subjectEl=document.getElementById("subjectPerformance");
  if(subjectEl){const entries=Object.entries(n).map(([id,name])=>({id,name,seconds:by[id]||0})).sort((a,b)=>b.seconds-a.seconds),max=Math.max(1,...entries.map(x=>x.seconds));subjectEl.innerHTML=entries.length?entries.map(x=>'<div class="subject-row-stat"><div class="subject-row-name"><strong>'+escapeHtml(x.name)+'</strong><span>'+short(x.seconds)+'</span></div><div class="subject-track"><i style="width:'+Math.round(x.seconds/max*100)+'%"></i></div></div>').join(""):'<div class="empty-stat">No subjects available. Start a subject timer or add a custom subject.</div>'}
  const heat=document.getElementById("heatmap"),heatRows=Array.from({length:28},(_,i)=>{const k=add(today(),i-27);return{k,seconds:total(days[k])}});
  if(heat){const max=Math.max(1,...heatRows.map(x=>x.seconds));set("consistencyLabel",heatRows.filter(x=>x.seconds>0).length+" active days");heat.innerHTML=heatRows.map(x=>'<button type="button" title="'+label(x.k)+' • '+short(x.seconds)+'" class="heat-cell h'+Math.min(4,Math.ceil(x.seconds/max*4))+'"></button>').join("")}
  const ws=monday(today()),week=Array.from({length:7},(_,i)=>{const k=add(ws,i);return{k,seconds:total(days[k])}}),weekSum=week.reduce((s,x)=>s+x.seconds,0),weekActive=week.filter(x=>x.seconds>0).length,chartMax=Math.max(1,...week.map(x=>x.seconds));
  set("weekTotal",short(weekSum));set("weekHours",short(weekSum));set("weekDays",weekActive+"/7");set("weekPct",weekActive?Math.round(weekActive/7*100)+"%":"0%");
  const bar=document.getElementById("weekBar"),dayBar=document.getElementById("weekDayBar");if(bar)bar.style.width="100%";if(dayBar)dayBar.style.width=Math.round(weekActive/7*100)+"%";
  const weekly=document.getElementById("weeklyChart");if(weekly)weekly.innerHTML=week.map(x=>'<div class="chart-col"><span>'+short(x.seconds)+'</span><i style="height:'+Math.max(4,Math.round(x.seconds/chartMax*150))+'px"></i><small>'+date(x.key).toLocaleDateString("en-IN",{timeZone:"UTC",weekday:"short"})+'</small></div>').join("");
  const weak=document.getElementById("weakAreas");if(weak){const wr=Object.entries(n).map(([id,name])=>({name,seconds:by[id]||0})).sort((a,b)=>a.seconds-b.seconds).slice(0,5);weak.innerHTML=wr.length?wr.map(x=>'<div class="weak-row"><span>'+escapeHtml(x.name)+'</span><strong>'+short(x.seconds)+'</strong><small>'+(!x.seconds?"Not started":"Lowest tracked time")+'</small></div>').join(""):'<div class="empty-stat">No selected subjects yet.</div>'}
  const recent=document.getElementById("recentActivity");if(recent){const rr=[];Object.entries(days).forEach(([k,d])=>(d.sessions||[]).forEach(s=>rr.push({...s,date:k})));rr.sort((a,b)=>Number(b.end||0)-Number(a.end||0));recent.innerHTML=rr.slice(0,6).map(x=>'<div class="recent-row"><span class="recent-dot"></span><div><strong>'+escapeHtml(n[x.subjectId]||x.subjectId)+'</strong><small>'+label(x.date)+' • '+short(x.duration)+'</small></div><b>'+new Date(Number(x.end||0)).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+'</b></div>').join("")||'<div class="empty-stat">No completed sessions yet.</div>'}
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
tabs.forEach(t=>t.onclick=async()=>{
  lastInteractionAt=Date.now();
  tabs.forEach(x=>x.classList.toggle("active",x===t));
  await load();
  render(t.dataset.reportView);
});
onAuthStateChanged(auth,async u=>{
  user=u;
  await load();
  renderDashboard();
  render(activeView());
});
setInterval(async()=>{
  if(!user || document.visibilityState!=="visible") return;
  // Avoid replacing the whole statistics DOM while the student is actively interacting with it.
  if(Date.now()-lastInteractionAt<12000) return;
  await load();
  renderDashboard();
  const y=window.scrollY;
  render(activeView());
  requestAnimationFrame(()=>window.scrollTo(0,y));
},15000);
render();
