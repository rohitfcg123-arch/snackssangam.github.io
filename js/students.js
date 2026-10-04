import {auth,db} from "./firebase.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const esc=s=>String(s??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CONFIG_DOC="config";
let currentUser=null,profile={};

function profileRef(){return doc(db,"users",currentUser.uid,"profile","details")}
function courseRef(){return doc(db,"users",currentUser.uid,"studyDays",CONFIG_DOC)}
function item(label,value){return '<div class="detail-item"><small>'+esc(label)+'</small><strong>'+esc(value||"Not set")+'</strong></div>'}

async function loadData(user){
 currentUser=user;
 let course={};
 try{const s=await getDoc(courseRef());if(s.exists())course=s.data()}catch(e){console.error("Course details read:",e)}
 try{const s=await getDoc(profileRef());if(s.exists())profile=s.data();else profile={}}catch(e){console.error("Profile read:",e)}
 const name=profile.name||user.displayName||user.email?.split("@")[0]||"Student";
 $("currentName").textContent=name;
 $("currentDetails").innerHTML=[item("Name",name),item("Email",profile.email||user.email),item("Mobile",profile.phone),item("Date of Birth",profile.dob)].join("");
 const hasCourse=!!(course.courseLevel||course.group||course.attemptName);
 if(hasCourse){
  $("courseDetails").innerHTML=[item("Course",course.courseLevel),item("Group",course.group),item("Elective",course.elective),item("Attempt",course.attemptName),item("Exam Date",course.attemptDate)].join("");
  $("courseHint").textContent="These academic details are linked to your Course Details section.";
  $("courseLink").classList.add("hidden");
 }else{
  $("courseDetails").innerHTML='<div class="empty-state">Course details have not been completed yet.</div>';
  $("courseHint").textContent="Complete Course Details first. Your course, group and attempt will appear here automatically.";
  $("courseLink").classList.remove("hidden");
 }
 $("studentName").value=name;$("studentEmail").value=user.email||"";$("studentPhone").value=profile.phone||"";$("studentDob").value=profile.dob||"";
}
$("editDetailsBtn").onclick=()=>{$("studentMessage").textContent="";$("studentModal").classList.remove("hidden")};
$("closeStudentModal").onclick=()=>$("studentModal").classList.add("hidden");
$("studentForm").onsubmit=async e=>{e.preventDefault();const msg=$("studentMessage");msg.textContent="Saving…";try{await setDoc(profileRef(),{name:$("studentName").value.trim(),email:currentUser.email||"",phone:$("studentPhone").value.trim(),dob:$("studentDob").value||"",updatedAt:serverTimestamp()},{merge:true});msg.textContent="Saved successfully.";await loadData(currentUser);setTimeout(()=>$("studentModal").classList.add("hidden"),500)}catch(err){console.error(err);msg.textContent="Could not save: "+(err.code||err.message||"Unknown error")}};
onAuthStateChanged(auth,async user=>{if(!user){window.location.href="./signin.html";return}await loadData(user)});
