(function(){'use strict';
function ensure(){
  let b=document.getElementById('cmaAccessPopup');
  if(b)return b;
  b=document.createElement('div');
  b.id='cmaAccessPopup';
  b.style.cssText='display:none;position:fixed;inset:0;background:rgba(8,38,39,.62);backdrop-filter:blur(4px);z-index:99999;align-items:center;justify-content:center;padding:18px';
  b.innerHTML='<div style="width:min(430px,100%);background:#fffdf8;border-radius:18px;border:1px solid #e5dece;padding:25px;box-shadow:0 25px 70px rgba(0,0,0,.25);font-family:Inter,Segoe UI,Arial,sans-serif"><button id="cmaPopupClose" style="float:right;border:0;background:none;font-size:25px;cursor:pointer">×</button><div style="font-size:30px">🔒</div><h2 style="color:#082627;margin:10px 0 7px">Premium Access Required</h2><p id="cmaPremiumMessage" style="color:#5b6b69;font-size:14px;line-height:1.55"></p><div style="display:flex;gap:9px;margin-top:18px"><button id="cmaBuySubscription" style="flex:1;border:0;border-radius:10px;padding:12px;background:#c8a24a;color:#082627;font-weight:800;cursor:pointer">💳 Buy Premium</button><button id="cmaPopupContinue" style="flex:1;border:1px solid #e5dece;border-radius:10px;padding:12px;background:#fff;color:#0d3b3e;font-weight:700;cursor:pointer">Continue with Free</button></div></div>';
  document.body.appendChild(b);
  const close=()=>b.style.display='none';
  b.querySelector('#cmaPopupClose').onclick=close;
  b.querySelector('#cmaBuySubscription').onclick=()=>location.href='payment.html';
  b.querySelector('#cmaPopupContinue').onclick=()=>{
    const message=b.querySelector('#cmaPremiumMessage').textContent||'';
    close();
    continueFreeFromLimit(message);
  };
  b.onclick=e=>{if(e.target===b)close()};
  return b;
}
function continueFreeFromLimit(message){
  const m=message.match(/(?:allows only|allows up to|first)\s+(\d+)\s+questions/i);
  if(!m)return;
  const limit=Number(m[1]);
  if(!Number.isFinite(limit)||limit<=0)return;
  const ids=['count','questions','qCount','questionCount','maxQuestions'];
  let select=null;
  for(const id of ids){
    const el=document.getElementById(id);
    if(el&&el.tagName==='SELECT'){select=el;break}
  }
  if(!select)return;
  let option=[...select.options].find(o=>Number(o.value)===limit);
  if(!option){
    const usable=[...select.options].filter(o=>{const n=Number(o.value);return Number.isFinite(n)&&n>0&&n<=limit});
    if(usable.length)option=usable.reduce((a,o)=>Number(o.value)>Number(a.value)?o:a);
    else{
      option=document.createElement('option');
      option.value=String(limit);
      option.textContent=limit+' questions';
      select.appendChild(option);
    }
  }
  select.value=option.value;
  const startIds=['start','startBtn','startPractice'];
  let btn=null;
  for(const id of startIds){const el=document.getElementById(id);if(el){btn=el;break}}
  if(btn)btn.click();
}
window.cmaShowAccessPopup=function(message){
  const b=ensure();
  b.querySelector('#cmaPremiumMessage').textContent=message||'This feature requires premium access. Please buy a subscription to continue.';
  b.style.display='flex';
};
})();