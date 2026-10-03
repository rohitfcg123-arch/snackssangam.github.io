/*
FILE: js/auth-login.js
REFERENCE: FIREBASE-AUTH-V1
PURPOSE: Email/password login and account creation for CMA Zone.
EDITABLE AREAS: Successful-login redirect and UI messages.
DEPENDENCIES: js/firebase.js, pages/signin.html.
IMPORTANT NOTES: Successful authentication redirects to the site root using an absolute URL derived from the current page, avoiding relative-path/cache issues.
LAST UPDATED: 2026-10-04
*/

import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect
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
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in this Firebase project.",
    "auth/network-request-failed": "Network request failed. Check your internet connection."
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
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

document.getElementById("showLogin")?.addEventListener("click", () => setMode("login"));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage("Signing in…");

  try {
    await signInWithEmailAndPassword(auth, email, password);
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
