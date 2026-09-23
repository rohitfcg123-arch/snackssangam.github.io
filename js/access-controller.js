/* CMA Portal Central Access Controller */
(function(){'use strict';
const ADMIN_EMAIL='rohit.fcg123@gmail.com';
const DEFAULTS={freeAccessMode:'attemptLimit',freeQuestionLimit:20,freeAttemptLimit:5,freeTestMinutes:60,freeQuestionMinutes:0,siteWideFree:false,freeFeatures:{mcqBank:true,pyq:false,reattemptWrong:false,bookmark:true,chapterTopic:true,answerReveal:true,overallTimer:true,questionTimer:false}};
const norm=v=>String(v||'').trim().toLowerCase();
const merge=(a,b)=>Object.assign({},a||{},b||{});
async function getSettings(){if(!window.db||!db.collection)return DEFAULTS;const s=await db.collection('settings').doc('access').get();return s.exists?merge(DEFAULTS,s.data()):DEFAULTS;}
async function getUserAccess(user){if(!user||!user.email)return{allowed:false,reason:'Please sign in with Google.'};const email=norm(user.email);const settings=await getSettings();if(email===ADMIN_EMAIL)return{allowed:true,admin:true,paid:true,settings,overrides:{}};let data={};if(window.db&&db.collection){const s=await db.collection('access').doc(email).get();if(s.exists)data=s.data()||{};}if(String(data.status||'active').toLowerCase()==='inactive')return{allowed:false,reason:'Your account is currently inactive.',data,settings,overrides:data.overrides||{}};const expiry=String(data.expiryDate||'');const expired=!!expiry&&expiry<new Date().toISOString().slice(0,10);const groups=Array.isArray(data.groups)?data.groups:[];return{allowed:true,paid:groups.length>0&&!expired,expired,data,settings,overrides:data.overrides||{}};}
function featureAllowed(a,f,fb){if(!a)return fb!==false;if(a.admin||a.paid)return true;const o=a.overrides||{},g=a.settings&&a.settings.freeFeatures;if(Object.prototype.hasOwnProperty.call(o,f))return o[f]!==false;if(g&&Object.prototype.hasOwnProperty.call(g,f))return g[f]!==false;return fb!==false;}
function questionLimit(a){if(!a||a.admin||a.paid)return Infinity;const o=a.overrides||{};return Number(o.freeQuestionLimit??a.settings?.freeQuestionLimit??DEFAULTS.freeQuestionLimit);}
function showPopup(m){if(typeof window.cmaShowAccessPopup==='function')return window.cmaShowAccessPopup(m);alert(m||'This feature requires premium access.');}
window.CMAAccessController={getSettings,getUserAccess,featureAllowed,questionLimit,showPopup,canUse:async function(f,fb){const a=await getUserAccess(window.auth&&auth.currentUser);if(!a.allowed){showPopup(a.reason);return false;}if(!featureAllowed(a,f,fb)){showPopup('This feature is not available for your current access plan.');return false;}return true;}};
window.dispatchEvent(new CustomEvent('cma-access-controller-ready'));
})();
