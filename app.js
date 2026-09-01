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

// 🎯 KUSURSUZ SKOR KAYDETME MOTORU
function saveScore(rawMode, scoreVal) {
  const u = getActiveUser();
  if (!u) {
    console.warn("Kullanıcı oturumu bulunamadı!");
    return;
  }

  // Mod isimlerini sıralama tablosunun beklediği standarda çevir
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

  // Firebase Veritabanına Anında Yaz
  if (db) {
    const refPath = db.ref("game_scores/" + recordKey);
    refPath.once("value").then(snap => {
      let shouldUpdate = true;
      if (snap.exists()) {
        const oldScore = parseFloat(snap.val().score || snap.val().points || snap.val().time || 0);
        if (mode === "speedrun_mode") {
          shouldUpdate = oldScore === 0 || numScore < oldScore;
        } else {
          shouldUpdate = numScore > oldScore;
        }
      }

      if (shouldUpdate) {
        refPath.set(scorePayload);
        db.ref("scores/" + recordKey).set(scorePayload);
        console.log(`[Skor Başarıyla Kaydedildi] Mod: ${mode}, Skor: ${numScore}`);
      }
    }).catch(err => console.error("Firebase Skor Yazma Hatası:", err));
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
