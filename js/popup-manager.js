
(function(){
window.CMA_POPUP={
 openPremium:function(message){
   let b=document.getElementById("cmaPremiumModal");
   if(!b){b=document.createElement("div");b.id="cmaPremiumModal";b.className="modal-backdrop";b.innerHTML='<div class="modal"><h2>🔒 Free Practice Limit Reached</h2><p id="cmaPremiumMessage"></p><div class="modal-actions"><button class="btn gold" id="cmaBuyPremium">Buy Premium Plan</button><button class="btn" id="cmaContinueFree">Continue with Free Version</button></div></div>';document.body.appendChild(b);b.querySelector("#cmaBuyPremium").onclick=()=>location.href="payment.html";b.querySelector("#cmaContinueFree").onclick=()=>b.style.display="none"}
   b.querySelector("#cmaPremiumMessage").textContent=message||"Free practice limit reached. Please buy a Premium Plan.";b.style.display="flex";
 },
 close:function(){const b=document.getElementById("cmaPremiumModal");if(b)b.style.display="none"}
};
})();
