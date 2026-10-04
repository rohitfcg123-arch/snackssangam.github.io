import {auth,db} from "./firebase.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {collection,addDoc,getDocs,query,orderBy,serverTimestamp,doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function item(label,value){return '<div class="detail-item"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>'}
async function loadCurrent(user){
  $("currentName").textContent=user.displayName||user.email?.split("@")[0]||"Student";
  let profile={};
  try{const s=await getDoc(doc(db,"users",user.uid,"profile","details"));if(s.exists())profile=s.data()}catch(e){console.warn("Profile read:",e)}
  $("currentDetails").innerHTML=[
    item("Name",profile.name||user.displayName||"Not set"),
    item("Email",profile.email||user.email||"Not available"),
    item("Phone",profile.phone||"Not added"),
    item("Course / Group",profile.course||profile.group||"Not added"),
    item("Attempt",profile.attempt||"Not added"),
    item("Firebase UID",user.uid)
  ].join("");
}
async function loadStudents(){
 try{
  const snap=await getDocs(query(collection(db,"students"),orderBy("createdAt","desc")));
  $("studentCount").textContent=snap.size;
  $("studentList").innerHTML=snap.empty?'<div class="empty-state">No students added yet.</div>':snap.docs.map(d=>{const x=d.data();return '<div class="student-row"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.email)+'</small></div><div><small>'+esc(x.course||"Course not set")+'</small><small>'+esc(x.attempt||"Attempt not set")+'</small></div></div>'}).join("");
 }catch(e){$("studentList").innerHTML='<div class="empty-state">Student directory could not be loaded. Firestore rules need access to the students collection.</div>';console.error(e)}
}
$("addStudentBtn").onclick=()=>{$("studentModal").classList.remove("hidden")};
$("closeStudentModal").onclick=()=>{$("studentModal").classList.add("hidden")};
$("studentForm").onsubmit=async e=>{e.preventDefault();const msg=$("studentMessage");msg.textContent="Saving…";try{await addDoc(collection(db,"students"),{name:$("studentName").value.trim(),email:$("studentEmail").value.trim(),phone:$("studentPhone").value.trim(),course:$("studentCourse").value.trim(),attempt:$("studentAttempt").value.trim(),createdAt:serverTimestamp(),createdBy:auth.currentUser?.uid||null});msg.textContent="Student added successfully.";e.target.reset();await loadStudents()}catch(err){msg.textContent="Could not save: "+(err.code||err.message);}};
onAuthStateChanged(auth,async user=>{if(!user){window.location.href="./signin.html";return}await loadCurrent(user);await loadStudents()});
