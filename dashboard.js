// ==========================================
// 🎬 SHARPVID DASHBOARD CONTROLLER
// Clean Architecture Structure
// ==========================================

// ===============================
// 📦 IMPORTS
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, set, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ===============================
// 🔎 DOM HELPER
// ===============================
function byId(id){
  return document.getElementById(id);
}

// 🤖 AI SCRIPT MODAL HELPERS (WINDOW API)
window.openAiScriptModal = () =>
  byId("aiScriptModal")?.classList.remove("hidden");

window.closeAiScriptModal = () =>
  byId("aiScriptModal")?.classList.add("hidden");

// ===============================
// 🔥 FIREBASE INITIALIZATION
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ===============================
// 🧩 DOM ELEMENT REFERENCES
// ===============================

// Status
const usageStatus = byId("statusUsage");

// Script
const scriptInput = byId("scriptInput");
const generateBtn = byId("generateBtn");
const downloadBtn = byId("downloadBtn");

const BASE_URL = "https://super-duper-computing-machine-4jr7pg9p99r6c74qx-3000.app.github.dev";
// Audio
const audioPlayer = byId("audioPlayer");
const formatSelect = byId("formatSelect");
const captionMode = byId("captionMode");
const voiceSelect = byId("voiceSelect");

// Video
const generateVideoBtn = byId("generateVideoBtn");
const progressWrap = byId("renderProgressWrap");
const progressBar = byId("renderProgressBar");
const progressText = byId("renderProgressText");
const videoPlayer = byId("videoPlayer");
const downloadVideoBtn = byId("downloadVideoBtn");

// Subtitles
const downloadSubBtn = byId("downloadSubBtn");
const subtitleEditor = byId("subtitleEditor");
const loadSubsBtn = byId("loadSubsBtn");
const saveSubsBtn = byId("saveSubsBtn");
const subFontSize = byId("subFontSize");
const subMarginV = byId("subMarginV");
const subOutline = byId("subOutline");
const subAlign = byId("subAlign");
const subTheme = byId("subTheme");

// Side Menu
const sideMenu = byId("sideMenu");
const sideOverlay = byId("sideMenuOverlay");
const appMenuBtn = byId("appMenuBtn");
const closeSideMenu = byId("closeSideMenu");

// Publish
const publishBtn = byId("publishBtn");

// Account
const logoutBtn = byId("logoutBtn");

// Upload UI
const slideUpload = byId("slideUpload");
const uploadSlidesBtn = byId("uploadSlidesBtn");
const slidePreview = byId("slidePreview");
const musicUpload = byId("musicUpload");
const musicUploadBox = byId("musicUploadBox");

// Projects
const projectsList = byId("projectsList");

// Audio Ducking
const duckLevel = byId("duckLevel");

// Bundles
const bundleTikTok = byId("bundleTikTok");
const bundleYouTube = byId("bundleYouTube");
const bundleReels = byId("bundleReels");
const bundleClean = byId("bundleClean");

// Avatar
const avatarWrap = byId("avatarWrap");
const avatarInitials = byId("avatarInitials");
const avatarImage = byId("avatarImage");
const avatarInput = byId("avatarInput");
const avatarBubble = byId("avatarBubble");

// Queue
const addQueueBtn = byId("addQueueBtn");
const queueList = byId("queueList");

// Scene
const sceneTransition = byId("sceneTransition");

// Welcome
const welcomeBanner = byId("welcomeBanner");
const welcomeProjectText = byId("welcomeProjectText");

// FAB
const fabMain = byId("fabMain");
const fabMenu = byId("fabMenu");
const fabSlides = byId("fabSlides");
const fabVoice = byId("fabVoice");
const fabMusic = byId("fabMusic");

// 💰 STRIPE PRICING DOM ELEMENTS
const monthlyTab   = byId("monthlyTab");
const yearlyTab    = byId("yearlyTab");
const priceValue   = byId("priceValue");
const priceLabel   = byId("priceLabel");
const yearlyStrike = byId("yearlyStrike");

// 📂 New/Resume Project Buttons 
const resumeProjectBtn = byId("resumeProjectBtn");
const newProjectBtn = byId("newProjectBtn");
const projectHeader = byId("project-header");

// Manual Save Button
const manualSaveBtn = byId("manualSaveBtn");

// ===================
// 📓 NOTEBOOK DOM REFERENCES
// ===================

const notebookArea = byId("notebookArea");
const notebookPanel = byId("notebookPanel");
const notebookSaveBtn = byId("notebookSaveBtn");
const notebookCount = byId("notebookCount");

// ===============================
// 🧠 GLOBAL STATE
// ===============================
const DEV_MODE = false; // SharpVid dev switch

let userPlan = "free";
let isPremium = DEV_MODE ? true : false;
let isLoggingOut = false;

let bgMusicPath = null;
let musicSelected = false;
let currentProjectId = null;
let jobPoller = null;
let currentUid = null;
let renderInProgress = false;
let renderQueue = [];
let queueRunning = false;
let slideDurations = []; // seconds per slide
let currentSceneId = "s1";
let sceneDurations = {
  s1: 5,
  s2: 5,
  s3: 5
};
// ===============================
// 🕘 UNDO / REDO SYSTEM
// ===============================
let historyStack = [];
let redoStack = [];
let isRestoringState = false; // prevent infinite loop

// Auto Save Timer
let syncTimeout;
function scheduleSync() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncProjectState, 800);
}

let isProjectHeaderVisible = true;
let hasUnsavedChanges = false;
let saveReminderInterval = null;
let scrollTopTimeout = null;
let avatarMode = "initials"; // initials | image
// ------------------------------
// 📦 STATIC DATA (CONFIG)
// ------------------------------
const VOICES = [
  { id: "en-US-Standard-B", name: "US Standard B", premium: false },
  { id: "en-US-Standard-C", name: "US Standard C", premium: false },
  { id: "en-US-Wavenet-D", name: "US WaveNet D", premium: true },
  { id: "en-US-Wavenet-F", name: "US WaveNet F", premium: true }
];

// ===============================
// 🧮 PURE FUNCTIONS (NO DOM)
// ===============================
function showCoach(message, fixFn) {
  const box = byId("coachBox");
  const text = byId("coachText");
  const btn = byId("coachGoBtn");

  if (!box || !text || !btn) return;

  text.textContent = message;
  box.classList.remove("hidden");

  btn.onclick = () => {
    hideCoach();
    if (fixFn) fixFn();
  };
}

function hideCoach() {
  byId("coachBox")?.classList.add("hidden");
}

const SUBTITLE_THEMES = {
  tiktok: { fontSize: 48, marginV: 220, outline: 3, align: 2 },
  youtube: { fontSize: 42, marginV: 160, outline: 2, align: 2 },
  reels: { fontSize: 50, marginV: 200, outline: 4, align: 2 },
  minimal: { fontSize: 32, marginV: 140, outline: 1, align: 2 }
};

// 💾 SCRIPT AUTOSAVE KEY
const SCRIPT_KEY = "sharpvid_script_draft";

// Restore Script Draft
function restoreScriptDraft() {
  const savedDraft = localStorage.getItem(SCRIPT_KEY);
  if (savedDraft && scriptInput) {
    scriptInput.value = savedDraft;
  }
}

// Auto Save Script Draft
function startScriptAutosave() {
  setInterval(() => {
    if (!scriptInput) return;
    localStorage.setItem(SCRIPT_KEY, scriptInput.value);
  }, 3000);
}

// 💾 Save Timeline
function saveTimeline() {
  localStorage.setItem(
    "sharpvid_timeline_" + currentProjectId,
    JSON.stringify(slideDurations)
  );
}

// 📥 Load Timeline
function loadTimeline() {
  const raw = localStorage.getItem(
    "sharpvid_timeline_" + currentProjectId
  );
  if (raw) slideDurations = JSON.parse(raw);
}

// 🔄 Reorder Timeline Data
function reorderTimeline(from, to) {

  if (!slideDurations.length) return;

  const moved = slideDurations.splice(from, 1)[0];
  slideDurations.splice(to, 0, moved);

  saveTimeline();
}

// 🔁 Rebuild After Reorder
function rebuildAfterReorder() {
  buildTimelineEditor();
}

// --------------------------------
// 🧭 Get Slide Order Helper
// --------------------------------
function getSlideOrder() {

  return [...slidePreview.children].map(img => {

    const parts = img.src.split("/slides/");
    return parts[1]; // filename only

  });
}

function resizeAvatar(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 256, 256);

      canvas.toBlob(blob => {
        resolve(blob);
      }, "image/jpeg", 0.8);
    };

    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------
// 🔄 Reset App For New Project
// ---------------------------------
function resetAppForNewProject() {

  // 🧹 Clear saved project reference
  localStorage.removeItem("sharpvid_project");

  // 🧼 Reset UI
  slidePreview.innerHTML = "";
  audioPlayer.src = "";

  // 🧠 Reset in-memory state
  currentProjectId = null;
  slideDurations = [];
  sceneDurations = { s1:5, s2:5, s3:5 };

  updateStatusStrip();
  drawSceneTimeline();
}

// -----------------------------------------
// 🔁 Restore Last Project ID (Storage Only)
// -----------------------------------------
const savedProject =
  localStorage.getItem("sharpvid_project");

if (savedProject) {
  currentProjectId = savedProject;
}

// -------------------------------
// 📊 Load Usage Data
// -------------------------------
async function loadUsage() {

  if (!currentUid || !usageStatus)
    return;

  const r =
    await fetch(`/api/usage/${currentUid}`);

  const j = await r.json();

  usageStatus.textContent =
    `📊 Today: ${j.used} / ${j.limit} renders`;
}

// ===============================
// 📸 CREATE SNAPSHOT
// ===============================
function captureState() {

  if (!currentProjectId) return;

  const snapshot = {
    slideDurations: JSON.parse(JSON.stringify(slideDurations)),
    sceneDurations: JSON.parse(JSON.stringify(sceneDurations)),
    format: formatSelect?.value,
    captionMode: captionMode?.value,
    transition: sceneTransition?.value,
    subtitleStyle: {
      fontSize: subFontSize?.value,
      marginV: subMarginV?.value,
      outline: subOutline?.value,
      align: subAlign?.value
    },
    bgMusic: bgMusicPath,
    musicSelected
  };

  historyStack.push(snapshot);

  // Limit history to 50 steps
  if (historyStack.length > 50) {
    historyStack.shift();
  }

  // Clear redo when new action happens
  redoStack = [];
}

// ===============================
// ♻ RESTORE SNAPSHOT
// ===============================
function restoreState(snapshot) {

  if (!snapshot) return;

  isRestoringState = true;

  slideDurations = snapshot.slideDurations;
  sceneDurations = snapshot.sceneDurations;

  formatSelect.value = snapshot.format;
  captionMode.value = snapshot.captionMode;
  sceneTransition.value = snapshot.transition;

  subFontSize.value = snapshot.subtitleStyle.fontSize;
  subMarginV.value = snapshot.subtitleStyle.marginV;
  subOutline.value = snapshot.subtitleStyle.outline;
  subAlign.value = snapshot.subtitleStyle.align;

  bgMusicPath = snapshot.bgMusic;
  musicSelected = snapshot.musicSelected;

  buildTimelineEditor();
  updateSlideTotals();
  drawSceneTimeline();
  updateStatusStrip();

  isRestoringState = false;
}

// ------------------------------------
// 🎬 BUILD VIDEO PAYLOAD (QUEUE SAFE)
// ------------------------------------
function buildVideoPayload() {

  return {
    format: formatSelect.value,
    mode: captionMode.value,
    scriptText: scriptInput.value,
    bgMusic: bgMusicPath,
    projectId: currentProjectId,
    plan: userPlan,
    uid: currentUid,
    sceneId: currentSceneId,
    duck: duckLevel.value,
    slideOrder: getSlideOrder(),
    subtitleStyle: {
      fontSize: subFontSize.value,
      marginV: subMarginV.value,
      outline: subOutline.value,
      align: subAlign.value,
      slideDurations: slideDurations,
      sceneDurations: sceneDurations,
    }
  };

}

// ----------------------------
// 📦 BUILD PAYLOAD VARIANT
// ----------------------------
function buildPayloadVariant(format, mode) {

  return {
    format,
    mode,
    scriptText: scriptInput.value,
    bgMusic: bgMusicPath,
    projectId: currentProjectId,
    plan: userPlan,
    uid: currentUid,
    duck: duckLevel.value,
    slideOrder: getSlideOrder(),
    subtitleStyle: {
      fontSize: subFontSize.value,
      marginV: subMarginV.value,
      outline: subOutline.value,
      align: subAlign.value,
      slideDurations: slideDurations
    }
  };

}

// ----------------------------
// ⚡ EXPORT PRESETS ENGINE
// ----------------------------
function applyQuickPreset(type){

  if(type === "tiktok"){
    formatSelect.value = "vertical";
    captionMode.value = "burn";
    subFontSize.value = 42;
    subMarginV.value = 220;
    subOutline.value = 2;
    subAlign.value = 2;
  }

  if(type === "reels"){
    formatSelect.value = "vertical";
    captionMode.value = "burn";
    subFontSize.value = 38;
    subMarginV.value = 200;
    subOutline.value = 2;
    subAlign.value = 2;
  }

  if(type === "youtube"){
    formatSelect.value = "landscape";
    captionMode.value = "srt";
    subFontSize.value = 40;
    subMarginV.value = 140;
    subOutline.value = 2;
    subAlign.value = 2;
  }

  if(type === "hd"){
    formatSelect.value = "landscape";
    captionMode.value = "burn";
    subFontSize.value = 44;
    subMarginV.value = 160;
    subOutline.value = 3;
    subAlign.value = 2;
  }

  alert("Preset applied ✅");

}

window.applyQuickPreset = applyQuickPreset;

// ------------------------------
// 🎉 CONFETTI LAUNCHER
// ------------------------------
function launchConfetti() {
  confetti({
    particleCount: 150,
    spread: 90,
    origin: { y: 0.6 }
  });
}

// 📏 HEADER HEIGHT CALCULATOR
function updateHeaderHeight() {
  const headerStack = document.querySelector(".header-stack");
  if (!headerStack) return;

  const height = headerStack.offsetHeight;

  document.documentElement
    .style.setProperty("--header-height", height + "px");
}

// ===================================
// ✏️ MARK PROJECT AS DIRTY
// ===================================
function markUnsaved() {
  hasUnsavedChanges = true;

  if (!manualSaveBtn) return;

  manualSaveBtn.classList.add("unsaved-glow");
}

// ===================================
// ✅ MARK PROJECT AS SAVED
// ===================================
function markSaved() {
  hasUnsavedChanges = false;

  manualSaveBtn?.classList.remove("unsaved-glow");
}

// ======================================
//   🧮 PURE FUNCTIONS (ASYNC ENGINE)
//=======================================

// 🔁 RUN NEXT JOB IN QUEUE
async function runNextInQueue() {
  
  // ✅ MUST BE INSIDE FUNCTION
  if (queueRunning) return;
  
  if (!renderQueue.length) {
    queueRunning = false;
    return;
  }
  
  queueRunning = true;
  
  const job = renderQueue[0];
  
  try {
    
    progressBar.style.width = "0%";
    progressText.textContent = "Queued…";
    
    startJobMonitor(job.projectId);
    
    const res = await fetch("/api/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job)
    });
    
    const data = await res.json();
    
    if (data.success) {
      
      videoPlayer.src = data.file + "?t=" + Date.now();
      downloadVideoBtn.disabled = false;
      
    } else {
      
      console.warn("Queue render failed:", data.error);
      
    }
    
  } catch (err) {
    
    console.error("Queue crash:", err);
    
  }
  
  renderQueue.shift();
  
  drawQueue();
  
  renderInProgress = false;
  generateVideoBtn.disabled = false;
  
  runNextInQueue();
  
  if (typeof updateStatusStrip === "function") {
    updateStatusStrip();
  }
  
}

function startSaveReminder() {

  clearInterval(saveReminderInterval);

  saveReminderInterval = setInterval(() => {

    if (hasUnsavedChanges) {
      manualSaveBtn?.classList.add("unsaved-glow");

      setTimeout(() => {
        if (!hasUnsavedChanges)
          manualSaveBtn?.classList.remove("unsaved-glow");
      }, 2000);
    }

  }, 300000); // 5 minutes
}

// ===============================
// 🔄 AUTO PROJECT SYNC ENGINE
// ===============================
async function syncProjectState() {

  if (!currentUid || !currentProjectId) return;

  const state = {
    slideDurations,
    sceneDurations,
    format: formatSelect?.value,
    captionMode: captionMode?.value,
    transition: sceneTransition?.value,
    subtitleStyle: {
      fontSize: subFontSize?.value,
      marginV: subMarginV?.value,
      outline: subOutline?.value,
      align: subAlign?.value
    },
    bgMusic: bgMusicPath,
    musicSelected
  };

  try {

    await fetch("/api/project-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: currentUid,
        projectId: currentProjectId,
        state
      })
    });

  } catch (err) {

    console.warn("Auto sync failed:", err);

  }
}

// ===============================
// 🏗 UI BUILDERS (DOM RENDERERS)
// ===============================
function updatePremiumShowcase() {

  const showcase = byId("premiumShowcase");
  if (!showcase) return;

  if (!isPremium) {

    showcase.classList.remove("hidden");

    requestAnimationFrame(() => {
      showcase.classList.add("show");
    });

  } else {

    showcase.classList.remove("show");
    showcase.classList.add("hidden");

  }
}

// ===============================
// 💎 PREMIUM MODAL CONTROLS
// ===============================
function openUpgradeModal() {
  byId("upgradeModal")
    ?.classList.remove("hidden");
}

function closeUpgradeModal() {
  byId("upgradeModal")
    ?.classList.add("hidden");
}

function buildVoiceSelect() {

  if (!voiceSelect) return;

  voiceSelect.innerHTML = "";

  const freeGroup = document.createElement("optgroup");
  freeGroup.label = "🆓 Free Voices";

  const premiumGroup = document.createElement("optgroup");
  premiumGroup.label = "💎 Premium Voices";

  VOICES.forEach(v => {

    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name + (v.premium ? " 🔒" : "");

    if (v.premium && !isPremium) {
      opt.disabled = true;
    }

    if (v.premium) {
      premiumGroup.appendChild(opt);
    } else {
      freeGroup.appendChild(opt);
    }

  });

  voiceSelect.appendChild(freeGroup);
  voiceSelect.appendChild(premiumGroup);
}

// -------------------------------------
// 🎞 Build Slide Timeline Editor (PRO)
// -------------------------------------
function buildTimelineEditor() {

  const editor = byId("timelineEditor");
  if (!editor) return;

  editor.innerHTML = "";

  const slides = slidePreview?.children;
  if (!slides || !slides.length) return;

  let totalDuration = 0;

  Array.from(slides).forEach((img, index) => {

    const wrap = document.createElement("div");
    wrap.className = "slide-row";

    // default duration
    if (!slideDurations[index])
      slideDurations[index] = 3;

    totalDuration += slideDurations[index];

    // Thumbnail
    const thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.className = "timeline-thumb";

    // Slider
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 1;
    slider.max = 15;
    slider.value = slideDurations[index];
    slider.className = "timeline-slider";

    // Seconds label
    const secLabel = document.createElement("span");
    secLabel.className = "timeline-seconds";
    secLabel.textContent = slideDurations[index] + "s";

    slider.addEventListener("input", () => {

      if (!isRestoringState) captureState();
      markUnsaved();
slideDurations[index] = parseInt(slider.value);
      secLabel.textContent = slider.value + "s";

      updateSlideTotals();
      drawSceneTimeline(); // auto sync

    });

    wrap.appendChild(thumb);
    wrap.appendChild(slider);
    wrap.appendChild(secLabel);

    editor.appendChild(wrap);

  });

  updateSlideTotals();
}

function updateSlideTotals() {

  const totalBoxId = "slideTotalDuration";
  let totalEl = byId(totalBoxId);

  if (!totalEl) {
    totalEl = document.createElement("div");
    totalEl.id = totalBoxId;
    totalEl.className = "timeline-total";
    byId("timelineEditor")?.appendChild(totalEl);
  }

  const total = Object.values(slideDurations)
    .reduce((a,b)=>a+b,0);

  totalEl.textContent = "Total Slide Duration: " + total + "s";

  // Sync scene duration automatically
  sceneDurations[currentSceneId] = total;
}

// 🎬 Scene Timeline Renderer
function renderScenes(){

  const el = byId("sceneTimeline");
  if (!el) return;

  el.innerHTML = "";

  ["s1","s2","s3"].forEach(s => {

    const btn = document.createElement("button");
    btn.textContent = s.toUpperCase();

    btn.onclick = () => setScene(s);

    el.appendChild(btn);
  });
}

// 📁 Load Projects Panel
async function loadProjects() {

  if (!currentUid || !projectsList) return;

  const r = await fetch(`/api/projects/${currentUid}`);
  const data = await r.json();

  projectsList.innerHTML = "";

  data.projects.forEach(p => {

    const row = document.createElement("div");

    const openBtn = document.createElement("button");
    openBtn.className = "secondary-btn";
    openBtn.textContent = "📁 " + p.projectId;
    openBtn.onclick = () => openProject(p.projectId);

    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.onclick = () => deleteProject(p.projectId);

    const renBtn = document.createElement("button");
    renBtn.textContent = "✏";
    renBtn.onclick = () => renameProject(p.projectId);

    row.appendChild(openBtn);
    row.appendChild(renBtn);
    row.appendChild(delBtn);

    projectsList.appendChild(row);
  });
}

// 🌍 GLOBAL WINDOW EXPORTS
window.loadProjects = loadProjects;

// 🌍 Expose global helpers for HTML inline usage
window.hideCoach = hideCoach;
window.openUpgradeModal = openUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;

// -------------------------------------
// 📂 OPEN PROJECT (FULL RESTORE)
// -------------------------------------
async function openProject(projectId) {

  if (!projectId) return;

  try {

    const res = await fetch(
      `/api/project/${currentUid}/${projectId}`
    );

    const data = await res.json();

    if (!data.success) {
      alert("Project not found");
      return;
    }

    currentProjectId = projectId;

    // ---------------------------------
    // 🖼 Restore Slides
    // ---------------------------------
    slidePreview.innerHTML = "";

    data.slides.forEach(url => {

      const img = document.createElement("img");
      img.src = url;
      img.draggable = true;
      img.classList.add("draggable-slide");

      img.addEventListener("dragstart", onDragStart);
      img.addEventListener("dragover", onDragOver);
      img.addEventListener("drop", onDrop);

      slidePreview.appendChild(img);
    });

    // ---------------------------------
    // 🎵 Restore Audio
    // ---------------------------------
    if (data.audio) {
      audioPlayer.src = data.audio + "?t=" + Date.now();
      downloadBtn.disabled = false;
    }

    // ---------------------------------
    // 🎬 Restore Durations
    // ---------------------------------
    if (data.slideDurations)
      slideDurations = data.slideDurations;

    if (data.sceneDurations)
      sceneDurations = data.sceneDurations;

    // ---------------------------------
    // 🎞 Restore Video Settings
    // ---------------------------------
    if (data.format)
      formatSelect.value = data.format;

    if (data.captionMode)
      captionMode.value = data.captionMode;

    if (data.transition)
      sceneTransition.value = data.transition;

    // ---------------------------------
    // 🎨 Restore Subtitle Styling
    // ---------------------------------
    if (data.subtitleStyle) {
      subFontSize.value = data.subtitleStyle.fontSize;
      subMarginV.value = data.subtitleStyle.marginV;
      subOutline.value = data.subtitleStyle.outline;
      subAlign.value = data.subtitleStyle.align;
    }

    // ---------------------------------
    // 🎵 Restore Background Music
    // ---------------------------------
    if (data.bgMusic) {
      bgMusicPath = data.bgMusic;
      musicSelected = true;
    }

    // ---------------------------------
    // 🔄 Rebuild UI
    // ---------------------------------
    buildTimelineEditor();
    updateSlideTotals();
    drawSceneTimeline();
    updateStatusStrip();
    loadNotebook();

    alert("Project restored ✅");

  } catch (err) {

    console.error("Open project error:", err);
    alert("Failed to load project");

  }
}

// -------------------------------------
// 🎬 Draw Scene Timeline
// -------------------------------------
function drawSceneTimeline() {

  const wrap = byId("sceneTimeline");
  if (!wrap) return;

  wrap.innerHTML = "";

  const total =
    Object.values(sceneDurations)
      .reduce((a,b)=>a+b,0);

  Object.entries(sceneDurations)
    .forEach(([sid,sec]) => {

      const bar =
        document.createElement("div");

      bar.className = "scene-bar";
      bar.textContent =
        sid + " • " + sec + "s";

     // if (!isRestoringState) captureState();
bar.style.width = (sec / total * 100) + "%";

      // ✅ CLICK TO SWITCH SCENE
      bar.addEventListener("click", () => {
        setScene(sid);
      });

      enableSceneResize(bar, sid);


      wrap.appendChild(bar);
    });
  updateSlideTotals();
syncProjectState();

}

// -------------------------------
// 🧵 DRAW RENDER QUEUE UI
// -------------------------------
function drawQueue() {

  if (!queueList) return;

  queueList.innerHTML = "";

  renderQueue.forEach((j, i) => {

    const div = document.createElement("div");

    div.textContent =
      `${i+1}. ${j.projectId} — ${j.mode}/${j.format}`;

    queueList.appendChild(div);

  });

}

// ---------------------------------
// 🧵 STATUS STRIP UPDATER
// ---------------------------------
function updateStatusStrip(){

  const planEl = byId("statusPlan");
  const projectEl = byId("statusProject");
  const sceneEl = byId("statusScene");
  const queueEl = byId("statusQueue");

  if (planEl) {
    planEl.textContent = "🪪 Plan: " + (userPlan || "—");
  }

  if (projectEl) {
    projectEl.textContent = "📁 Project: " + (currentProjectId || "—");
  }

  if (sceneEl) {
    sceneEl.textContent = "🎬 Scene: " + (currentSceneId || "s1");
  }

  if (queueEl) {
    queueEl.textContent = "🧵 Queue: " + (renderQueue?.length || 0);
  }
}

// -------------------------------
// 💎 PREMIUM ACTIVATION BANNER
// --------------------------------
function showPremiumActivation() {

  const banner = byId("premiumWelcome");
  if (!banner) return;

  banner.classList.remove("hidden");

  setTimeout(() => {
    banner.classList.add("hidden");
  }, 4000);

}

// -------------------------
// 👋 WELCOME BANNER
// -------------------------
function updateWelcomeBanner() {

  const lastProject = localStorage.getItem("sharpvid_project");

  if (!lastProject) {
    welcomeBanner.classList.add("hidden");
    return;
  }

  welcomeProjectText.textContent =
    `last project: ${lastProject}`;

  welcomeBanner.classList.remove("hidden");

}

// ---------------------------------
// 🔦 SPOTLIGHT TUTORIAL BUILDER
// ---------------------------------
function startSpotlightTour() {

  const driver = window.driver.js.driver;

  const d = driver({
    showProgress: true,
    steps: [
      {
        element: '#scriptInput',
        popover: {
          title: 'Write Script',
          description: 'Type your story or narration here',
          side: 'bottom'
        }
      },
      {
        element: '#generateBtn',
        popover: {
          title: 'Generate Voice',
          description: 'Creates AI narration from your script',
          side: 'bottom'
        }
      },
      {
        element: '#voiceSelect',
        popover: {
          title: 'Voice Selector',
          description: 'Choose Standard (Free) or Wavenet (Premium)',
          side: 'bottom'
        }
      },
      {
        element: '#uploadSlidesBtn',
        popover: {
          title: 'Upload Slides',
          description: 'Upload your images here',
          side: 'bottom'
        }
      },
      {
        element: '#formatSelect',
        popover: {
          title: 'Video Format',
          description: 'Choose YouTube or TikTok layout',
          side: 'bottom'
        }
      },
      {
        element: '#captionMode',
        popover: {
          title: 'Caption Mode',
          description: 'Burn captions or export subtitle file',
          side: 'bottom'
        }
      },
      {
        element: '#generateVideoBtn',
        popover: {
          title: 'Generate Video',
          description: 'Render your final video',
          side: 'top'
        }
      },
      {
        element: '#projectsList',
        popover: {
          title: 'Projects',
          description: 'All your saved projects appear here',
          side: 'top'
        }
      }
    ]
  });

  d.drive();
}

// ===================================
// 📦 PROJECT HEADER VISIBILITY
// ===================================

function hideProjectHeader() {
  if (!projectHeader) return;

  projectHeader.classList.add("collapsing");

  setTimeout(() => {
    projectHeader.style.display = "none";
    updateHeaderHeight();
  }, 400);
}

function showProjectHeader() {
  if (!projectHeader) return;

  projectHeader.style.display = "flex"; // or block depending on layout

  requestAnimationFrame(() => {
    projectHeader.classList.remove("collapsing");
    updateHeaderHeight();
  });
}

// -----------------------------
// 🛈 TOOLTIP HELPER
// -----------------------------
function tip(id, text) {
  const el = byId(id);
  if (!el) return;
  el.classList.add("tip");
  el.setAttribute("data-tip", text);
}

// ===============================
// 🎯 EVENT HANDLERS (LOGIC ONLY)
// ===============================

window.scrollToVoice = () => {
  byId("voiceSelect")?.scrollIntoView({behavior:"smooth"});
};

window.scrollToVideo = () => {
  byId("generateVideoBtn")?.scrollIntoView({behavior:"smooth"});
};

window.scrollToCaptions = () => {
  byId("subtitleEditor")?.scrollIntoView({behavior:"smooth"});
};

// Start Trial Button 
async function handleStartTrial() {

  const res = await fetch("/api/start-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: currentUid })
  });

  const data = await res.json();

  if (!data.success) {
    return showCoach(data.error || "Trial failed");
  }

  showCoach("🎉 Trial Activated!");
  closeUpgradeModal();
}

function handleStartTour() {
  startSpotlightTour();
}

function handleSubtitleThemeChange() {

  if (!subTheme) return;

  const theme = SUBTITLE_THEMES[subTheme.value];
  if (!theme) return;

  subFontSize.value = theme.fontSize;
  subMarginV.value = theme.marginV;
  subOutline.value = theme.outline;
  subAlign.value = theme.align;
}

function applyBundle(name) {

  const bundles = {
    tiktok: { format: "vertical", caption: "burn", theme: "tiktok", duck: "0.25" },
    youtube: { format: "landscape", caption: "burn", theme: "youtube", duck: "0.25" },
    reels: { format: "vertical", caption: "karaoke", theme: "reels", duck: "0.15" },
    clean: { format: "landscape", caption: "srt", theme: "minimal", duck: "0.40" }
  };

  const b = bundles[name];
  if (!b) return;

  formatSelect.value = b.format;
  captionMode.value = b.caption;
  duckLevel.value = b.duck;

  if (subTheme) {
    subTheme.value = b.theme;
    subTheme.dispatchEvent(new Event("change"));
  }

  alert("📦 Bundle applied: " + name.toUpperCase());
}

// 🔒 Premium Voice Gate Logic
function handleVoiceChange() {

  const selectedVoice = VOICES.find(
    v => v.id === voiceSelect.value
  );

  if (!selectedVoice) return;

  if (selectedVoice.premium && !isPremium) {

    showCoach(
      "🔒 Upgrade to use premium voices",
      () => openUpgradeModal()
    );

    // auto reset to first free voice
    const firstFree = VOICES.find(v => !v.premium);
    if (firstFree) {
      voiceSelect.value = firstFree.id;
    }
  }
}

avatarInput?.addEventListener("change", async (e) => {

  const file = e.target.files[0];
  if (!file) return;

  const resized = await resizeAvatar(file);

  const formData = new FormData();
  formData.append("avatar", resized);
  formData.append("uid", currentUid);

  const res = await fetch("/api/upload-avatar", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (!data.success) return;

  avatarImage.src = data.url + "?t=" + Date.now();
avatarImage.classList.remove("hidden");
avatarInitials.classList.add("hidden");
avatarMode = "image";

});

// 🎧 Voice Preview Handler
async function previewVoice() {
  
  try {
    
    const selected = voiceSelect?.value;
    if (!selected) return;
    
    if (!isPremium) {
      const voice = VOICES.find(v => v.id === selected);
      if (voice?.premium) {
        return showCoach(
          "🔒 This is a Premium voice",
          () => openUpgradeModal()
        );
      }
    }
    
    const res = await fetch(BASE_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "This is a preview of the selected voice.",
        voiceId: selected,
        preview: true
      })
    });
    
    const data = await res.json();
    if (!data.success) return showCoach("Voice preview failed");
    
    const audio = new Audio(BASE_URL + data.file + "?t=" + Date.now());
    audio.play();
    
  } catch (err) {
    
    console.error("previewVoice crash:", err);
    
  }
  
}
// 🎲 Random Voice Selector
function randomVoice() {

  const available = VOICES.filter(v =>
    isPremium ? true : !v.premium
  );

  const random =
    available[Math.floor(Math.random() * available.length)];

  voiceSelect.value = random.id;
}

// 🖱 Drag State
let draggedIndex = null;

// 🎬 Drag Start
function onDragStart(e) {
  const nodes = [...slidePreview.children];
  draggedIndex = nodes.indexOf(e.target);
}

// 🎬 Drag Over
function onDragOver(e) {
  e.preventDefault();
}

// 🎬 Drop
function onDrop(e) {
  e.preventDefault();

  const nodes = [...slidePreview.children];
  const dropIndex = nodes.indexOf(e.target);

  if (dropIndex === -1 || draggedIndex === null) return;

  const draggedNode = nodes[draggedIndex];
  const dropNode = nodes[dropIndex];

  if (draggedIndex < dropIndex) {
    slidePreview.insertBefore(draggedNode, dropNode.nextSibling);
  } else {
    slidePreview.insertBefore(draggedNode, dropNode);
  }

  reorderTimeline(draggedIndex, dropIndex);
  draggedIndex = null;

  rebuildAfterReorder();
}

// -------------------------------------
// 📱 HANDLE TOUCH START (MOBILE DRAG)
// -------------------------------------
function handleTouchStart(e) {

  const el = e.target.closest("img");
  if (!el) return;

  draggedIndex =
    [...slidePreview.children].indexOf(el);
}


// -------------------------------------
// 📱 HANDLE TOUCH END (MOBILE DROP)
// -------------------------------------
function handleTouchEnd(e) {

  const el = document.elementFromPoint(
    e.changedTouches[0].clientX,
    e.changedTouches[0].clientY
  );

  if (!el || el.tagName !== "IMG") return;

  const dropIndex =
    [...slidePreview.children].indexOf(el);

  reorderTimeline(draggedIndex, dropIndex);

  const draggedNode =
    slidePreview.children[draggedIndex];

  slidePreview.insertBefore(
    draggedNode,
    dropIndex > draggedIndex
      ? el.nextSibling
      : el
  );

  rebuildAfterReorder();
}



// -----------------------------------
// 🎬 SCENE BAR RESIZE HANDLER
// -----------------------------------

function enableSceneResize(bar, sid) {

  let startX, startW;

  bar.onmousedown = e => {

    startX = e.clientX;
    startW = sceneDurations[sid];

    document.onmousemove = ev => {

      const dx = ev.clientX - startX;
      const delta = Math.round(dx / 10);

      sceneDurations[sid] =
        Math.max(2, startW + delta);

      drawSceneTimeline();
      if (!isRestoringState) {
  captureState();
  markUnsaved();
}
    };

    document.onmouseup = () => {
      document.onmousemove = null;
    };
  };
}

// -----------------------------------
// 🎬 Scene Switch Handler
// -----------------------------------

window.setScene = function(id) {

  currentSceneId = id;

  alert("Switched to " + id);
};

// ---------------------------------
// 🗑 Delete Project Handler
// ---------------------------------
async function deleteProject(pid) {

  if (!confirm("Delete project?")) return;

  await fetch(`/api/project/${currentUid}/${pid}`, {
    method: "DELETE"
  });

  loadProjects();
}

// -----------------------------------
// ✏ Rename Project Handler
// -----------------------------------
async function renameProject(oldId) {

  const newId = prompt("New project name:", oldId);
  if (!newId) return;

  await fetch("/api/project-rename", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      uid: currentUid,
      oldId,
      newId
    })
  });

  loadProjects();
}

// ===============================
// ↩ UNDO
// ===============================
function undo() {

  if (historyStack.length < 2) return;

  const current = historyStack.pop();
  redoStack.push(current);

  const previous =
    historyStack[historyStack.length - 1];

  restoreState(previous);
}

// ===============================
// ↪ REDO
// ===============================
function redo() {

  if (!redoStack.length) return;

  const next = redoStack.pop();

  historyStack.push(next);

  restoreState(next);
}

// -----------------------------
// ⏳ Job Status Monitor
// -----------------------------
async function startJobMonitor(projectId) {

  progressWrap.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "Starting…";

  if (jobPoller)
    clearInterval(jobPoller);

  jobPoller = setInterval(async () => {

    const r =
      await fetch(`/api/job-status/${projectId}`);

    const j = await r.json();

    progressBar.style.width =
      j.progress + "%";

    progressText.textContent =
      `${j.progress}% — ${j.status}`;

    if (j.progress >= 100) {

      clearInterval(jobPoller);

      progressText.textContent =
        "✅ Completed";
    }

  }, 2000);
}

// ---------------------------------
// 📝 HANDLE LOAD SUBTITLES
// ---------------------------------
async function handleLoadSubtitles() {

  if (!currentProjectId)
    return alert("No project");

  const r = await fetch(
    `/api/subtitle/${currentUid}/${currentProjectId}`
  );

  if (!r.ok)
    return alert("No subtitles yet");

  subtitleEditor.value = await r.text();
  downloadSubBtn.disabled = false;
}

// ---------------------------------
// 💾 HANDLE SAVE SUBTITLES
// ---------------------------------
async function handleSaveSubtitles() {

  if (!currentProjectId)
    return alert("No project");

  await fetch("/api/subtitle-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId,
      content: subtitleEditor.value
    })
  });

  alert("Subtitles saved");
}

// ===============================
// 📓 NOTEBOOK CORE FUNCTIONS
// ===============================

function toggleNotebook() {
  notebookPanel?.classList.toggle("hidden");
}

async function loadNotebook() {

  if (!currentUid || !currentProjectId) return;

  try {
    const res = await fetch(
      `/api/notebook/${currentUid}/${currentProjectId}`
    );

    const data = await res.json();

    if (notebookArea)
      notebookArea.value = data.content || "";

    updateNotebookCount();

  } catch (err) {
    console.error("Notebook load failed:", err);
  }
}

async function saveNotebook() {

  if (!currentUid || !currentProjectId) return;

  try {
    await fetch("/api/notebook-save", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        uid: currentUid,
        projectId: currentProjectId,
        content: notebookArea?.value || ""
      })
    });

  } catch (err) {
    console.error("Notebook save failed:", err);
  }
}

function updateNotebookCount() {

  if (!notebookArea || !notebookCount) return;

  const words =
    notebookArea.value.trim().split(/\s+/).filter(Boolean).length;

  notebookCount.textContent = words + " words";
}

// ---------------------------------
// 🚀 HANDLE PUBLISH
// ---------------------------------
async function handlePublish() {

  if (!currentProjectId)
    return alert("No project");

  const r = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId
    })
  });

  const data = await r.json();

  if (!data.success)
    return alert(data.error);

  const fullUrl = location.origin + data.url;

  prompt("Share this link:", fullUrl);
}

// ===================================
// 👤 AVATAR CLICK SYSTEM
// ===================================

let avatarClickTimer = null;

avatarWrap?.addEventListener("click", () => {

  if (avatarClickTimer) {
    clearTimeout(avatarClickTimer);
    avatarClickTimer = null;

    showAvatarBubble();
    return;
  }

  avatarClickTimer = setTimeout(() => {
    toggleAvatar();
    avatarClickTimer = null;
  }, 250);
});

function toggleAvatar() {

  if (!avatarImage || !avatarInitials) return;

  if (avatarMode === "image") {

    avatarImage.classList.add("hidden");
    avatarInitials.classList.remove("hidden");
    avatarMode = "initials";

  } else {

    // Only switch to image if it exists
    if (avatarImage.src && avatarImage.src.includes("/uploads/avatars/")) {
      avatarInitials.classList.add("hidden");
      avatarImage.classList.remove("hidden");
      avatarMode = "image";
    }

  }
}

function showAvatarBubble() {

  const hasImage = avatarMode === "image";

  avatarBubble.textContent =
    hasImage
      ? "Change your profile image"
      : "Upload your profile image";

  avatarBubble.classList.remove("hidden");

  setTimeout(() => {
    avatarBubble.classList.add("hidden");
  }, 2500);

  avatarBubble.onclick = () => {
    avatarInput.click();
  };
}
// ---------------------------------
// 🎬 HANDLE STITCH SCENES
// ---------------------------------
async function handleStitchScenes() {

  if (!currentProjectId)
    return alert("No project");

  const r = await fetch("/api/stitch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId,
      transition: sceneTransition.value
    })
  });

  const data = await r.json();

  if (!data.success)
    return alert(data.error);

  videoPlayer.src =
    data.file + "?t=" + Date.now();

  updateStatusStrip();
}

// ---------------------------------
// 💾 HANDLE SAVE PROFILE CLICK
// ---------------------------------
async function handleSaveProfile() {

  const firstNameInput = byId("firstNameInput");
  const lastNameInput = byId("lastNameInput");
  const usernameInput = byId("usernameInput");

  const firstName = firstNameInput?.value.trim();
  const lastName = lastNameInput?.value.trim();
  const username = usernameInput?.value.trim();

  // validation guard
  if (!firstName || !username) {

    if (typeof showCoach === "function") {
      showCoach("First name and username are required.");
    } else {
      alert("First name and username required.");
    }

    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.warn("No authenticated user found.");
    return;
  }

  const userRef = ref(db, `users/${user.uid}`);

  try {

    await update(userRef, {
      firstName,
      lastName: lastName || "",
      username,
      updatedAt: Date.now()
    });

    // hide modal
    byId("profileSetupModal")
      ?.classList.add("hidden");

    // update header immediately
    const nameEl = byId("headerUserName");
    if (nameEl) {
      nameEl.textContent = username || firstName;
    }

    console.log("Profile updated successfully");

    if (typeof showCoach === "function") {
      showCoach("Profile saved successfully 🎉");
    }

  } catch (err) {

    console.error("Profile update failed:", err);
    alert("Error saving profile. Check console.");

  }
}

// ----------------------------------------
// 💎 HANDLE CAPTION MODE CHANGE
// ----------------------------------------
function handleCaptionModeChange() {

  if (!captionMode) return;

  if (captionMode.value === "karaoke" && !isPremium) {
    captionMode.classList.add("premium-highlight");
  } else {
    captionMode.classList.remove("premium-highlight");
  }
syncProjectState();
}


// -----------------------------
// 🔊 HANDLE GENERATE VOICE (TTS)
// -----------------------------
async function handleGenerateVoiceClick() {

  const text = scriptInput.value.trim();

  if (!text) {
    return showCoach(
      "⚠️ Script missing — type your story first",
      () => byId("scriptInput")
        ?.scrollIntoView({ behavior: "smooth" })
    );
  }

  try {

    const res = await fetch(BASE_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceId: voiceSelect.value,
        projectId: currentProjectId,
        uid: currentUid,
        sceneId: currentSceneId,
      })
    });

    const data = await res.json();

    if (!data.success) {
      return alert("TTS failed");
    }

    currentProjectId = data.projectId;

    localStorage.setItem("sharpvid_project", currentProjectId);

    // 🔊 PLAY AUDIO (FIXED UNIVERSAL WAY)
    audioPlayer.src = BASE_URL + data.file + "?t=" + Date.now();
    audioPlayer.style.display = "block";
    await audioPlayer.play();

    downloadBtn.disabled = false;

    localStorage.removeItem(SCRIPT_KEY);

    updateStatusStrip();

  } catch (err) {

    console.error("TTS ERROR:", err);
    alert("Voice generation failed");

  }
}

// -------------------------------
// ⬇️ HANDLE DOWNLOAD AUDIO
// -------------------------------
function handleDownloadAudioClick() {

  if (!currentProjectId) return;

  const a = document.createElement("a");
  a.href = audioPlayer.src;
  a.download = "voice.mp3";
  a.click();
}

// ----------------------------
// 📤 HANDLE SLIDE UPLOAD
// ----------------------------
async function handleSlideUploadClick() {

  if (!slideUpload.files.length)
    return alert("Select slides");

  const fd = new FormData();

  for (let f of slideUpload.files)
    fd.append("slides", f);

  if (currentProjectId)
    fd.append("projectId", currentProjectId);

  fd.append("sceneId", currentSceneId);
  fd.append("uid", currentUid);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd
  });

  const data = await res.json();

  if (!data.success)
    return alert("Upload failed");

  currentProjectId = data.projectId;

  localStorage.setItem("sharpvid_project", currentProjectId);

  slidePreview.innerHTML = "";

  data.files.forEach(url => {

    const img = document.createElement("img");
    img.src = url;
    img.draggable = true;
    img.classList.add("draggable-slide");

    img.addEventListener("dragstart", onDragStart);
    img.addEventListener("dragover", onDragOver);
    img.addEventListener("drop", onDrop);

    slidePreview.appendChild(img);

  });

  buildTimelineEditor(); // moved OUTSIDE loop (professional fix)
  updateSlideTotals();
drawSceneTimeline();
syncProjectState();

  alert("Slides uploaded");

  updateStatusStrip(); // no typeof check needed
}

// ----------------------------------
// 🎵 HANDLE MUSIC FILE INPUT CHANGE
// ----------------------------------
async function handleMusicUploadChange() {

  if (!isPremium) {
    return showCoach(
      "🔒 Music upload is Premium only",
      () => openUpgradeModal()
    );
  }

  const fd = new FormData();
  fd.append("music", musicUpload.files[0]);
  fd.append("sceneId", currentSceneId);
  fd.append("uid", currentUid);

  const res = await fetch("/api/upload-music", {
    method: "POST",
    body: fd
  });

  const data = await res.json();

  if (!data.success)
    return alert("Music upload failed");

  bgMusicPath = data.file;
  musicSelected = true;
  syncProjectState();

  alert("Music uploaded");
}

// -----------------------------------------
// 🎵 HANDLE MUSIC UPLOAD BOX CLICK
// -----------------------------------------
function handleMusicUploadBoxClick() {

  if (!isPremium) {
    return showCoach(
      "🔒 Background music is a Premium feature",
      () => openUpgradeModal()
    );
  }

  musicUpload.click();
}


// ------------------------------------------
// 🎬 HANDLE GENERATE VIDEO (QUEUE SAFE)
// ------------------------------------------
async function handleGenerateVideo() {

  if (renderInProgress) {
    return showCoach("⏳ Render already in progress...");
  }

  renderInProgress = true;
  generateVideoBtn.disabled = true;

  try {

    // 🛡 Project Integrity Guard
    if (!currentProjectId)
      throw new Error("📁 No project yet — upload slides first");

    if (!slidePreview || !slidePreview.children.length)
      throw new Error("📤 Upload at least one slide image");

    if (!audioPlayer || !audioPlayer.src)
      throw new Error("🎙 Generate voice audio first");

    if (!currentSceneId)
      throw new Error("🎬 Scene not selected");

    if (!isPremium && musicSelected)
      throw new Error("🎵 Background music is Premium-only");

    if (!isPremium && captionMode.value === "karaoke")
      throw new Error("🎤 Karaoke captions are Premium-only");

    // 📊 Reset progress UI
    progressBar.style.width = "0%";
    progressText.textContent = "Queued…";

    // 🧵 Add to Queue
    renderQueue.push(buildVideoPayload());
    drawQueue();

    if (!queueRunning)
      runNextInQueue();

    updateStatusStrip();

  } catch (err) {

    console.error("🎬 Generate error:", err);

    showCoach?.(err.message);

    // 🔓 Unlock if validation failed
    renderInProgress = false;
    generateVideoBtn.disabled = false;
  }
}

// --------------------------------
// ✨ AI SCRIPT PREMIUM GATE
// --------------------------------
function handleAiScriptClick() {

  if (!isPremium) {
    showCoach("✨ AI Script Studio is Premium");
    return openUpgradeModal();
  }

  openAiScriptModal();
}

// ----------------------------------
// 🤖 HANDLE AI SCRIPT ASSISTANT RUN
// ----------------------------------
async function handleAiScriptRun() {

  const payload = {
    topic: byId("aiTopic").value,
    mode: byId("aiScriptMode").value,
    tone: byId("aiTone").value,
    audience: byId("aiAudience").value,
    length: byId("aiLength").value,
    baseText: scriptInput.value.trim()
  };

  try {

    const res = await fetch("/api/script-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const j = await res.json();

    if (!j.success) {
      return showCoach("AI script failed — try again");
    }

    scriptInput.value = j.text;
    closeAiScriptModal();

  } catch (err) {

    console.error("AI script error:", err);
    showCoach("AI script failed — network issue");

  }
}

// -------------------------------
// ➕ ADD RENDER JOB TO QUEUE
// -------------------------------
function handleAddToQueue() {

  if (!currentProjectId)
    return alert("No project");

  renderQueue.push(buildVideoPayload());
  drawQueue();

  if (!queueRunning)
    runNextInQueue();

  updateStatusStrip();
}

// ----------------------------------
// 📦 HANDLE BATCH EXPORT
// ----------------------------------
function handleBatchExport() {

  if (!currentProjectId)
    return alert("No project loaded");

  const variants = [
    ["landscape", "burn"],
    ["landscape", "srt"],
    ["vertical", "burn"],
  ];

  if (isPremium) {
    variants.push(["vertical", "karaoke"]);
  }

  variants.forEach(([format, mode]) => {
    renderQueue.push(buildPayloadVariant(format, mode));
  });

  drawQueue();

  if (!queueRunning)
    runNextInQueue();

  alert("📦 Batch export queued");
}

// -----------------------------
// 🔺 SCROLL TO TOP HANDLERS
// -----------------------------
const scrollTopBtn = byId("scrollTopBtn");
// let scrollTopTimeout = null;

window.addEventListener("scroll", () => {
  if (!scrollTopBtn) return;

  if (window.scrollY > 300) {

    scrollTopBtn.classList.remove("hidden");

    // reset timer every time user scrolls
    clearTimeout(scrollTopTimeout);

    scrollTopTimeout = setTimeout(() => {
      scrollTopBtn.classList.add("hidden");
    }, 5000); // auto-hide after 5s

  } else {
    scrollTopBtn.classList.add("hidden");
  }
});

scrollTopBtn?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  scrollTopBtn.classList.add("hidden"); // hide immediately on click
});

// --------------------------
// 🚪 HANDLE LOGOUT
// --------------------------
async function handleLogout() {

  try {

    isLoggingOut = true;

    localStorage.removeItem("sharpvid_project");
    localStorage.removeItem(SCRIPT_KEY);

    await signOut(auth);

    location.href = "index.html";

  } catch (err) {

    console.error("Logout failed:", err);
    alert("Logout failed");

  }

}

// ----------------------------
// 💳 HANDLE STRIPE CHECKOUT
// ----------------------------
async function handleStripeCheckout() {

  const plan =
    byId("yearlyTab")?.classList.contains("active") ?
    "yearly" :
    "monthly";

  try {

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: currentUid,
        plan
      })
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }

  } catch (err) {

    console.error("Stripe checkout failed:", err);
    alert("Payment initialization failed.");

  }
}

// ----------------------------
// 💰 HANDLE MONTHLY SELECT
// ----------------------------
function handleMonthlySelect() {

  monthlyTab?.classList.add("active");
  yearlyTab?.classList.remove("active");

  if (priceValue) priceValue.textContent = "₦4,500";
  if (priceLabel) priceLabel.textContent = "per month";
  if (yearlyStrike) yearlyStrike.classList.add("hidden");

}

// ----------------------------
// 💰 HANDLE YEARLY SELECT
// ----------------------------
function handleYearlySelect() {

  yearlyTab?.classList.add("active");
  monthlyTab?.classList.remove("active");

  if (priceValue) priceValue.textContent = "₦45,000";
  if (priceLabel) priceLabel.textContent = "per year";
  if (yearlyStrike) yearlyStrike.classList.remove("hidden");

}

// ----------------------------
// 📏 HANDLE HEADER HEIGHT UPDATE
// ----------------------------
function handleHeaderHeightUpdate() {
  updateHeaderHeight();
}

// ===================================
// 💾 HANDLE MANUAL SAVE
// ===================================
async function handleManualSave() {

  if (!currentProjectId || !currentUid)
    return alert("No active project");

  try {

    await syncProjectState(); // your existing state sync

    showProjectHeader(); // 🔥 bring Resume/New back

    alert("Project saved ✅");

  } catch (err) {
    console.error("Manual save failed:", err);
    alert("Save failed");
  }
}

// ===================================
// 🔐 CENTRAL PREMIUM UI ENGINE
// ===================================

function applyPremiumGate(id) {

  const el = byId(id);
  if (!el) return;

  el.onclick = null; // always reset

  if (!isPremium) {

    el.classList.add("premium-locked");

    el.onclick = function (e) {
      e.preventDefault();
      openUpgradeModal();
    };

  } else {

    el.classList.remove("premium-locked");
    el.onclick = null;

  }
}

function refreshPremiumUI() {

  [
    "aiScriptBtn",
    "musicUploadBox",
    "duckLevel",
    "bundleClean",
    "exportAllBtn",
    "presetHD"
  ].forEach(applyPremiumGate);

}

// ===============================
// 🔐 AUTH GUARD(Safe and Clean)
// ===============================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    if (!isLoggingOut)
      alert("❌ Please login first!");

    window.location.href = "index.html";
    return;
  }

  currentUid = user.uid;

  if (currentUid)
    loadUsage();

  console.log("MY UID:", user.uid);

  const userRef =
    ref(db, `users/${user.uid}`);

  // -------------------------------
  // 🔥 Ensure User Record Exists
  // -------------------------------

  const firstSnap =
    await get(userRef);

  if (!firstSnap.exists()) {

    await set(userRef, {
      firstName: "",
      lastName: "",
      username: "",
      email: user.email,
      plan: "free",
      createdAt: Date.now()
    });

  }

  // --------------------------
  // 🔄 Live Plan Listener
  // --------------------------

  onValue(userRef, async (snap) => {

    let userData = snap.val();
    if (!userData) return;

    console.log("LIVE USER DATA:", userData);

    // ------------------------------
    // 👤 Profile Completion Check
    // -------------------------------

    if (!userData.firstName || !userData.username) {

      const modal =
        byId("profileSetupModal");

      modal?.classList.remove("hidden");
    }

    // -----------------------------
    // 💎 Plan Logic
    // -----------------------------
    const previousPlan = userPlan;

    userPlan = userData.plan || "free";

    isPremium =
      DEV_MODE
        ? true
        : (userPlan === "premium");
    refreshPremiumUI();

    const statusPlan =
      byId("statusPlan");

    if (statusPlan) {

      statusPlan.textContent =
        `🪪 Plan: ${userPlan.toUpperCase()}`;
    }

// ===============================
// 👋 USER HEADER SYSTEM (CLEAN)
// ===============================

const nameEl = byId("headerUserName");
const greetEl = byId("timeGreeting");
const nameEl2 = byId("creatorName");
const planEl = byId("creatorPlan");
const statsEl = byId("creatorStats");

// Pick best available name
const fullName =
  userData.username ||
  userData.firstName ||
  user.displayName ||
  user.email?.split("@")[0] ||
  "Creator";

// ===============================
// 👤 AVATAR SYSTEM (SINGLE SOURCE)
// ===============================

if (avatarWrap) {

  const initials = fullName
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (userData.avatarUrl) {

    avatarImage.src = userData.avatarUrl + "?t=" + Date.now();
    avatarImage.classList.remove("hidden");
    avatarInitials.classList.add("hidden");
    avatarMode = "image";

  } else {

    avatarInitials.textContent = initials;
    avatarInitials.classList.remove("hidden");
    avatarImage.classList.add("hidden");
    avatarMode = "initials";

  }
}

// ===============================
// 👤 NAME DISPLAY
// ===============================
if (nameEl) nameEl.textContent = fullName;
if (nameEl2) nameEl2.textContent = fullName;

// ===============================
// 💎 PLAN DISPLAY
// ===============================
if (planEl) {
  planEl.textContent = userPlan.toUpperCase() + " PLAN";
  planEl.style.color = isPremium ? "#22c55e" : "#94a3b8";
}

// ===============================
// 📊 STATS DISPLAY (FIXED)
// ===============================
if (statsEl) {

  const sceneCount =
    Object.keys(sceneDurations || {}).length;

  const queueCount =
    renderQueue?.length || 0;

  statsEl.textContent =
    `📁 ${sceneCount} Scenes • 🧵 ${queueCount} Queue`;
}

// ===============================
// ⏰ TIME GREETING
// ===============================
if (greetEl) {

  const hour = new Date().getHours();

  let greetingText =
    hour < 12 ? "✨ Good Morning!" :
    hour < 17 ? "☀️ Good Afternoon!" :
    hour < 20 ? "🌤 Good Evening!" :
    "🌙 Good Night!";

  greetEl.textContent = greetingText;
  greetEl.classList.remove("hidden");

  setTimeout(updateHeaderHeight, 50);

  setTimeout(() => {
    greetEl.classList.add("fade-out");
    updateHeaderHeight();
  }, 60000);
}

    // ===================================
// 👑 PREMIUM CROWN BADGE
// ===================================

    if (nameEl) {

      const cleanName = nameEl.textContent.replace(" 👑", "");

      if (isPremium) {
        nameEl.textContent = cleanName + " 👑";
      } else {
        nameEl.textContent = cleanName;
      }

    }

// ----------------------------
// 🔧 CORE UI BUILDERS
// ----------------------------
drawSceneTimeline();
loadProjects();
buildVoiceSelect();
updateStatusStrip();
updateWelcomeBanner();
updatePremiumShowcase();
startSaveReminder();

// ===================================
// 🎤 KARAOKE OPTION VISUAL LOCK
// ===================================

if (captionMode) {

  const karaokeOption =
    captionMode.querySelector("option[value='karaoke']");

  if (karaokeOption) {

    if (!isPremium) {

      karaokeOption.disabled = true;

      // If user somehow had it selected before downgrade
      if (captionMode.value === "karaoke") {
        captionMode.value = "burn";
      }

    } else {

      karaokeOption.disabled = false;

    }

  }
}

if (isPremium) {
  ["aiScriptBtn","bundleClean","presetHD"]
  .forEach(id=>{
    byId(id)?.classList.add("premium-active");
  });
}

// -------------------------------
// 🎉 Premium Upgrade Detection
// -------------------------------
if (previousPlan === "free" && userPlan === "premium") {

  if (window.launchConfetti)
    launchConfetti();

  if (window.showCoach)
    showCoach("🎉 Welcome to Premium!");
}

// -------------------------------
// 🎓 First-Time Spotlight Tour
// -------------------------------
if (!localStorage.getItem("sharpvid_tour_done")) {

  setTimeout(() => {

    if (window.startSpotlightTour)
      startSpotlightTour();

    localStorage.setItem("sharpvid_tour_done", "1");

  }, 800);
}
}); // 🔚 CLOSE onValue
}); // 🔚 CLOSE onAuthStateChanged

// ===============================
// 🔗 bindUIEvents()
// Attach All Listeners Here
// ===============================
function bindUIEvents() {

  try {

    // ===============================
// 📓 NOTEBOOK EVENT BINDINGS
// ===============================

byId("openNotebook")?.addEventListener("click", toggleNotebook);

notebookArea?.addEventListener("input", updateNotebookCount);

notebookSaveBtn?.addEventListener("click", saveNotebook);

// Auto-save (runs quietly)
setInterval(() => {

  if (notebookPanel &&
      !notebookPanel.classList.contains("hidden")) {
    saveNotebook();
  }

}, 5000);

    byId("loadSubsBtn")
      ?.addEventListener("click", handleLoadSubtitles);

    byId("saveSubsBtn")
      ?.addEventListener("click", handleSaveSubtitles);

    byId("publishBtn")
      ?.addEventListener("click", handlePublish);

    byId("stitchBtn")
      ?.addEventListener("click", handleStitchScenes);

    byId("saveProfileBtn")
      ?.addEventListener("click", handleSaveProfile);

    byId("undoBtn")?.addEventListener("click", undo);
byId("redoBtn")?.addEventListener("click", redo);
    document.addEventListener("keydown", e => {

  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undo();
  }

  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redo();
  }

});

byId("presetHD")?.addEventListener("click", () => {
  applyQuickPreset("hd");
});

 byId("manualSaveFromMenu")?.addEventListener("click", handleManualSave);
byId("undoFromMenu")?.addEventListener("click", () => undoBtn?.click());
byId("redoFromMenu")?.addEventListener("click", () => redoBtn?.click());
byId("upgradeFromMenu")?.addEventListener("click", openUpgradeModal);
byId("logoutFromMenu")?.addEventListener("click", handleLogout);

function openSideMenu() {
  sideMenu.classList.remove("hidden");   // 👈 ADD THIS
  sideMenu.classList.add("active");
  sideOverlay.classList.remove("hidden");
}

    function closeMenu() {
      sideMenu.classList.remove("active");
      sideOverlay.classList.add("hidden");

      // wait for slide animation before hiding
      setTimeout(() => {
        sideMenu.classList.add("hidden");   // 👈 ADD THIS
      }, 300);
    }

appMenuBtn?.addEventListener("click", openSideMenu);
closeSideMenu?.addEventListener("click", closeMenu);
sideOverlay?.addEventListener("click", closeMenu);

// Submenu toggle
document.querySelectorAll(".has-sub").forEach(item => {
  item.addEventListener("click", () => {
    const sub = byId(item.dataset.sub);
    sub?.classList.toggle("hidden");
  });
});

   // ===================================
// ▶ RESUME PROJECT
// ===================================
if (resumeProjectBtn) {
  resumeProjectBtn.addEventListener("click", () => {

    const lastProject = localStorage.getItem("sharpvid_project");
    if (!lastProject) return alert("No Project to resume, begin a New Project");

    openProject(lastProject);
    hideProjectHeader();
    // Switch to home tab after resuming old project 
    showTab("home");

  });
}

// ===================================
// ➕ NEW PROJECT
// ===================================
if (newProjectBtn) {
  newProjectBtn.addEventListener("click", () => {

    resetAppForNewProject();
    hideProjectHeader();

  });
}

// ===================================
// 💾 MANUAL PROJECT SAVE
// ===================================
manualSaveBtn?.addEventListener("click", handleManualSave);

    if (slidePreview) {
      slidePreview.addEventListener("touchstart", handleTouchStart);
      slidePreview.addEventListener("touchend", handleTouchEnd);
    }

formatSelect?.addEventListener("change", () => {
  if (!isRestoringState) captureState();
  syncProjectState();
  markUnsaved();
});

    captionMode?.addEventListener("change", () => {
  if (!isRestoringState) captureState();
  markUnsaved();
  handleCaptionModeChange();
});

    document.querySelectorAll(".upgrade-trigger")
      .forEach(btn=>{
        btn.addEventListener("click", openUpgradeModal);
      });

    fabMain?.addEventListener("click", () => {
      fabMenu?.classList.toggle("hidden");
    });

    fabSlides?.addEventListener("click", () => {
      slideUpload?.click();
    });

    fabMusic?.addEventListener("click", () => {
      if (!isPremium) return openUpgradeModal();
      musicUpload?.click();
    });

    generateBtn?.addEventListener("click", handleGenerateVoiceClick);
    downloadBtn?.addEventListener("click", handleDownloadAudioClick);
    musicUpload?.addEventListener("change", handleMusicUploadChange);
    musicUploadBox?.addEventListener("click", handleMusicUploadBoxClick);
    uploadSlidesBtn?.addEventListener("click", handleSlideUploadClick);

    document.querySelectorAll(".scene-btn")
      .forEach((btn, index) => {
        btn.addEventListener("click", () => {
          const sceneId = "s" + (index + 1);
          setScene(sceneId);
        });
      });

    fabVoice?.addEventListener("click", () => {
      if (!isPremium) return openUpgradeModal();
      alert("Voice upload coming next phase");
    });
    byId("exportAllBtn")?.addEventListener("click", handleBatchExport);
    addQueueBtn?.addEventListener("click", handleAddToQueue);
    generateVideoBtn?.addEventListener("click", handleGenerateVideo);

    byId("previewVoiceBtn")?.addEventListener("click", previewVoice);
    byId("randomVoiceBtn")?.addEventListener("click", randomVoice);
    byId("startTrialBtn")?.addEventListener("click", handleStartTrial);
    byId("startTourBtn")?.addEventListener("click", handleStartTour);

    subTheme?.addEventListener("change", handleSubtitleThemeChange);

    bundleTikTok?.addEventListener("click", () => applyBundle("tiktok"));
    bundleYouTube?.addEventListener("click", () => applyBundle("youtube"));
    bundleReels?.addEventListener("click", () => applyBundle("reels"));
    bundleClean?.addEventListener("click", () => applyBundle("clean"));

    voiceSelect?.addEventListener("change", handleVoiceChange);
    byId("aiScriptBtn")?.addEventListener("click", handleAiScriptClick);
    logoutBtn?.addEventListener("click", handleLogout);
    byId("stripeCheckoutBtn")?.addEventListener("click", handleStripeCheckout);

    monthlyTab?.addEventListener("click", handleMonthlySelect);
    yearlyTab?.addEventListener("click", handleYearlySelect);

    window.addEventListener("load", handleHeaderHeightUpdate);
    window.addEventListener("resize", handleHeaderHeightUpdate);

    if (typeof tip === "function") {
      tip("generateBtn", "Convert your script into AI voice");
      tip("voiceSelect", "Premium voices sound more natural");
      tip("uploadSlidesBtn", "Upload unlimited images for this scene");
      tip("musicUploadBox", "Background music — Premium feature");
      tip("generateVideoBtn", "Render slideshow + captions + audio");
      tip("captionMode", "Choose subtitle style output");
      tip("formatSelect", "Vertical = TikTok, Landscape = YouTube");
      tip("exportAllBtn", "Render all social formats at once");
      tip("addQueueBtn", "Add render job to queue");
      tip("subtitleEditor", "Edit subtitle text before burning");
      tip("sceneTransition", "Transition between scenes");
      tip("stitchBtn", "Merge all scenes into one video");
      tip("aiScriptBtn", "AI generates script ideas & rewrites");
    }

} catch (err) {
  console.error("bindUIEvents crash:", err);
}

}

// ===============================
// 🚀 INITIALIZE APP
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  // 1️⃣ Bind all event listeners
  bindUIEvents();

  // 2️⃣ Build initial UI
  // initializeAppUI();

  // 3️⃣ Restore script draft
  restoreScriptDraft();
  startScriptAutosave();

  // 4️⃣ Onboarding logic
  const overlay = byId("onboardOverlay");
  const closeBtn = byId("onboardCloseBtn");
  const ONBOARD_KEY = "sharpvid_onboard_done";

  if (!localStorage.getItem(ONBOARD_KEY)) {
    overlay?.classList.remove("hidden");
  }

  window.addEventListener("resize", updateHeaderHeight);
window.addEventListener("load", updateHeaderHeight);
window.addEventListener("orientationchange", updateHeaderHeight);

  closeBtn?.addEventListener("click", () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    overlay?.classList.add("hidden");
  });

  // 5️⃣ Initial UI sync
  updateStatusStrip();
  updateWelcomeBanner();
});
