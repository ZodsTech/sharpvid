import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===============================
// 🔹 Firebase Config
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
// 🔹 UI Elements
// ===============================
const planStatus = 
document.getElementById("plan-status");
const usageStatus = 
document.getElementById("usage-status");
const projectLabel = 
document.getElementById("project-label");
const scriptInput = document.getElementById("scriptInput");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const audioPlayer = document.getElementById("audioPlayer");
const formatSelect = document.getElementById("formatSelect");
const captionMode = document.getElementById("captionMode");
const generateVideoBtn = document.getElementById("generateVideoBtn");
const progressWrap = document.getElementById("renderProgressWrap");
const progressBar = document.getElementById("renderProgressBar");
const progressText = document.getElementById("renderProgressText");
const videoPlayer = document.getElementById("videoPlayer");
const downloadVideoBtn = document.getElementById("downloadVideoBtn");
const downloadSubBtn = document.getElementById("downloadSubBtn");
const subtitleEditor = document.getElementById("subtitleEditor");
const loadSubsBtn = document.getElementById("loadSubsBtn");
const saveSubsBtn = document.getElementById("saveSubsBtn");
const subFontSize = document.getElementById("subFontSize");
const subMarginV = document.getElementById("subMarginV");
const subOutline = document.getElementById("subOutline");
const subAlign = 
document.getElementById("subAlign");
const subTheme = 
document.getElementById("subTheme");
const publishBtn = document.getElementById("publishBtn");

const logoutBtn = 
document.getElementById("logoutBtn");

// Upload UI
const slideUpload = document.getElementById("slideUpload");
const uploadSlidesBtn = document.getElementById("uploadSlidesBtn");
const slidePreview = document.getElementById("slidePreview");
const musicUpload = document.getElementById("musicUpload");
const musicUploadBox = document.getElementById("musicUploadBox");
const projectsList = document.getElementById("projectsList");
const duckLevel = 
document.getElementById("duckLevel");
const bundleTikTok = document.getElementById("bundleTikTok");
const bundleYouTube = document.getElementById("bundleYouTube");
const bundleReels = document.getElementById("bundleReels");
const bundleClean = document.getElementById("bundleClean");
const addQueueBtn = document.getElementById("addQueueBtn");
const queueList = 
document.getElementById("queueList");
const sceneTransition =
document.getElementById("sceneTransition");

// FAB
const fabMain = document.getElementById("fabMain");
const fabMenu = document.getElementById("fabMenu");
const fabSlides = document.getElementById("fabSlides");
const fabVoice = document.getElementById("fabVoice");
const fabMusic = document.getElementById("fabMusic");

// ===============================
// 🔹 App State
// ===============================
const DEV_MODE = true; // SharpVid dev switch

let userPlan = "free";
let isPremium = DEV_MODE ? true : false;
let isLoggingOut = false;

let bgMusicPath = null;
let musicSelected = false;
let currentProjectId = null;
let jobPoller = null;
let currentUid = null;
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
// 🎭 SUBTITLE THEMES
// ===============================
const SUBTITLE_THEMES = {
  tiktok: {
    fontSize: 48,
    marginV: 220,
    outline: 3,
    align: 2
  },
  youtube: {
    fontSize: 42,
    marginV: 160,
    outline: 2,
    align: 2
  },
  reels: {
    fontSize: 50,
    marginV: 200,
    outline: 4,
    align: 2
  },
  minimal: {
    fontSize: 32,
    marginV: 140,
    outline: 1,
    align: 2
  }
};

if (subTheme) {
  subTheme.onchange = () => {
    const theme = SUBTITLE_THEMES[subTheme.value];
    if (!theme) return;

    subFontSize.value = theme.fontSize;
    subMarginV.value = theme.marginV;
    subOutline.value = theme.outline;
    subAlign.value = theme.align;
  };
}

// ===============================
// 📦 EXPORT BUNDLES
// ===============================
function applyBundle(name) {
  const bundles = {

    tiktok: {
      format: "vertical",
      caption: "burn",
      theme: "tiktok",
      duck: "0.25"
    },

    youtube: {
      format: "landscape",
      caption: "burn",
      theme: "youtube",
      duck: "0.25"
    },

    reels: {
      format: "vertical",
      caption: "karaoke",
      theme: "reels",
      duck: "0.15"
    },

    clean: {
      format: "landscape",
      caption: "srt",
      theme: "minimal",
      duck: "0.40"
    }
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

// wire buttons
bundleTikTok && (bundleTikTok.onclick = () => applyBundle("tiktok"));
bundleYouTube && (bundleYouTube.onclick = () => applyBundle("youtube"));
bundleReels && (bundleReels.onclick = () => applyBundle("reels"));
bundleClean && (bundleClean.onclick = () => applyBundle("clean"));

// ===============================
    // ⏰ TIMELINE EDITOR 
    // ===============================
function buildTimelineEditor() {
  const wrap = document.getElementById("timelineEditor");
  if (!wrap) return;

  wrap.innerHTML = "";

  const slides = slidePreview.querySelectorAll("img");

  slides.forEach((img, i) => {

    if (!slideDurations[i]) {
      slideDurations[i] = 3; // default 3 sec
    }

    const row = document.createElement("div");
    row.className = "timeline-row";

    const thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.className = "timeline-thumb";

    const input = document.createElement("input");
    input.type = "number";
    input.min = 1;
    input.max = 30;
    input.value = slideDurations[i];

    input.onchange = () => {
      slideDurations[i] = parseFloat(input.value) || 3;
      saveTimeline();
    };

    row.appendChild(thumb);
    row.appendChild(input);
    wrap.appendChild(row);

  });
}

// ===============================
// 💾 SCRIPT AUTOSAVE
// ===============================
const SCRIPT_KEY = "sharpvid_script_draft";

// restore on load
const savedDraft = localStorage.getItem(SCRIPT_KEY);
if (savedDraft && scriptInput) {
  scriptInput.value = savedDraft;
}

// autosave every 3 seconds
setInterval(() => {
  if (!scriptInput) return;
  localStorage.setItem(SCRIPT_KEY, scriptInput.value);
}, 3000);

    // ===============================
    // 📁 PROJECTS PANEL
    // ===============================

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

  // 📂 Open Project
  async function openProject(pid) {
  const r = await fetch(`/api/project/${currentUid}/${pid}`);
  const data = await r.json();

  currentProjectId = pid;
    if (projectLabel) {
      projectLabel.textContent = "📁 Project: " + pid;
    }
  localStorage.setItem("sharpvid_project", pid);

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
    loadTimeline();
buildTimelineEditor();
  });

  if (data.audio) {
    audioPlayer.src = data.audio + "?t=" + Date.now();
  }

  if (data.videos.length) {
    videoPlayer.src = data.videos[0] + "?t=" + Date.now();
  }
}

// AUTO SAVE TIMELINE 
function saveTimeline() {
  localStorage.setItem(
    "sharpvid_timeline_" + currentProjectId,
    JSON.stringify(slideDurations)
  );
}

function loadTimeline() {
  const raw = localStorage.getItem(
    "sharpvid_timeline_" + currentProjectId
  );
  if (raw) slideDurations = JSON.parse(raw);
}

// SLIDES MOBILE DRAG
let draggedIndex = null;

function onDragStart(e) {
  const nodes = [...slidePreview.children];
  draggedIndex = nodes.indexOf(e.target);
}

function onDragOver(e) {
  e.preventDefault(); // required
}

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

// REORDER TIMELINE 
function reorderTimeline(from, to) {
  if (!slideDurations.length) return;

  const moved = slideDurations.splice(from, 1)[0];
  slideDurations.splice(to, 0, moved);

  saveTimeline();
}

function rebuildAfterReorder() {
  buildTimelineEditor();
}

  // MOBILE TOUCH SUPPORT FOR DRAG
slidePreview.addEventListener("touchstart", e => {
  const el = e.target.closest("img");
  if (!el) return;
  draggedIndex = [...slidePreview.children].indexOf(el);
});

slidePreview.addEventListener("touchend", e => {
  const el = document.elementFromPoint(
    e.changedTouches[0].clientX,
    e.changedTouches[0].clientY
  );

  if (!el || el.tagName !== "IMG") return;

  const dropIndex =
    [...slidePreview.children].indexOf(el);

  reorderTimeline(draggedIndex, dropIndex);

  const draggedNode = slidePreview.children[draggedIndex];
  slidePreview.insertBefore(
    draggedNode,
    dropIndex > draggedIndex
      ? el.nextSibling
      : el
  );

  rebuildAfterReorder();
});

// TIMELINE HELPER 
function getSlideOrder() {
  return [...slidePreview.children].map(img => {
    const parts = img.src.split("/slides/");
    return parts[1]; // filename only
  });
}

// TIMELINE FUNCTIONS 
function drawSceneTimeline() {
  const wrap = document.getElementById("sceneTimeline");
  if (!wrap) return;

  wrap.innerHTML = "";

  const total = Object.values(sceneDurations)
    .reduce((a,b)=>a+b,0);

  Object.entries(sceneDurations).forEach(([sid,sec]) => {

    const bar = document.createElement("div");
    bar.className = "scene-bar";
    bar.textContent = sid + " • " + sec + "s";

    bar.style.width =
      (sec/total * 100) + "%";

    enableSceneResize(bar, sid);

    wrap.appendChild(bar);
  });
}

// DRAG RESIZE FUNCTION 
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
    };

    document.onmouseup = () => {
      document.onmousemove = null;
    };
  };
}

// MULTIPLE SCENES FUNCTION
window.setScene = function(id) {
  currentSceneId = id;
  alert("Switched to " + id);
};

  // Delete Projects Function 
  async function deleteProject(pid) {
  if (!confirm("Delete project?")) return;

  await fetch(`/api/project/${currentUid}/${pid}`, {
    method: "DELETE"
  });

  loadProjects();
}

  //Projects Rename Function 
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

// 🔁 Restore last project if exists
const savedProject = localStorage.getItem("sharpvid_project");
if (savedProject) {
  currentProjectId = savedProject;

  if (projectLabel) {
    projectLabel.textContent = "📁 Project: " + savedProject;
  }
}

//  Job Status Poller
async function startJobMonitor(projectId) {

  progressWrap.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "Starting…";

  if (jobPoller) clearInterval(jobPoller);

  jobPoller = setInterval(async () => {
    const r = await fetch(`/api/job-status/${projectId}`);
    const j = await r.json();

    progressBar.style.width = j.progress + "%";
    progressText.textContent =
      `${j.progress}% — ${j.status}`;

    if (j.progress >= 100) {
      clearInterval(jobPoller);
      progressText.textContent = "✅ Completed";
    }
  }, 2000);
}

//  Load Subtitle Editor Button
loadSubsBtn.onclick = async () => {
  if (!currentProjectId) return alert("No project");

  const r = await fetch(
    `/api/subtitle/${currentUid}/${currentProjectId}`
  );

  if (!r.ok) return alert("No subtitles yet");

  subtitleEditor.value = await r.text();
};

//  Save Subtitles Editor Button 
saveSubsBtn.onclick = async () => {
  await fetch("/api/subtitle-save", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId,
      content: subtitleEditor.value
    })
  });

  alert("Subtitles saved");
};

//  Publish Button
publishBtn.onclick = async () => {
  if (!currentProjectId) return alert("No project");

  const r = await fetch("/api/publish", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId
    })
  });

  const data = await r.json();

  if (!data.success) return alert(data.error);

  const fullUrl = location.origin + data.url;
  prompt("Share this link:", fullUrl);
};

//  Usage Status
async function loadUsage() {
  if (!currentUid || !usageStatus) return;

  const r = await fetch(`/api/usage/${currentUid}`);
  const j = await r.json();

  usageStatus.textContent =
    `📊 Today: ${j.used} / ${j.limit} renders`;
}

// STITCH BUTTON HANDLER 
const stitchBtn = document.getElementById("stitchBtn");

stitchBtn.onclick = async () => {
  if (!currentProjectId) return alert("No project");

  const r = await fetch("/api/stitch", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      uid: currentUid,
      projectId: currentProjectId,
      transition: sceneTransition.value
    })
  });

  const data = await r.json();

  if (!data.success) return alert(data.error);

  videoPlayer.src = data.file + "?t=" + Date.now();
};

// ===============================
// 🔐 AUTH GUARD
// ===============================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (!isLoggingOut) alert("❌ Please login first!");
    window.location.href = "index.html";
    return;
  }

  currentUid = user.uid;
  if (currentUid) loadUsage();
  console.log("MY UID:", user.uid);

  const userRef = ref(db, `users/${user.uid}`);

  onValue(userRef, (snap) => {
    userPlan = snap.val()?.plan || "free";
    isPremium = DEV_MODE ? true : (userPlan === "premium");
    planStatus.textContent = `🪪 Plan: ${userPlan.toUpperCase()}`;
    planStatus.textContent += " | UID: " + user.uid;
    
    loadProjects();
  });
});

// ===============================
// 🔊 VOICE GENERATION
// ===============================
generateBtn.onclick = async () => {
  const text = scriptInput.value.trim();
  if (!text) return alert("Enter script first");

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      text,
      voiceId: isPremium ? "en-US-Wavenet-D" : "en-US-Standard-B",
      projectId: currentProjectId,
      uid: currentUid,
      sceneId: currentSceneId,
    })
  });

  const data = await res.json();
  if (!data.success) return alert("TTS failed");
  currentProjectId = data.projectId;
  projectLabel.textContent = "📁 Project: " + currentProjectId;
  localStorage.setItem("sharpvid_project", currentProjectId);
  
  audioPlayer.src = data.file + "?t=" + Date.now();
  audioPlayer.play();
  downloadBtn.disabled = false;
  localStorage.removeItem(SCRIPT_KEY);
};

// ===============================
// ⬇️ DOWNLOAD AUDIO
// ===============================
downloadBtn.onclick = () => {
  if (!currentProjectId) return;

  const a = document.createElement("a");
  a.href = audioPlayer.src;
  a.download = "voice.mp3";
  a.click();
};

// ===============================
// 📤 SLIDE UPLOAD
// ===============================
uploadSlidesBtn.onclick = async () => {
  if (!slideUpload.files.length) return alert("Select slides");

  const fd = new FormData();
  for (let f of slideUpload.files) fd.append("slides", f);

  if (currentProjectId) {
  fd.append("projectId", currentProjectId);
  }

  fd.append("sceneId", currentSceneId);
  fd.append("uid", currentUid);
  const res = await fetch("/api/upload", { method:"POST", body: fd });
  const data = await res.json();

  if (!data.success) return alert("Upload failed");
  currentProjectId = data.projectId;
  projectLabel.textContent = "📁 Project: " + currentProjectId;
  localStorage.setItem("sharpvid_project", currentProjectId);

  slidePreview.innerHTML = "";
  data.files.forEach(url=>{
    const img = document.createElement("img");
    img.src = url;
    img.draggable = true;
    img.classList.add("draggable-slide");

    img.addEventListener("dragstart", onDragStart);
    img.addEventListener("dragover", onDragOver);
    img.addEventListener("drop", onDrop);

    slidePreview.appendChild(img);
    buildTimelineEditor();
  });

  alert("Slides uploaded");
};

// ===============================
// 🎵 MUSIC UPLOAD
// ===============================
musicUpload.addEventListener("change", async () => {
  if (!isPremium) return openUpgradeModal();

  const fd = new FormData();
  fd.append("music", musicUpload.files[0]);

  fd.append("sceneId", currentSceneId);
  fd.append("uid", currentUid);

  const res = await fetch("/api/upload-music",{method:"POST",body:fd});
  const data = await res.json();

  if (!data.success) return alert("Music upload failed");

  bgMusicPath = data.file;
  musicSelected = true;
  alert("Music uploaded");
});

musicUploadBox.onclick = () => {
  if (!isPremium) return openUpgradeModal();
  musicUpload.click();
};

// ===============================
// 🎬 VIDEO GENERATION
// ===============================

// Queue Render Setup
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

// Add To Queue
addQueueBtn.onclick = () => {

  if (!currentProjectId) return alert("No project");

  renderQueue.push(buildVideoPayload());
  drawQueue();

  if (!queueRunning) runNextInQueue();
};

// Next In Queue
async function runNextInQueue() {

  if (!renderQueue.length) {
    queueRunning = false;
    return;
  }

  queueRunning = true;

  const job = renderQueue[0];

  progressBar.style.width = "0%";
  progressText.textContent = "Queued…";

  startJobMonitor(job.projectId);

  const res = await fetch("/api/video", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(job)
  });

  const data = await res.json();

  if (data.success) {
    videoPlayer.src = data.file + "?t=" + Date.now();
  }

  renderQueue.shift();
  drawQueue();

  runNextInQueue();
}

// Queue UI Drawer
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

// Generate Video Button 
  generateVideoBtn.onclick = async () => {

  // 🛡 Project Integrity Guard (frontend)
  if (!currentProjectId) {
    return alert("No project yet — upload slides first");
  }

  if (!slidePreview.children.length) {
    return alert("Upload slides before generating video");
  }

  if (!audioPlayer.src) {
    return alert("Generate voice audio first");
  }

  if (!isPremium && musicSelected) {
    return openUpgradeModal();
  }

  // 💰 Karaoke premium gate (frontend UX)
  if (!isPremium && captionMode.value === "karaoke") {
    return openUpgradeModal();
  }

  alert("Generating video...");

  // 📊 reset progress bar UI
  progressBar.style.width = "0%";
  progressText.textContent = "Queued…";

    // 🧵 Queue system handles rendering now
    renderQueue.push(buildVideoPayload());
    drawQueue();

    if (!queueRunning) runNextInQueue();
    };

// ===============================
// ➕ FAB MENU
// ===============================
fabMain.onclick = ()=>{
  fabMenu.style.display =
    fabMenu.style.display === "flex" ? "none" : "flex";
};

fabSlides.onclick = ()=> slideUpload.click();
fabMusic.onclick = ()=> musicUpload.click();

fabVoice.onclick = ()=>{
  if (!isPremium) return openUpgradeModal();
  alert("Voice upload coming next phase");
};

// ===============================
// 💎 PREMIUM MODAL
// ===============================
function openUpgradeModal(){
  document.getElementById("upgradeModal")
    .classList.remove("hidden");
}
function closeUpgradeModal(){
  document.getElementById("upgradeModal")
    .classList.add("hidden");
}

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

const exportAllBtn = document.getElementById("exportAllBtn");

exportAllBtn.onclick = () => {

  if (!currentProjectId) {
    alert("No project loaded");
    return;
  }

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

  if (!queueRunning) runNextInQueue();

  alert("📦 Batch export queued");
};

// ===============================
// ⚡ EXPORT PRESETS
// ===============================
function applyPreset(type){

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

window.applyPreset = applyPreset;

// ===============================
// 🚪 LOGOUT
// ===============================
logoutBtn.onclick = ()=>{
  isLoggingOut = true;
  localStorage.removeItem("sharpvid_project");
  localStorage.removeItem(SCRIPT_KEY);
  signOut(auth).then(()=>location.href="index.html");
};

window.loadProjects = loadProjects;