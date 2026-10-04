/*
FILE: js/community.js
REFERENCE: CMA-ZONE-COMMUNITY-V1
PURPOSE: Real-time authenticated CMA Zone community chat.
EDITABLE AREAS: Message limit and collection name.
DEPENDENCIES: firebase.js, Firebase Authentication and Cloud Firestore.
*/
import {auth,db} from "./firebase.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {collection,addDoc,deleteDoc,doc,query,orderBy,onSnapshot,serverTimestamp,limit} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const messagesRef=collection(db,"communityMessages");
const messagesQuery=query(messagesRef,orderBy("createdAt","asc"),limit(300));
let currentUser=null;
let unsubscribe=null;

function escapeText(v){return String(v??"");}
function formatTime(ts){if(!ts?.toDate)return "";return ts.toDate().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}
function renderMessages(items){
 const box=$("chatMessages"); if(!box)return;
 $("messageCount").textContent=items.length+" message"+(items.length===1?"":"s");
 if(!items.length){box.innerHTML='<div class="chat-empty">No messages yet. Start the conversation 👋</div>';return}
 box.innerHTML=items.map(m=>{
   const mine=currentUser&&m.uid===currentUser.uid;
   const name=escapeText(m.name||"CMA Student");
   const body=escapeText(m.message);
   return '<article class="chat-message '+(mine?"mine":"")+'"><div class="chat-author">'+name+(mine?" • You":"")+'</div><div class="chat-bubble">'+body.replace(/\n/g,"<br>")+'</div><div class="chat-time">'+formatTime(m.createdAt)+'</div></article>';
 }).join("");
 requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
}
function startListener(){
 if(unsubscribe)unsubscribe();
 $("chatMessages").innerHTML='<div class="chat-empty">Loading community messages…</div>';
 unsubscribe=onSnapshot(messagesQuery,s=>renderMessages(s.docs.map(d=>({id:d.id,...d.data()}))),e=>{
   console.error("Community listener:",e);
   $("chatMessages").innerHTML='<div class="chat-empty">Unable to load community messages. Please check Firestore Rules.</div>';
 });
}
async function sendMessage(e){
 e.preventDefault();
 const input=$("messageInput"),button=$("sendMessage");
 const text=input.value.trim();
 if(!currentUser){$("chatStatus").textContent="Please login to post in the CMA Community.";return}
 if(!text)return;
 button.disabled=true;
 try{
   await addDoc(messagesRef,{uid:currentUser.uid,name:currentUser.displayName||currentUser.email?.split("@")[0]||"CMA Student",message:text,createdAt:serverTimestamp()});
   input.value="";input.style.height="46px";$("chatStatus").textContent="Message sent ✓";
 }catch(err){
   console.error(err);
   $("chatStatus").textContent="Could not send: "+(err.code||"Firestore error");
 }finally{button.disabled=false;input.focus()}
}
$("chatForm")?.addEventListener("submit",sendMessage);
$("messageInput")?.addEventListener("input",e=>{e.target.style.height="46px";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"});
$("messageInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit()}});
onAuthStateChanged(auth,user=>{
 currentUser=user;
 $("onlineText").textContent=user?"Community • Logged in":"Community";
 $("chatStatus").textContent=user?"Only CMA-focused, respectful discussion please.":"Please login to post. You can read public messages.";
 $("messageInput").disabled=!user;$("sendMessage").disabled=!user;
 startListener();
});

$("communityLogout")?.addEventListener("click",async()=>{try{await signOut(auth);window.location.href="../pages/signin.html"}catch(e){console.error(e);alert("Logout failed: "+(e.code||e.message||"Unknown error"))}});
