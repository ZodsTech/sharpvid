// index.js (SharpVid Login Controller)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ===============================
// 🔥 SharpVid Firebase Config
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyBTe3bffXQ_NAycpfFRaSGW_bUnJRPtITU",
  authDomain: "sharpvid-af7ed.firebaseapp.com",
  projectId: "sharpvid-af7ed",
  storageBucket: "sharpvid-af7ed.appspot.com",
  messagingSenderId: "824081831427",
  appId: "1:824081831427:web:01b948989c85be5027e036",
  databaseURL: "https://sharpvid-af7ed-default-rtdb.firebaseio.com"
};

// ===============================
// ✅ Initialize Firebase
// ===============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===============================
// ✅ AUTO LOGIN REDIRECT
// If user is already logged in,
// skip login page → go dashboard
// ===============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ User already logged in, redirecting...");
    window.location.href = "dashboard.html";
  }
});

// ===============================
// ✅ UI Elements
// ===============================
const email = document.getElementById("email");
const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

// ===============================
// ✨ SIGN UP
// ===============================
signupBtn.onclick = async () => {
  try {
    await createUserWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value.trim()
    );

    message.textContent = "✅ Account created successfully!";
    message.style.color = "lime";

    // Redirect
    window.location.href = "dashboard.html";

  } catch (err) {
    message.textContent = "❌ " + err.message;
    message.style.color = "red";
  }
};

// ===============================
// 🔑 LOGIN
// ===============================
loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value.trim()
    );

    message.textContent = "✅ Login successful!";
    message.style.color = "lime";

    // Redirect
    window.location.href = "dashboard.html";

  } catch (err) {
    message.textContent = "❌ " + err.message;
    message.style.color = "red";
  }
};

// 🔁 Forgot Password
const forgotLink = document.getElementById("forgotPasswordLink");

forgotLink?.addEventListener("click", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const email = emailInput?.value.trim();

  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("✅ Password reset email sent! Check your inbox.");
  } catch (error) {
    alert("❌ " + error.message);
  }
});

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");
const capsWarning = document.getElementById("capsWarning");

togglePassword?.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  passwordInput.classList.add("fade-switch");
  setTimeout(() => {
    passwordInput.classList.remove("fade-switch");
  }, 250);

  if (isHidden) {
    passwordInput.classList.add("password-visible");
  } else {
    passwordInput.classList.remove("password-visible");
  }
});

/* CAPS LOCK DETECTION */
passwordInput?.addEventListener("keyup", (e) => {
  const isCaps = e.getModifierState && e.getModifierState("CapsLock");
  if (isCaps) {
    capsWarning?.classList.remove("hidden");
  } else {
    capsWarning?.classList.add("hidden");
  }
});
