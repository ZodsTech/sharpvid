process.on("uncaughtException", err => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED PROMISE:", err);
});

import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });
import { exec } from "child_process";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

/* ===============================
   🔐 Firebase Admin Init
================================= */
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://sharpvid-af7ed-default-rtdb.firebaseio.com"
});

const adb = admin.database();

/* ===============================
   🔹 Path Setup (ESM Safe)
================================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 👤 Avatar Directory (Global - Declare Once)
const avatarDir = path.join(__dirname, "public", "uploads", "avatars");

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

/* ===============================
   🔹 App Setup
================================= */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===============================
   📁 PROJECT ROOT (MUST BE ABOVE MULTER)
================================= */
const projectsRoot = path.join(__dirname, "public", "projects");

if (!fs.existsSync(projectsRoot)) {
  fs.mkdirSync(projectsRoot, { recursive: true });
}

function makeProjectId() {
  return "p_" + Date.now();
}

const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

//const fs = require("fs");
//const path = require("path");

/* ===============================
   🛠 SharpVid DEV MODE SWITCH
================================= */
const DEV_MODE = true; // ← turn OFF later for production
const ADMIN_UID = "PASTE_YOUR_UID_HERE";

console.log("✅ API KEY Loaded:", GOOGLE_API_KEY ? "YES" : "NO");

/* ===============================
   📊 SharpVid Job Monitor Store
================================= */
const jobStore = new Map();

function setJob(projectId, status, progress) {

  const jobData = {
    status,
    progress,
    ts: Date.now()
  };

  jobStore.set(projectId, jobData);

  // 🔥 Persist to disk
  try {
    const jobDir = path.join(projectsRoot, projectId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    const jobFile = path.join(jobDir, "job.json");

    fs.writeFileSync(
      jobFile,
      JSON.stringify(jobData, null, 2)
    );

  } catch (err) {
    console.error("Job persistence failed:", err);
  }
}

// 🔄 Reload jobs on startup
try {
  const users = fs.readdirSync(projectsRoot);

  users.forEach(uid => {
    const userDir = path.join(projectsRoot, uid);

    if (!fs.statSync(userDir).isDirectory()) return;

    const projects = fs.readdirSync(userDir);

    projects.forEach(pid => {
      const jobFile = path.join(userDir, pid, "job.json");

      if (fs.existsSync(jobFile)) {
        const data = JSON.parse(fs.readFileSync(jobFile));
        jobStore.set(pid, data);
      }
    });
  });

  console.log("🔄 JobStore restored from disk");

} catch (err) {
  console.warn("JobStore reload skipped:", err.message);
}
/* ===============================
   📊 SharpVid Usage Limits Store
================================= */
const usageStore = new Map();

function getTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}

async function checkAndUseQuota(uid, isPremium) {
  
  if (DEV_MODE) return { ok: true };
  
  const key = getTodayKey();
  
  const refPath = `users/${uid}/usage/${key}`;
  
  const snap = await adb.ref(refPath).get();
  
  const used = snap.exists() ? snap.val() : 0;
  
  const limit = isPremium ? 50 : 3;
  
  if (used >= limit) return { ok: false, limit };
  
  await adb.ref(refPath).set(used + 1);
  
  return { ok: true, remaining: limit - used - 1 };
  
}

// ===============================
// 💾 PROJECT STATE SAVE ENGINE
// ===============================
function saveProjectState(uid, projectId, state) {

  const projectRoot = path.join(getUserRoot(uid), projectId);

  if (!fs.existsSync(projectRoot)) {
    fs.mkdirSync(projectRoot, { recursive: true });
  }

  const file = path.join(projectRoot, "project.json");

  fs.writeFileSync(
    file,
    JSON.stringify({
      ...state,
      updatedAt: Date.now()
    }, null, 2)
  );
}

// ===============================
// 📂 LOAD PROJECT STATE
// ===============================
function loadProjectState(uid, projectId) {

  const file = path.join(
    getUserRoot(uid),
    projectId,
    "project.json"
  );

  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf-8")
    );
  } catch (err) {
    console.error("Project JSON corrupted:", err);
    return null;
  }
}

// ===============================
// 💾 MANUAL PROJECT STATE SAVE
// ===============================
app.post("/api/project-state", (req, res) => {

  const {
    uid,
    projectId,
    state
  } = req.body;

  if (!uid || !projectId || !state) {
    return res.status(400).json({
      success: false,
      error: "Invalid payload"
    });
  }

  try {

    saveProjectState(uid, projectId, state);

    res.json({ success: true });

  } catch (err) {

    console.error("Project state save error:", err);

    res.status(500).json({
      success: false,
      error: "State save failed"
    });
  }

});

/* ===============================
   🔗 Share Link Store
================================= */
const shareStore = new Map();

function makeShareId() {
  return "s_" + Math.random().toString(36).slice(2, 10);
}

/* ===============================
   💳 STRIPE CHECKOUT SESSION
================================= */
import Stripe from "stripe";

let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log("💳 Stripe initialized");
} else {
  console.log("⚠ Stripe not configured (no secret key)");
}

app.post("/api/create-checkout-session", async (req, res) => {
  
  // ✅ MUST BE INSIDE ROUTE
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }
  
  try {
    
    const { uid, plan } = req.body;
    
    const priceId =
      plan === "yearly" ?
      process.env.STRIPE_YEARLY_PRICE :
      process.env.STRIPE_MONTHLY_PRICE;
    
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        { price: priceId, quantity: 1 }
      ],
      success_url: `${process.env.BASE_URL}/dashboard.html?success=1`,
      cancel_url: `${process.env.BASE_URL}/dashboard.html?canceled=1`,
      metadata: { uid },
      subscription_data: {
        metadata: { uid }
      }
    });
    
    res.json({ url: session.url });
    
  } catch (err) {
    
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Stripe error" });
    
  }
  
});

/* =====================
   💳 STRIPE WEBHOOK
=======================*/

app.post("/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 🎉 Subscription successful
    if (event.type === "checkout.session.completed") {

      const session = event.data.object;
      const uid = session.metadata.uid;

      if (uid) {
        await adb.ref(`users/${uid}/plan`).set("premium");
        console.log("✅ User upgraded to Premium:", uid);
      }
    }

    // ❌ Subscription canceled
    if (event.type === "customer.subscription.deleted") {

      const subscription = event.data.object;
      const uid = subscription.metadata?.uid;

      if (uid) {
        await adb.ref(`users/${uid}/plan`).set("free");
        console.log("⚠ User downgraded to Free:", uid);
      }
    }

    res.json({ received: true });
});

/* ===============================
   📤 PROJECT SLIDE UPLOAD
================================= */
const slideStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId || makeProjectId();
    const uid = req.body.uid || "anon";

    req.projectId = projectId;
    req.uid = uid;

    const sceneId = req.body.sceneId || "s1";

const dir = path.join(
  getSceneRoot(uid, projectId, sceneId),
  "slides"
);

    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const uploadSlides = multer({ storage: slideStorage });

app.post("/api/upload", uploadSlides.array("slides", 50), (req, res) => {
  const projectId = req.projectId;

  res.json({
    success: true,
    projectId,
    files: req.files.map(
      f => `/projects/${req.uid}/${projectId}/slides/${f.filename}`
    ),
  });
});

/* ===============================
   🎵 BACKGROUND MUSIC UPLOAD
================================= */
const musicDir = path.join(__dirname, "public", "uploads", "music");

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

const musicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId;
    const uid = req.body.uid || "anon";
    const sceneId = req.body.sceneId || "s1";

    const dir = path.join(
      getSceneRoot(uid, projectId, sceneId),
      "music"
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const uploadMusic = multer({ storage: musicStorage });

app.post("/api/upload-music", uploadMusic.single("music"), (req, res) => {
  const projectId = req.body.projectId;

  res.json({
    success: true,
    projectId,
    file: `/projects/${req.body.uid}/${projectId}/music/${req.file.filename}`
  });
});

/* ===============================
   🔊 TEXT TO SPEECH ENDPOINT
================================= */
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    console.log("📩 TTS Request received...");

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "en-US",
            name: voiceId || "en-US-Standard-B",
          },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    const data = await response.json();

    if (!data.audioContent) {
      console.error("❌ Google TTS Error:", data);
      return res.status(400).json({ error: "TTS failed" });
    }

    const uid = req.body.uid || "anon";
    const projectId = req.body.projectId || makeProjectId();
    const sceneId = req.body.sceneId || "s1";

    const audioDir = path.join(
      getSceneRoot(uid, projectId, sceneId),
      "audio"
    );
    fs.mkdirSync(audioDir, { recursive: true });


    fs.writeFileSync(
      path.join(audioDir, "voice.mp3"),
      Buffer.from(data.audioContent, "base64")
    );

    console.log("✅ Voice saved!");

    res.json({
      success: true,
      projectId,
    file: `/projects/${uid}/${projectId}/scenes/${sceneId}/audio/voice.mp3`});

  } catch (err) {
    console.error("❌ TTS Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 👩‍✈️ AI Script Assistant 
app.post("/api/script-assist", (req,res)=>{

  const {
    topic,
    mode,
    tone,
    audience,
    length,
    baseText
  } = req.body;

  const lengthGuide = {
    short: "about 80 words",
    medium: "about 150 words",
    long: "about 300 words"
  };

  let text = "";

  if (mode === "starter") {
    text =
`Create a ${tone} ${lengthGuide[length]} script for ${audience}
about: ${topic}. Start with a strong hook.`;
  }

  if (mode === "rewrite") {
    text =
`Rewrite this script in a ${tone} style for ${audience}:
${baseText}`;
  }

  if (mode === "continue") {
    text =
`${baseText}
Continue this script in a ${tone} tone for ${audience}.`;
  }

  // mock response for now
  res.json({
    success:true,
    text:
`[AI GENERATED — ${tone} / ${audience} / ${length}]
${topic || "Your topic"} — scripted output goes here.`
  });

});

/* ===============================
   🎬 VIDEO + SUBTITLE ENDPOINT
================================= */
app.post("/api/video", async (req, res) => {
  try {
    console.log("🎬 Generating slideshow + subtitles...");

    /* ===============================
       🔐 BASIC INPUTS
    ================================= */
    const projectId = req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId" });
    }

    const uid = req.body.uid || "anon";
    const sceneId = req.body.sceneId || "s1";

    const mode = req.body.mode || "srt";
    const format = req.body.format || "landscape";
    const bgMusic = req.body.bgMusic || null;
    const duck = parseFloat(req.body.duck || 0.25);
    const style = req.body.subtitleStyle || {};

    /* ================
   💾 Persist Project State
       ================*/
try {

  saveProjectState(uid, projectId, {
    slideDurations: style.slideDurations || [],
    sceneDurations: style.sceneDurations || {},
    format,
    captionMode: mode,
    transition: req.body.transition || "fade",
    subtitleStyle: style,
    bgMusic: bgMusic || null,
    musicSelected: !!bgMusic
  });

  console.log("💾 Project state saved");

} catch (persistErr) {

  console.error("⚠ Project state save failed:", persistErr);

  // do NOT crash render
}

    /* ===============================
       🛑 PREVENT DOUBLE RENDER
    ================================= */
    if (jobStore.get(projectId)?.status === "rendering video") {
      return res.status(409).json({
        error: "Render already in progress"
      });
    }

    /* ===============================
       🔐 SECURE BILLING CHECK
    ================================= */
    let userPlan = await getUserPlan(uid);

    if (DEV_MODE || uid === ADMIN_UID) {
      userPlan = "premium";
    }

    const isPremium = userPlan === "premium";

    if (mode === "karaoke" && !isPremium) {
  return res.status(403).json({
    error: "Karaoke mode is Premium only."
  });
}

    const premiumOptionsUsed =
      !!bgMusic || mode === "karaoke";

    if (!isPremium && premiumOptionsUsed) {
      return res.status(403).json({
        error: "Premium feature used — please upgrade."
      });
    }

    /* ===============================
       📊 QUOTA CHECK
    ================================= */
    const quota = await checkAndUseQuota(uid, isPremium);
    if (!quota.ok) {
      return res.status(429).json({
        error: `Daily limit reached (${quota.limit}/day). Upgrade for more.`
      });
    }

    /* ===============================
       📁 SCENE ROOT
    ================================= */
    const sceneRoot = getSceneRoot(uid, projectId, sceneId);

    const slideDir = path.join(sceneRoot, "slides");
    const audioPath = path.join(sceneRoot, "audio", "voice.mp3");
    const videoDir = path.join(sceneRoot, "videos");
    const subtitleDir = path.join(sceneRoot, "subtitles");

    ensureDirSafe(sceneRoot);
    ensureDirSafe(slideDir);
    ensureDirSafe(path.join(sceneRoot, "audio"));
    ensureDirSafe(videoDir);
    ensureDirSafe(subtitleDir);

    const outputVideo = path.join(videoDir, "final_video.mp4");
    const outputSRT = path.join(subtitleDir, "final_subtitles.srt");

    /* ===============================
       📐 RESOLUTION
    ================================= */
    let width = isPremium ? 1920 : 1280;
    let height = isPremium ? 1080 : 720;

    if (format === "vertical") {
      width = 720;
      height = 1280;
    }

    console.log("📐 Format:", format, `${width}x${height}`);

    /* ===============================
       📸 LOAD SLIDES + ORDER
    ================================= */
    if (!fs.existsSync(slideDir)) {
      return res.status(400).json({
        error: "No slides uploaded for this scene"
      });
    }

    let slideFiles = safeReadDir(slideDir)
      .filter(f => f.endsWith(".jpg") || f.endsWith(".png"));

    const order = req.body.slideOrder;

    if (Array.isArray(order) && order.length) {
      slideFiles = order.filter(f => slideFiles.includes(f));
    }

    const slides = slideFiles.map(f =>
      path.join(slideDir, f)
    );

    if (slides.length < 1) {
      return res.status(400).json({
        error: "Upload at least one slide"
      });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({
        error: "Voice audio missing — generate narration first"
      });
    }

    setJob(projectId, "slides loaded", 15);

    /* ===============================
       🎧 AUDIO DURATION
    ================================= */
    const durationCmd =
      `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`;

    exec(durationCmd, (err, stdout) => {
      if (err) {
        return res.status(500).json({ error: "Cannot read audio duration" });
      }

      const audioDuration = parseFloat(stdout.trim());

      if (!isPremium && audioDuration > 60) {
        return res.status(403).json({
          error: "Free tier max video length is 60 seconds"
        });
      }

      const customDurations = style.slideDurations;
      let durations;

      if (Array.isArray(customDurations) &&
          customDurations.length === slides.length) {

        durations = customDurations.map(d => parseFloat(d) || 3);

      } else {
        const auto = audioDuration / slides.length;
        durations = slides.map(() => auto);
      }

      setJob(projectId, "audio analyzed", 25);

      /* ===============================
         🎬 BUILD INPUTS
      ================================= */
      let inputs = "";
      slides.forEach((img, i) => {
        inputs += `-loop 1 -t ${durations[i]} -i "${img}" `;
      });

      let audioInputArgs = `-i "${audioPath}"`;
      let audioMap = `-map ${slides.length}:a`;

      if (bgMusic) {
        const musicPath = path.join(__dirname, "public", bgMusic);
        if (!fs.existsSync(musicPath)) {
          return res.status(400).json({ error: "Music file missing on server" });
        }

        audioInputArgs =
          `-i "${audioPath}" -i "${musicPath}"`;

        audioMap =
          `-filter_complex "` +
          `[1:a]volume=0.6,aloop=loop=-1:size=2e+09[m];` +
          `[m][0:a]sidechaincompress=` +
          `threshold=${duck}:ratio=8:attack=20:release=300[mduck];` +
          `[0:a][mduck]amix=inputs=2:dropout_transition=2[a]" ` +
          `-map "[a]"`;
      }

      /* ===============================
         🎞 VIDEO FILTER + TRANSITIONS
      ================================= */
      let filterChain = "";
      slides.forEach((_, i) => {
        filterChain +=
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
          `crop=${width}:${height},` +
          `zoompan=z='min(zoom+0.001,1.08)':d=125:s=${width}x${height}[z${i}];`;
      });

      let fades = "";
      for (let i = 0; i < slides.length - 1; i++) {
        const offset =
          durations.slice(0, i + 1).reduce((a,b)=>a+b,0) - 1;

        if (i === 0) {
          fades += `[z0][z1]xfade=fade:duration=1:offset=${offset}[v1];`;
        } else {
          fades += `[v${i}][z${i + 1}]xfade=fade:duration=1:offset=${offset}[v${i + 1}];`;
        }
      }

      const lastVid = `v${slides.length - 1}`;
      let finalVideoLabel = lastVid;

      let watermarkFilter = "";

      if (!isPremium) {
        const wmPath = path.join(__dirname, "public", "watermark.png");
        watermarkFilter =
          `;movie=${wmPath}[wm];` +
          `[${lastVid}][wm]overlay=W-w-20:H-h-20[vout]`;
        finalVideoLabel = "vout";
      }

      const videoCmd =
        `ffmpeg -y ` +
        inputs +
        `${audioInputArgs} ` +
        `-filter_complex "${filterChain}${fades}${watermarkFilter}" ` +
        `-map "[${finalVideoLabel}]" ${audioMap} ` +
        `-c:v libx264 -preset veryfast -crf 23 ` +
        `-pix_fmt yuv420p -movflags +faststart ` +
        `-c:a aac -shortest "${outputVideo}"`;

      setJob(projectId, "rendering video", 55);

      exec(videoCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(stderr);
          return res.status(500).json({ error: "FFmpeg render failed" });
        }

        setJob(projectId, "video done", 75);

        /* ===============================
           🎯 WHISPER SUBTITLES
        ================================= */
        const whisperCmd =
          `whisper "${audioPath}" --model small ` +
          `--output_format srt --output_dir "${subtitleDir}"`;

        exec(whisperCmd, (err2) => {
          if (err2)
            return res.status(500).json({ error: "Whisper subtitle failed" });

          const whisperFile = path.join(subtitleDir, "voice.srt");
          if (fs.existsSync(whisperFile)) {
            fs.renameSync(whisperFile, outputSRT);
          }

          /* ===============================
             🎤 KARAOKE MODE (RESTORED + PREMIUM STYLE)
          ================================= */
          if (mode === "karaoke") {
            console.log("🎤 Karaoke Mode ON...");

            const whisperJsonCmd =
              `whisper "${audioPath}" --model small ` +
              `--task transcribe ` +
              `--output_format json ` +
              `--word_timestamps True ` +
              `--output_dir "${subtitleDir}"`;

            exec(whisperJsonCmd, (errJson) => {
              if (errJson)
                return res.status(500).json({ error: "Karaoke JSON generation failed" });

              const jsonFile = path.join(subtitleDir, "voice.json");

              if (!fs.existsSync(jsonFile)) {
                return res.status(500).json({ error: "Whisper JSON missing" });
              }

              let jsonData;
              try {
                jsonData = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
              } catch (e) {
                return res.status(500).json({ error: "Invalid JSON format" });
              }

              const assFile = path.join(subtitleDir, "karaoke.ass");
              const karaokeVideo = path.join(videoDir, "final_karaoke.mp4");

              // ===============================
              // 🎨 PREMIUM STYLE ENGINE
              // ===============================

              const karaokeFontSize =
                format === "vertical"
                  ? (isPremium ? 36 : 28)
                  : (isPremium ? 48 : 36);

              const karaokeMarginV =
                format === "vertical"
                  ? (isPremium ? 260 : 220)
                  : (isPremium ? 120 : 90);

              const primaryColor = "&H00FFFFFF";       // white
              const highlightColor = "&H0000FFFF";     // cyan highlight

              const outlineColor = isPremium
                ? "&H00000000"   // deep black
                : "&H00000000";

              const backColor = isPremium
                ? "&H40000000"   // stronger semi-transparent box
                : "&H20000000";  // lighter box

              const outlineSize = isPremium ? 3 : 1;
              const shadow = isPremium ? 2 : 0;

              let assContent = `
          [Script Info]
          Title=SharpVid Karaoke
          ScriptType=v4.00+
          PlayResX=${width}
          PlayResY=${height}

          [V4+ Styles]
          Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

          Style: Karaoke,Arial,${karaokeFontSize},${primaryColor},${highlightColor},${outlineColor},${backColor},0,0,1,${outlineSize},${shadow},2,40,40,${karaokeMarginV},1

          [Events]
          Format: Layer, Start, End, Style, Text
          `;

              jsonData.segments.forEach((seg) => {
                if (!seg.words) return;

                let karaokeLine = "";

                seg.words.forEach((w) => {
                  const word = w.word.trim();
                  const wordDuration = (w.end - w.start) * 100;

                  karaokeLine += `{\\k${Math.floor(wordDuration)}}${word} `;
                });

                assContent += `Dialogue: 0,${secToASS(seg.start)},${secToASS(
                  seg.end
                )},Karaoke,${karaokeLine.trim()}\n`;
              });

              try {
                fs.writeFileSync(assFile, assContent);
              } catch (e) {
                return res.status(500).json({ error: "ASS file write failed" });
              }

              // ===============================
              // 🔥 Burn ASS to video
              // ===============================

              const burnCmd =
                `ffmpeg -y -i "${outputVideo}" ` +
                `-vf "ass=${assFile}" ` +
                `-c:a copy "${karaokeVideo}"`;

              exec(burnCmd, (errBurn) => {
                if (errBurn)
                  return res.status(500).json({ error: "Karaoke burn failed" });

                setJob(projectId, "completed", 100);

                setTimeout(() => {

  jobStore.delete(projectId);

  try {
    const jobFile = path.join(projectsRoot, projectId, "job.json");

    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }

  } catch (err) {
    console.error("Job cleanup failed:", err);
  }

}, 15000);

                return res.json({
                  success: true,
                  file: `/projects/${uid}/${projectId}/scenes/${sceneId}/videos/final_karaoke.mp4`,
                  subtitles: `/projects/${uid}/${projectId}/scenes/${sceneId}/subtitles/karaoke.ass`
                });
              });
            });

            return;
          }

          /* ===============================
             🔥 BURN MODE
          ================================= */
          if (mode === "burn") {
            const burnedVideo = path.join(videoDir, "final_burned.mp4");

            const editedSRT = path.join(subtitleDir, "edited.srt");
            const useSRT = fs.existsSync(editedSRT) ? editedSRT : outputSRT;

            const styleStr =
              `Fontsize=${style.fontSize || 42},` +
              `Alignment=${style.align || 2},` +
              `MarginV=${style.marginV || 160},` +
              `Outline=${style.outline || 2}`;

            const burnCmd =
              `ffmpeg -y -i "${outputVideo}" ` +
              `-vf "subtitles=${useSRT}:force_style='${styleStr}'" ` +
              `-c:a copy "${burnedVideo}"`;

            exec(burnCmd, (err3) => {
              if (err3)
                return res.status(500).json({ error: "Burn failed" });

              setJob(projectId, "completed", 100);

              return res.json({
                success: true,
                file: `/projects/${uid}/${projectId}/scenes/${sceneId}/videos/final_burned.mp4`,
                subtitles: `/projects/${uid}/${projectId}/scenes/${sceneId}/subtitles/final_subtitles.srt`
              });
            });

            return;
          }

          /* ===============================
             📄 DEFAULT SRT EXPORT
          ================================= */
          setJob(projectId, "completed", 100);

          return res.json({
            success: true,
            file: `/projects/${uid}/${projectId}/scenes/${sceneId}/videos/final_video.mp4`,
            subtitles: `/projects/${uid}/${projectId}/scenes/${sceneId}/subtitles/final_subtitles.srt`
          });

        }); // whisper
      }); // ffmpeg
    }); // duration

  } catch (err) {
    console.error("🔥 Video Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   🎬 CINEMATIC STITCH ENDPOINT
================================= */
app.post("/api/stitch", async (req, res) => {
  try {
    const { uid, projectId, sceneOrder, transition } = req.body;

    if (!uid || !projectId) {
      return res.status(400).json({ error: "Missing uid or projectId" });
    }

    if (!Array.isArray(sceneOrder) || sceneOrder.length < 1) {
      return res.status(400).json({ error: "No scenes to stitch" });
    }

    if (jobStore.get(projectId)?.status === "stitching") {
      return res.status(409).json({
        error: "Stitch already in progress"
      });
    }

    setJob(projectId, "stitching", 10);

    const projectRoot = getUserRoot(uid);
    const outputDir = path.join(projectRoot, projectId, "stitched");
    ensureDirSafe(outputDir);

    const outputPath = path.join(outputDir, "final_stitched.mp4");

    // ===============================
    // 🎞 Collect Scene Videos
    // ===============================
    const sceneVideos = [];

    sceneOrder.forEach(sceneId => {
      const p = path.join(
        projectRoot,
        projectId,
        "scenes",
        sceneId,
        "videos",
        "final_video.mp4"
      );

      if (fs.existsSync(p)) {
        sceneVideos.push(p);
      }
    });

    if (sceneVideos.length < 1) {
      return res.status(400).json({
        error: "No rendered scene videos found"
      });
    }

    // ===============================
    // 🎬 SIMPLE CUT MODE
    // ===============================
    if (!transition || transition === "cut") {

      const listFile = path.join(outputDir, "concat.txt");

      const listContent = sceneVideos
        .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
        .join("\n");

      fs.writeFileSync(listFile, listContent);

      const concatCmd =
        `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;

      exec(concatCmd, (err) => {
        if (err) {
          return res.status(500).json({ error: "Concat failed" });
        }

        setJob(projectId, "completed", 100);
        setTimeout(() => {

  jobStore.delete(projectId);

  try {
    const jobFile = path.join(projectsRoot, projectId, "job.json");

    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }

  } catch (err) {
    console.error("Job cleanup failed:", err);
  }

}, 15000);

        return res.json({
          success: true,
          file: `/projects/${uid}/${projectId}/stitched/final_stitched.mp4`
        });
      });

      return;
    }

    // ===============================
    // 🎧 Get Scene Durations (CINEMATIC CORE)
    // ===============================
    const getDuration = (filePath) => {
      return new Promise((resolve, reject) => {
        const cmd =
          `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`;

        exec(cmd, (err, stdout) => {
          if (err) return reject(err);
          resolve(parseFloat(stdout.trim()));
        });
      });
    };

    const durations = [];

    for (let vid of sceneVideos) {
      const d = await getDuration(vid);
      durations.push(d);
    }

    // ===============================
    // 🎞 Build Transition Filter
    // ===============================
    let inputs = "";
    sceneVideos.forEach(v => {
      inputs += `-i "${v}" `;
    });

    let filter = "";

    const transitionType =
      transition === "dipblack" ? "fadeblack" :
      transition === "dissolve" ? "fade" :
      "fade";

    let cumulativeOffset = 0;

    for (let i = 0; i < sceneVideos.length - 1; i++) {

      const prevLabel = i === 0 ? `[0:v]` : `[v${i}]`;
      const nextLabel = `[${i + 1}:v]`;

      const transitionDuration = 1; // 1 sec cinematic fade

      cumulativeOffset += durations[i] - transitionDuration;

      filter +=
        `${prevLabel}${nextLabel}` +
        `xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${cumulativeOffset}[v${i + 1}];`;
    }

    const finalLabel =
      sceneVideos.length === 1
        ? "0:v"
        : `v${sceneVideos.length - 1}`;

    // ===============================
    // 🎞 Build Combined Video + Audio Filter
    // ===============================

    let videoFilter = "";
    let audioFilter = "";

    const transitionDuration = 1; // seconds

    for (let i = 0; i < sceneVideos.length - 1; i++) {

      const vPrev = i === 0 ? `[0:v]` : `[v${i}]`;
      const vNext = `[${i + 1}:v]`;

      const aPrev = i === 0 ? `[0:a]` : `[a${i}]`;
      const aNext = `[${i + 1}:a]`;

      cumulativeOffset += durations[i] - transitionDuration;

      // 🎬 Video xfade
      videoFilter +=
        `${vPrev}${vNext}` +
        `xfade=transition=fade:duration=${transitionDuration}:offset=${cumulativeOffset}[v${i + 1}];`;

      // 🎧 Audio acrossfade
      audioFilter +=
        `${aPrev}${aNext}` +
        `acrossfade=d=${transitionDuration}[a${i + 1}];`;
    }

    const finalVideoLabel =
      sceneVideos.length === 1 ? "0:v" : `v${sceneVideos.length - 1}`;

    const finalAudioLabel =
      sceneVideos.length === 1 ? "0:a" : `a${sceneVideos.length - 1}`;

    const stitchCmd =
      `ffmpeg -y ${inputs}` +
      `-filter_complex "${videoFilter}${audioFilter}" ` +
      `-map "[${finalVideoLabel}]" ` +
      `-map "[${finalAudioLabel}]" ` +
      `-c:v libx264 -crf 23 -preset veryfast ` +
      `-c:a aac -b:a 192k ` +
      `"${outputPath}"`;

    exec(stitchCmd, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Cinematic stitch failed" });
      }

      setJob(projectId, "completed", 100);
      setTimeout(() => {

  jobStore.delete(projectId);

  try {
    const jobFile = path.join(projectsRoot, projectId, "job.json");

    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }

  } catch (err) {
    console.error("Job cleanup failed:", err);
  }

}, 15000);

      return res.json({
        success: true,
        file: `/projects/${uid}/${projectId}/stitched/final_stitched.mp4`
      });
    });

  } catch (err) {
    console.error("🔥 Stitch Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   🛠 SharpVid Repair Helpers
================================= */
function ensureDirSafe(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (e) {
    console.error("Repair: cannot create dir:", dirPath, e.message);
    return false;
  }
}

function safeReadDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath);
  } catch (e) {
    console.error("Repair: cannot read dir:", dirPath, e.message);
    return [];
  }
}

// LIST SCENE HELPER
function listScenes(uid, projectId) {
  const scenesRoot = path.join(
    getUserRoot(uid),
    projectId,
    "scenes"
  );

  return safeReadDir(scenesRoot)
    .filter(n => n.startsWith("s"))
    .sort(); // s1, s2, s3 order
}

// 📂 Get User Root Directory
function getUserRoot(uid) {
  const userRoot = path.join(projectsRoot, uid || "anon");
  ensureDirSafe(userRoot);
  return userRoot;
   }

// GET SCENE ROOT
function getSceneRoot(uid, projectId, sceneId = "s1") {
  const dir = path.join(
    getUserRoot(uid),
    projectId,
    "scenes",
    sceneId
  );
  ensureDirSafe(dir);
  return dir;
}

// 🔐 Get User Plan (from Firebase + Trial Support)
async function getUserPlan(uid) {
  if (!uid) return "free";

  try {
    const snap = await adb.ref(`users/${uid}`).get();
    const data = snap.val() || {};

    // 🎁 7-Day Trial Logic
    if (data.trialStart) {
      const daysPassed =
        (Date.now() - data.trialStart) / (1000 * 60 * 60 * 24);

      if (daysPassed <= 7) {
        return "premium"; // trial active
      } else {
        // expire trial automatically
        await adb.ref(`users/${uid}`).update({
          trialStart: null,
          plan: "free"
        });
      }
    }

    return data.plan || "free";

  } catch (err) {
    console.error("Plan check error:", err);
    return "free";
  }
}

/* ===============================
   📂 List User Projects
================================= */
app.get("/api/projects/:uid", (req, res) => {
  const uid = req.params.uid || "anon";
  const userRoot = getUserRoot(uid);

  const projects = safeReadDir(userRoot)
    .filter(name => name.startsWith("p_"))
    .map(pid => {
      const pDir = path.join(userRoot, pid);
      const stats = fs.statSync(pDir);
      return {
        projectId: pid,
        created: stats.ctimeMs
      };
    })
    .sort((a,b) => b.created - a.created);

  res.json({ projects });
});

// ===============================
// 📁 FULL PROJECT RESTORE
// ===============================
app.get("/api/project/:uid/:projectId", (req, res) => {

  const { uid, projectId } = req.params;

  const projectRoot = path.join(getUserRoot(uid), projectId);

  if (!fs.existsSync(projectRoot)) {
    return res.status(404).json({
      success: false,
      error: "Project not found"
    });
  }

  const state = loadProjectState(uid, projectId);

  const scenesRoot = path.join(projectRoot, "scenes");

  const sceneIds = safeReadDir(scenesRoot)
    .filter(name => name.startsWith("s"))
    .sort();

  const slides = [];
  let audio = null;

  sceneIds.forEach(sceneId => {

    const sceneRoot = path.join(scenesRoot, sceneId);

    const slideDir = path.join(sceneRoot, "slides");
    const audioPath = path.join(sceneRoot, "audio", "voice.mp3");

    if (fs.existsSync(slideDir)) {
      const sceneSlides = safeReadDir(slideDir)
        .map(f =>
          `/projects/${uid}/${projectId}/scenes/${sceneId}/slides/${f}`
        );
      slides.push(...sceneSlides);
    }

    if (fs.existsSync(audioPath)) {
      audio =
        `/projects/${uid}/${projectId}/scenes/${sceneId}/audio/voice.mp3`;
    }
  });

  res.json({
    success: true,
    slides,
    audio,
    ...(state || {})
  });
});

/* ===============================
   ⏱ Helper: Seconds → ASS Time
================================= */
function secToASS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )}.${String(cs).padStart(2, "0")}`;
}

// Status endpoint for frontend progress

app.get("/api/job-status/:projectId", (req, res) => {

  const projectId = req.params.projectId;

  // 1️⃣ Check memory
  let job = jobStore.get(projectId);

  // 2️⃣ If not in memory, try disk restore
  if (!job) {

    try {
      const jobFile = path.join(projectsRoot, projectId, "job.json");

      if (fs.existsSync(jobFile)) {
        const raw = fs.readFileSync(jobFile, "utf-8");
        job = JSON.parse(raw);

        // restore into memory
        jobStore.set(projectId, job);
      }

    } catch (err) {
      console.error("Job restore failed:", err);
    }
  }

  if (!job) {
    return res.json({ status: "idle", progress: 0 });
  }

  res.json(job);
});

/* ===============================
   🗑 Delete Project
================================= */
app.delete("/api/project/:uid/:projectId", (req, res) => {
  const { uid, projectId } = req.params;
  const dir = path.join(getUserRoot(uid), projectId);

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: "Project not found" });
  }

  fs.rmSync(dir, { recursive: true, force: true });

  res.json({ success: true });
});

/* ===============================
   ✏ Rename Project
================================= */
app.post("/api/project-rename", (req, res) => {
  const { uid, oldId, newId } = req.body;

  if (!uid || !oldId || !newId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const userRoot = getUserRoot(uid);

  const oldPath = path.join(userRoot, oldId);
  const newPath = path.join(userRoot, newId);

  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ error: "Project not found" });
  }

  fs.renameSync(oldPath, newPath);

  res.json({ success: true });
});

/* ===============================
   📝 Get Subtitle File
================================= */
app.get("/api/subtitle/:uid/:projectId", (req, res) => {
  const { uid, projectId } = req.params;

  const subPath = path.join(
    getUserRoot(uid),
    projectId,
    "subtitles",
    "final_subtitles.srt"
  );

  if (!fs.existsSync(subPath)) {
    return res.status(404).json({ error: "No subtitles yet" });
  }

  res.send(fs.readFileSync(subPath, "utf8"));
});

/* ===============================
   💾 Save Edited Subtitle
================================= */
app.post("/api/subtitle-save", (req, res) => {
  const { uid, projectId, content } = req.body;

  if (!uid || !projectId || !content) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const savePath = path.join(
    getUserRoot(uid),
    projectId,
    "subtitles",
    "edited.srt"
  );

  fs.writeFileSync(savePath, content);
  res.json({ success: true });
});

/* ===============================
   🚀 Publish Project
================================= */
app.post("/api/publish", (req, res) => {
  const { uid, projectId } = req.body;

  const videoPath = path.join(
    getUserRoot(uid),
    projectId,
    "videos",
    "final_video.mp4"
  );

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "No video to publish" });
  }

  const shareId = makeShareId();

  shareStore.set(shareId, {
    uid,
    projectId
  });

  res.json({
    success: true,
    url: `/p/${shareId}`
  });
});

/* ===============================
   🌍 Public Viewer Page
================================= */
app.get("/p/:shareId", (req, res) => {
  const data = shareStore.get(req.params.shareId);

  if (!data) {
    return res.status(404).send("Invalid link");
  }

  const { uid, projectId } = data;

  const videoUrl =
    `/projects/${uid}/${projectId}/videos/final_video.mp4`;

  res.send(`
    <html>
      <head>
        <title>SharpVid Share</title>
      </head>
      <body style="background:#000;color:#fff;text-align:center">
        <h2>🎬 SharpVid Export</h2>
        <video controls width="80%" src="${videoUrl}"></video>
      </body>
    </html>
  `);
});

/* ===============================
   💳 Billing Upgrade Hook
================================= */
app.post("/api/billing-upgrade", async (req, res) => {
  const { uid } = req.body;

  if (!uid) return res.status(400).json({ error: "Missing uid" });

  await adb.ref(`users/${uid}/plan`).set("premium");

  res.json({ success: true });
});

/* ===============================
   🎁 Start 7-Day Trial
================================= */
app.post("/api/start-trial", async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }

  try {
    const snap = await adb.ref(`users/${uid}`).get();
    const data = snap.val() || {};

    // 🚫 Prevent multiple trials
    if (data.trialStart) {
      return res.status(400).json({
        error: "Trial already used"
      });
    }

    await adb.ref(`users/${uid}`).update({
      trialStart: Date.now(),
      plan: "premium"
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Trial error:", err);
    res.status(500).json({ error: "Trial activation failed" });
  }
});

/* ===============================
   👤 AVATAR UPLOAD ENDPOINT
================================= */
app.post("/api/upload-avatar", upload.single("avatar"), async (req, res) => {

  const uid = req.body.uid;

  if (!uid || !req.file) {
    return res.json({ success: false });
  }

  const avatarPath = `/uploads/avatars/${uid}.jpg`;

  // Save inside public/uploads/avatars
  fs.writeFileSync(
    path.join(avatarDir, `${uid}.jpg`),
    req.file.buffer
  );

  // Save URL in Firebase
  await admin.database()
    .ref(`users/${uid}`)
    .update({ avatarUrl: avatarPath });

  res.json({ success: true, url: avatarPath });

});

/* ===============================
   📓 PROJECT NOTEBOOK ENDPOINTS
================================= */

// Save Notebook
app.post("/api/notebook-save", (req, res) => {

  const { uid, projectId, content } = req.body;

  if (!uid || !projectId) {
    return res.status(400).json({ success:false });
  }

  const projectRoot = path.join(getUserRoot(uid), projectId);

  if (!fs.existsSync(projectRoot)) {
    return res.status(404).json({ success:false });
  }

  const file = path.join(projectRoot, "notebook.json");

  fs.writeFileSync(file, JSON.stringify({
    content: content || "",
    updatedAt: Date.now()
  }, null, 2));

  res.json({ success:true });
});


// Load Notebook
app.get("/api/notebook/:uid/:projectId", (req, res) => {

  const { uid, projectId } = req.params;

  const file = path.join(
    getUserRoot(uid),
    projectId,
    "notebook.json"
  );

  if (!fs.existsSync(file)) {
    return res.json({ content:"" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    res.json({ content: data.content || "" });
  } catch {
    res.json({ content:"" });
  }

});

/* ===============================
   📊 Usage Status Endpoint
================================= */
app.get("/api/usage/:uid", async (req, res) => {
  const uid = req.params.uid;
  if (!uid) return res.json({ used: 0, limit: 0 });

  const plan = DEV_MODE || uid === ADMIN_UID
    ? "premium"
    : await getUserPlan(uid);

  const isPremium = plan === "premium";
  const limit = isPremium ? 50 : 3;

  const key = uid + ":" + getTodayKey();
  const used = usageStore.get(key) || 0;

  res.json({ used, limit });
});

// 🌍 Root Test Route
app.get("/", (req, res) => {
  res.send("SharpVid API is running ✅");
});

/* ===============================
   🚀 START SERVER
================================= */
app.listen(PORT, () => {
  console.log(`✅ SharpVid backend running on port ${PORT}`);
});
