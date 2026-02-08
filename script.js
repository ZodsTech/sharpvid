import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBTe3bffXQ_NAycpfFRaSGW_bUnJRPtITU",
  authDomain: "sharpvid-af7ed.firebaseapp.com",
  projectId: "sharpvid-af7ed",
  storageBucket: "sharpvid-af7ed.appspot.com",
  messagingSenderId: "824081831427",
  appId: "1:824081831427:web:01b948989c85be5027e036"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

// 🔍 DEBUG CONFIRMATION
console.log("✅ script.js loaded");

// REGISTER
registerBtn.addEventListener("click", async () => {
  console.log("👉 Register clicked");

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );
    message.textContent = "✅ Registered successfully!";
    console.log("User:", userCredential.user);
  } catch (error) {
    message.textContent = "❌ " + error.message;
    console.error(error);
  }
});

// LOGIN
loginBtn.addEventListener("click", async () => {
  console.log("👉 Login clicked");

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );
    message.textContent = "✅ Login successful!";
    console.log("User:", userCredential.user);

    // 🚀 REDIRECT
    window.location.href = "dashboard.html";

  } catch (error) {
    message.textContent = "❌ " + error.message;
    console.error(error);
  }
});