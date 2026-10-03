/*
FILE: js/auth.js
REFERENCE: FIREBASE-AUTH-V1
PURPOSE: Email/password login and account creation for CMA Zone.
EDITABLE AREAS: Redirect paths and UI messages.
DEPENDENCIES: js/firebase.js, pages/login.html.
IMPORTANT NOTES: Email/Password must be enabled in Firebase Authentication before login or registration can succeed.
LAST UPDATED: 2026-10-04
*/

import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
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
    "auth/too-many-requests": "Too many attempts. Please try again later."
  };
  return map[error.code] || "Authentication failed. Please try again.";
}

function setMode(mode) {
  const register = mode === "register";
  loginPanel.classList.toggle("hidden", register);
  registerPanel.classList.toggle("hidden", !register);
  showMessage("");
}

document.getElementById("showRegister")?.addEventListener("click", () => setMode("register"));
document.getElementById("showLogin")?.addEventListener("click", () => setMode("login"));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage("Signing in…");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "../index.html";
  } catch (error) {
    showMessage(firebaseMessage(error), "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;

  if (password !== confirm) {
    showMessage("Passwords do not match.", "error");
    return;
  }

  showMessage("Creating your account…");

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    window.location.href = "../index.html";
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

onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.endsWith("/login.html")) {
    window.location.href = "../index.html";
  }
});
