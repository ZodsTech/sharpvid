import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import multer from "multer";
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

/* ===============================
   🔹 App Setup
================================= */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.send("SharpVid API is running ✅");
    });

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
  jobStore.set(projectId, {
    status,
    progress,
    ts: Date.now()
  });
}

/* ===============================
   📊 SharpVid Usage Limits Store
================================= */
const usageStore = new Map();

function getTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}

function checkAndUseQuota(uid, isPremium) {
  if (DEV_MODE) return { ok: true };

  const key = uid + ":" + getTodayKey();

  const used = usageStore.get(key) || 0;
  const limit = isPremium ? 50 : 3;

  if (used >= limit) {
    return { ok: false, limit };
  }

  usageStore.set(key, used + 1);
  return { ok: true, remaining: limit - used - 1 };
}

/* ===============================
   🔗 Share Link Store
================================= */
const shareStore = new Map();

function makeShareId() {
  return "s_" + Math.random().toString(36).slice(2, 10);
}

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
    file: `/projects/${uid}/${projectId}/scenes/${sceneId}/audio/voice.mp3`
    });

  } catch (err) {
    console.error("❌ TTS Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   🎬 VIDEO + SUBTITLE ENDPOINT
================================= */
     app.post("/api/video", async (req, res) => {
          try {
            console.log("🎬 Generating slideshow + subtitles...");


            const mode = req.body.mode || "srt";
            const format = req.body.format || "landscape";
            const bgMusic = req.body.bgMusic || null;

    // ✅ Auto format switch
            let width = isPremium ? 1920 : 1280;
            let height = isPremium ? 1080 : 720;

    if (format === "vertical") {
      width = 720;
      height = 1280;
    }

    console.log("📐 Format:", format, `${width}x${height}`);
            
    // 🔐 Project Integrity Guard (backend)
            const projectId = req.body.projectId;
            if (!projectId) return res.status(400).json({ error: "Missing projectId" });

            setJob(projectId, "starting", 5);

            const uid = req.body.uid || "anon";
            const sceneId = req.body.sceneId || "s1";
const sceneRoot = getSceneRoot(uid, projectId, sceneId);

            // 🔐 secure billing plan check
            let userPlan = await getUserPlan(uid);

            if (DEV_MODE || uid === ADMIN_UID) {
              userPlan = "premium";
            }

            const isPremium = userPlan === "premium";
            
            const premiumOptionsUsed =
              !!bgMusic || mode === "karaoke";

            if (!isPremium && premiumOptionsUsed) {
              return res.status(403).json({
                error: "Premium feature used — please upgrade."
              });
            }

            // 🎨 subtitle style
            const style = req.body.subtitleStyle || {};

            const duck = parseFloat(req.body.duck || 0.25);

            // 📊 quota check
            const quota = checkAndUseQuota(uid, isPremium);

            if (!quota.ok) {
              return res.status(429).json({
                error: `Daily limit reached (${quota.limit}/day). Upgrade for more.`
              });
            }

            const slideDir = path.join(sceneRoot, "slides");
            const audioPath = path.join(sceneRoot, "audio", "voice.mp3");
            const videoDir = path.join(sceneRoot, "videos");
            const subtitleDir = path.join(sceneRoot, "subtitles");

            // 🛠 Repair-safe directory setup
            ensureDirSafe(projectDir);
            ensureDirSafe(slideDir);
            ensureDirSafe(path.join(projectDir, "audio"));
            ensureDirSafe(videoDir);
            ensureDirSafe(subtitleDir);

            const outputVideo = path.join(videoDir, "final_video.mp4");
            const outputSRT = path.join(subtitleDir, "final_subtitles.srt");

            
    // ✅ Load Unlimited Slides
              if (!fs.existsSync(slideDir)) {
                return res.status(400).json({
                  error: "No slides uploaded for this project"
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

            if (!fs.existsSync(audioPath)) {
              return res.status(400).json({
                error: "Voice audio missing — generate narration again"
              });
            }

    if (slides.length < 2)
      return res.status(400).json({
        error: "Upload at least 2 slides first",
      });

    console.log("✅ Slides found:", slides.length);
            setJob(projectId, "slides loaded", 15);

    /* ===============================
       🎧 Get Audio Duration
    ================================= */
    const durationCmd = `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`;

    exec(durationCmd, (err, stdout) => {
      if (err) {
        console.error("❌ ffprobe error:", err);
        return res.status(500).json({ error: "Cannot read duration" });
      }

      const audioDuration = parseFloat(stdout.trim());
      setJob(projectId, "audio analyzed", 25);
      
      // 💰 Free tier length cap
if (!isPremium && audioDuration > 60) {
  return res.status(403).json({
    error: "Free tier max video length is 60 seconds"
  });
}
      const customDurations = req.body.slideDurations;

      let durations;

      if (Array.isArray(customDurations) &&
          customDurations.length === slides.length) {

        durations = customDurations.map(d => parseFloat(d) || 3);

      } else {
        const auto = audioDuration / slides.length;
        durations = slides.map(() => auto);
      }

      console.log("🎧 Audio Duration:", audioDuration.toFixed(2));

      /* ===============================
         🎬 Build Slideshow Video
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

        // 🎙️ Ducking Effect 
      audioMap =
        `-filter_complex "` +
        `[1:a]volume=0.6,aloop=loop=-1:size=2e+09[m];` +
        `[m][0:a]sidechaincompress=` +
        `threshold=${duck}:ratio=8:attack=20:release=300[mduck];` +
        `[0:a][mduck]amix=inputs=2:dropout_transition=2[a]" ` +
        `-map "[a]"`;
      }
      
      // Smooth zoom animation (FULLSCREEN — No Black Bars)
      let filterChain = "";
      slides.forEach((_, i) => {
        filterChain +=
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
          `crop=${width}:${height},` +
          `zoompan=z='min(zoom+0.001,1.08)':d=125:s=${width}x${height}[z${i}];`;
      });

      // Fade transitions
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
          console.error("❌ FFmpeg Error:", stderr);
          return res.status(500).send(stderr);
        }

        console.log("✅ Video created!");
        setJob(projectId, "video done", 75);

        /* ===============================
           🎯 Whisper Subtitle Sync
        ================================= */
        const whisperCmd =
          `whisper "${audioPath}" --model small ` +
          `--output_format srt --output_dir "${subtitleDir}"`;
        
        setJob(projectId, "generating subtitles", 85);
        exec(whisperCmd, (err2) => {
          if (err2)
            return res.status(500).json({ error: "Whisper subtitle failed" });

          const whisperFile = path.join(subtitleDir, "voice.srt");
          if (fs.existsSync(whisperFile)) {
            try {
              fs.renameSync(whisperFile, outputSRT);
            } catch (e) {
              console.warn("Repair: subtitle rename skipped");
            }
          }

          console.log("✅ Subtitles synced!");

          /* ===============================
             🎤 Karaoke Mode
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
                return res.status(500).json({ error: "Karaoke failed" });

              const jsonFile = path.join(subtitleDir, "voice.json");
              const jsonData = JSON.parse(fs.readFileSync(jsonFile, "utf8"));

              const assFile = path.join(subtitleDir, "karaoke.ass");

              // ✅ Karaoke Font Size Auto-Fix
              const karaokeFontSize = format === "vertical" ? 28 : 36;
              const karaokeMarginV = format === "vertical" ? 220 : 90;

              let assContent = `
              [Script Info]
              Title=SharpVid Karaoke
              ScriptType=v4.00+
              PlayResX=${width}
              PlayResY=${height}

              [V4+ Styles]
              Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

              ; ✅ Smaller Font + Light Background + Lower Safe Position
              Style: Karaoke,Arial,${karaokeFontSize},&H00FFFFFF,&H0000FFFF,&H00000000,&H10000000,0,0,1,1,0,2,40,40,${karaokeMarginV},1

              [Events]
              Format: Layer, Start, End, Style, Text
              `;

              jsonData.segments.forEach((seg) => {
                if (!seg.words) return;

                let karaokeLine = "";

                seg.words.forEach((w) => {
                  const word = w.word.trim();

                  // Word duration in centiseconds
                  const wordDuration = (w.end - w.start) * 100;

                  karaokeLine += `{\\k${Math.floor(wordDuration)}}${word} `;
                });

                // Segment start/end for the full line
                assContent += `Dialogue: 0,${secToASS(seg.start)},${secToASS(
                  seg.end
                )},Karaoke,${karaokeLine.trim()}\n`;
              });

              fs.writeFileSync(assFile, assContent);

              const karaokeVideo = path.join(videoDir, "final_karaoke.mp4");

              const burnCmd =
                `ffmpeg -y -i "${outputVideo}" ` +
                `-vf "ass=${assFile}" ` +
                `-c:a copy "${karaokeVideo}"`;

              exec(burnCmd, (errBurn) => {
                if (errBurn)
                  return res.status(500).json({ error: "Karaoke burn failed" });
                
                setJob(projectId, "completed", 100);

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
             🔥 Burn Captions Safe Area
          ================================= */
          if (mode === "burn") {
            const burnedVideo = path.join(videoDir, "final_burned.mp4");

            // 📝 Prefer edited subtitles if present
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
                file: `/projects/${uid}/${projectId}/videos/final_burned.mp4`,
                subtitles: `/projects/${uid}/${projectId}/subtitles/final_subtitles.srt`
              });
            });

            return;
          }

// Default SRT export
          setJob(projectId, "completed", 100);
          return res.json({
            success: true,
            file: `/projects/${uid}/${projectId}/videos/final_video.mp4`,
subtitles: `/projects/${uid}/${projectId}/subtitles/final_subtitles.srt`,
          });
        }); // end whisper exec
      }); // end video exec
    }); // end duration exec

  } catch (err) {
    console.error("🔥 Video Server Error:", err);
    res.status(500).json({ error: err.message });
  }
}); // end /api/video route

/* ===============================
   🎬 Scene Stitch Render
================================= */
app.post("/api/stitch", (req, res) => {
  const { uid, projectId, transition = "fade" } = req.body;

  const scenes = listScenes(uid, projectId);

  const videos = scenes
    .map(sid =>
      path.join(
        getSceneRoot(uid, projectId, sid),
        "videos",
        "final_video.mp4"
      )
    )
    .filter(fs.existsSync);

  if (videos.length < 2) {
    return res.status(400).json({
      error: "Need at least 2 rendered scenes"
    });
  }

  const duration = 1; // seconds per transition

  let inputs = videos.map(v => `-i "${v}"`).join(" ");

  // build xfade chain
  let vChain = "";
  let aChain = "";

  for (let i = 0; i < videos.length - 1; i++) {
    const vA = i === 0 ? `[0:v]` : `[v${i}]`;
    const vB = `[${i+1}:v]`;

    const aA = i === 0 ? `[0:a]` : `[a${i}]`;
    const aB = `[${i+1}:a]`;

    const offset = `expr=PTS-STARTPTS`;

    vChain +=
      `${vA}${vB}` +
      `xfade=transition=${transition}:duration=${duration}:offset=${duration*i}` +
      `[v${i+1}];`;

    aChain +=
      `${aA}${aB}` +
      `acrossfade=d=${duration}` +
      `[a${i+1}];`;
  }

  const lastV = `[v${videos.length-1}]`;
  const lastA = `[a${videos.length-1}]`;

  const output =
    path.join(getUserRoot(uid), projectId, "master.mp4");

  const cmd =
    `ffmpeg -y ${inputs} ` +
    `-filter_complex "${vChain}${aChain}" ` +
    `-map "${lastV}" -map "${lastA}" ` +
    `-c:v libx264 -c:a aac "${output}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({
        error: "Transition stitch failed"
      });
    }

    res.json({
      success: true,
      file: `/projects/${uid}/${projectId}/master.mp4`
    });
  });
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

// 🔐 Get User Plan (from Firebase)
async function getUserPlan(uid) {
  if (!uid) return "free";

  try {
    const snap = await adb.ref(`users/${uid}/plan`).get();
    return snap.val() || "free";
  } catch {
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

/* ===============================
   📁 Project Details
================================= */
app.get("/api/project/:uid/:projectId", (req, res) => {
  const { uid, projectId } = req.params;

  const base = path.join(getUserRoot(uid), projectId);

  const slides = safeReadDir(path.join(base, "slides"))
    .map(f => `/projects/${uid}/${projectId}/slides/${f}`);

  const videos = safeReadDir(path.join(base, "videos"))
    .map(f => `/projects/${uid}/${projectId}/videos/${f}`);

  const audio = fs.existsSync(path.join(base, "audio", "voice.mp3"))
    ? `/projects/${uid}/${projectId}/audio/voice.mp3`
    : null;

  res.json({
    slides,
    videos,
    audio
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
  const job = jobStore.get(req.params.projectId);
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

/* ===============================
   🚀 START SERVER
================================= */
app.listen(PORT, () => {
  console.log(`✅ SharpVid backend running on port ${PORT}`);
});