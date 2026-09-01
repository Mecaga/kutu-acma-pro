// FIREBASE BAŞLATMA
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

var db = typeof firebase !== "undefined" ? firebase.database() : null;

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

function getActiveUser() {
  const sessionData = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!sessionData) return null;
  try {
    return JSON.parse(sessionData);
  } catch (e) {
    return null;
  }
}

function setActiveUser(userObj) {
  if (!userObj) return;
  const jsonStr = JSON.stringify(userObj);
  localStorage.setItem("kutu_active_session", jsonStr);
  localStorage.setItem("kutu_active_user", jsonStr);

  if (db && userObj.uid && userObj.uid !== "ADMIN_ROOT") {
    const cleanUID = String(userObj.uid).replace(/[.#$\[\]]/g, "_");
    db.ref("users/" + cleanUID).update({
      name: userObj.name || "Oyuncu",
      tag: userObj.tag || "#0000",
      avatar: userObj.avatar || "👤",
      title: userObj.title || "Çaylak",
      sound: userObj.sound !== false,
      lastOnline: Date.now()
    });
  }
}

// GARANTİLİ SKOR KAYIT FONKSİYONU
function saveScore(rawMode, scoreVal) {
  let u = getActiveUser();
  if (!u) {
    u = { name: "Oyuncu", tag: "#" + Math.floor(1000 + Math.random() * 9000), uid: "guest_" + Date.now(), avatar: "👤", title: "Çaylak" };
    setActiveUser(u);
  }

  let mode = rawMode;
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

  // 1. Yerel Depolamaya Kaydet
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      if (!localScores[mode] || numScore < localScores[mode]) localScores[mode] = numScore;
    } else {
      if (!localScores[mode] || numScore > localScores[mode]) localScores[mode] = numScore;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // 2. Firebase Veritabanına Yaz (Doğrudan Yazma ve Skor Karşılaştırması)
  if (db) {
    db.ref("game_scores/" + recordKey).transaction(currentData => {
      if (!currentData) {
        return scorePayload;
      }
      const oldScore = parseFloat(currentData.score || currentData.points || currentData.time || 0);
      if (mode === "speedrun_mode") {
        if (oldScore === 0 || numScore < oldScore) return scorePayload;
      } else {
        if (numScore > oldScore) return scorePayload;
      }
      return currentData;
    });

    db.ref("scores/" + recordKey).transaction(currentData => {
      if (!currentData) return scorePayload;
      const oldScore = parseFloat(currentData.score || currentData.points || currentData.time || 0);
      if (mode === "speedrun_mode") {
        if (oldScore === 0 || numScore < oldScore) return scorePayload;
      } else {
        if (numScore > oldScore) return scorePayload;
      }
      return currentData;
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
