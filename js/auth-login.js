/*
FILE: js/auth-login.js
REFERENCE: FIREBASE-AUTH-V3
PURPOSE: Email/password and Google authentication for CMA Zone.
EDITABLE AREAS: Successful-login redirect and UI messages.
DEPENDENCIES: js/firebase.js, pages/signin.html.
IMPORTANT NOTES: Google uses popup authentication to avoid redirect-storage issues on GitHub Pages/Chrome.
LAST UPDATED: 2026-10-05
*/

import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");
const message = document.getElementById("authMessage");

function showMessage(text, type = "") {
  if (!message) return;
  message.textContent = text;
  message.className = "auth-message" + (type ? " " + type : "");
}

function firebaseMessage(error) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account exists with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication. Add rohitfcg123-arch.github.io in Firebase Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication. Enable Google under Authentication → Sign-in method.",
    "auth/network-request-failed": "Network request failed. Check your internet connection.",
    "auth/popup-blocked": "Google sign-in popup was blocked. Allow popups for this site and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled. Please try again.",
    "auth/internal-error": "Firebase could not complete Google sign-in. Please try again.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method."
  };
  return map[error.code] || ("Firebase error: " + (error.code || "unknown") + " — " + (error.message || "Please try again."));
}

function goHome() {
  showMessage("Login successful. Opening CMA Zone…", "success");
  const homeUrl = new URL("../index.html", window.location.href).href;
  window.location.replace(homeUrl);
}

function setMode(mode) {
  const register = mode === "register";
  loginPanel.classList.toggle("hidden", register);
  registerPanel.classList.toggle("hidden", !register);
  showMessage("");
}

document.getElementById("showRegister")?.addEventListener("click", () => setMode("register"));

document.getElementById("googleLogin")?.addEventListener("click", async () => {
  showMessage("Opening Google sign-in…");
  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithRedirect(auth, provider);
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

// When Google redirects back to this page, Firebase completes the sign-in here.
// This is more reliable on Android/Chrome than a popup flow.
(async function finishGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      showMessage("Login successful. Opening CMA Zone…", "success");
      await new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, user => {
          if (user) { unsubscribe(); resolve(user); }
        });
        setTimeout(() => { unsubscribe(); reject(new Error("Firebase authentication session timed out.")); }, 8000);
      });
      goHome();
    }
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
})();

document.getElementById("showLogin")?.addEventListener("click", () => setMode("login"));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage("Signing in…");

  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, user => { if (user) { unsubscribe(); resolve(); } });
      setTimeout(() => { unsubscribe(); resolve(); }, 5000);
    });
    goHome();
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;

  if (password !== confirm) {
    showMessage("Passwords do not match.", "error");
    return;
  }

  showMessage("Creating your account…");

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    goHome();
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

document.getElementById("forgotPassword")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showMessage("Enter your email first, then tap Forgot password.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

// Do not redirect merely because a session already exists.
onAuthStateChanged(auth, () => {});
