// 1. FIREBASE BAŞLATMA (ORİJİNAL ÇALIŞAN HALİ)
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

// 2. KULLANICI BİLGİSİ
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
  try {
    return JSON.parse(sessionData);
  } catch (e) {
    return null;
  }
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
    }).catch(e => console.warn("User update hatası:", e));
  }
}

// 3. OYUNLARIN ÇAĞIRDIĞI RECORDGAMESCORE FONKSİYONU
function recordGameScore(gameMode, modeTitle, scoreVal, drops, isWin) {
  saveScore(gameMode, scoreVal);
}

// 4. SKOR KAYDETME MOTORU (HEM LOCAL HEM FIREBASE)
function saveScore(rawMode, scoreVal) {
  let u = getActiveUser();
  if (!u) return;

  let mode = String(rawMode).toLowerCase().trim();
  if (mode === "normal" || mode === "klasik") mode = "standard";
  if (mode === "catch" || mode === "yakala") mode = "catch_open";
  if (mode === "mines" || mode === "mayin") mode = "mines_mode";
  if (mode === "speedrun") mode = "speedrun_mode";
  if (mode === "double" || mode === "rulet") mode = "double_mode";

  const numScore = parseFloat(scoreVal) || 0;
  if (numScore <= 0 && mode !== "speedrun_mode") return;

  const cleanUID = String(u.uid || u.name).replace(/[.#$\[\]]/g, "_");
  const recordKey = `${cleanUID}_${mode}`;

  const scorePayload = {
    uid: cleanUID,
    username: `${u.name}${u.tag || ""}`,
    name: u.name,
    avatar: u.avatar || "👤",
    title: u.title || "Çaylak",
    gameMode: mode,
    mode: mode,
    score: numScore,
    points: numScore,
    time: numScore,
    timestamp: Date.now(),
    date: new Date().toLocaleDateString("tr-TR")
  };

  // Localstorage kaydı
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      if (!localScores[mode] || numScore < localScores[mode]) localScores[mode] = numScore;
    } else {
      if (!localScores[mode] || numScore > localScores[mode]) localScores[mode] = numScore;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // Firebase Veritabanına Anında Kaydet
  if (db) {
    const targetRef = db.ref("game_scores/" + recordKey);
    targetRef.once("value").then(snap => {
      let shouldSave = true;
      if (snap.exists()) {
        const oldScore = parseFloat(snap.val().score || snap.val().points || snap.val().time || 0);
        if (mode === "speedrun_mode") {
          shouldSave = oldScore <= 0 || numScore < oldScore;
        } else {
          shouldSave = numScore > oldScore;
        }
      }

      if (shouldSave) {
        targetRef.set(scorePayload);
        db.ref("scores/" + recordKey).set(scorePayload);
      }
    }).catch(err => {
      console.error("Firebase kayıt hatası:", err);
    });
  }
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
