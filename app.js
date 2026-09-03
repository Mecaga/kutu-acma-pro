// 1. FIREBASE BAŞLATMA
const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  projectId: "kutu-acma-pro",
  storageBucket: "kutu-acma-pro.firebasestorage.app",
  messagingSenderId: "483395048462",
  appId: "1:483395048462:web:450f18178e682a4a2f985f"
};

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}

var db = (typeof firebase !== "undefined" && firebase.database) ? firebase.database() : null;

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

function getActiveUser() {
  const sessionData = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!sessionData) {
    const guest = {
      name: "Oyuncu",
      tag: "#" + Math.floor(1000 + Math.random() * 9000),
      uid: "user_" + Math.random().toString(36).substr(2, 8),
      avatar: "👤",
      title: "Çaylak",
      sound: true
    };
    setActiveUser(guest);
    return guest;
  }
  try { return JSON.parse(sessionData); } catch (e) { return null; }
}

function setActiveUser(u) {
  if (!u) return;
  localStorage.setItem("kutu_active_session", JSON.stringify(u));
  localStorage.setItem("kutu_active_user", JSON.stringify(u));

  if (db && u.uid) {
    const cleanUID = String(u.uid).replace(/[.#$\[\]]/g, "_");
    db.ref("users/" + cleanUID).update({
      name: u.name || "Oyuncu",
      tag: u.tag || "#0000",
      avatar: u.avatar || "👤",
      title: u.title || "Çaylak",
      sound: u.sound !== false,
      lastOnline: Date.now()
    }).catch(e => console.warn("User update:", e));
  }
}

// 🎯 DÜZELTİLEN SKOR MOTORU (6. PARAMETREDEKİ SÜREYİ YAKALAR)
function recordGameScore(gameMode, modeTitle, scoreVal, drops, isWin, customTime) {
  let u = getActiveUser();
  if (!u) return;

  let mode = String(gameMode).toLowerCase().trim();
  if (mode === "normal" || mode === "klasik") mode = "standard";
  if (mode === "catch" || mode === "yakala") mode = "catch_open";
  if (mode === "mines" || mode === "mayin") mode = "mines_mode";
  if (mode === "speedrun") mode = "speedrun_mode";
  if (mode === "double" || mode === "rulet") mode = "double_mode";

  let numVal = parseFloat(scoreVal) || 0;

  // SPEEDRUN SÜRE AYARI: customTime varsa onu al, yoksa scoreVal'e bak
  let finalSpeedrunTime = 0;
  if (mode === "speedrun_mode") {
    if (customTime !== undefined && customTime !== null) {
      finalSpeedrunTime = parseFloat(customTime);
    } else {
      finalSpeedrunTime = numVal;
    }
  }

  const cleanUID = String(u.uid || u.name).replace(/[.#$\[\]]/g, "_");
  const fullName = `${u.name}${u.tag || ""}`;

  const recordPayload = {
    uid: cleanUID,
    fullName: fullName,
    username: fullName,
    name: u.name,
    avatar: u.avatar || "👤",
    title: u.title || "Çaylak",
    modeName: modeTitle || mode,
    gameMode: mode,
    score: numVal,
    points: numVal,
    time: mode === "speedrun_mode" ? finalSpeedrunTime : numVal,
    drops: drops || [],
    isWin: isWin !== undefined ? isWin : true,
    date: new Date().toLocaleDateString("tr-TR"),
    timestamp: Date.now()
  };

  // 1. LocalStorage Kaydı
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      localScores[mode] = finalSpeedrunTime;
    } else {
      if (!localScores[mode] || numVal > localScores[mode]) localScores[mode] = numVal;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // 2. Firebase Kaydı
  if (db) {
    const lbRef = db.ref(`leaderboards/${mode}/${cleanUID}`);
    lbRef.once("value").then(snap => {
      let shouldUpdate = true;
      if (snap.exists()) {
        const old = snap.val();
        if (mode === "speedrun_mode") {
          const oldTime = parseFloat(old.time) || 0;
          // Eski hatalı 1.0 saniyeleri ezmek için kontrol
          shouldUpdate = oldTime <= 1.5 || finalSpeedrunTime < oldTime;
        } else {
          const oldScore = parseFloat(old.score || old.points) || 0;
          shouldUpdate = numVal > oldScore;
        }
      }

      if (shouldUpdate) {
        lbRef.set(recordPayload);
        db.ref(`game_scores/${cleanUID}_${mode}`).set(recordPayload).catch(() => {});
      }
    }).catch(err => console.error("Skor kayıt hatası:", err));
  }
}

function saveScore(rawMode, scoreVal) {
  recordGameScore(rawMode, rawMode, scoreVal, [], true);
}

function updateAvatarGlobal(newAvatar) {
  let u = getActiveUser();
  if (!u) return;
  u.avatar = newAvatar;
  setActiveUser(u);
}

function updateUsernameGlobal(newName) {
  if (!newName) return alert("Kullanıcı adı boş bırakılamaz!");
  let u = getActiveUser();
  if (!u) return;
  u.name = newName;
  setActiveUser(u);
  alert("Kullanıcı adı güncellendi: " + newName);
  location.reload();
}
