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

// 🎯 GARANTİLİ SKOR VE İSTATİSTİK SAYACI
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

  // Speedrun süre kontrolü
  let finalSpeedrunTime = 0;
  if (mode === "speedrun_mode") {
    finalSpeedrunTime = (customTime !== undefined && customTime !== null) ? parseFloat(customTime) : numVal;
  }

  const cleanUID = String(u.uid || u.name).replace(/[.#$\[\]]/g, "_");
  const fullName = `${u.name}${u.tag || ""}`;

  // 1. İSTATİSTİK ARTTIRMA (KAZANSA DA KAYBETSE DE OYNANDI SAYILIR)
  if (db) {
    const statRef = db.ref(`users/${cleanUID}/stats/${mode}`);
    statRef.transaction(current => {
      let st = current || { played: 0, wins: 0, losses: 0 };
      st.played = (st.played || 0) + 1;
      if (isWin === false) {
        st.losses = (st.losses || 0) + 1;
      } else {
        st.wins = (st.wins || 0) + 1;
      }
      return st;
    });
  }

  // 2. EN İYİ SKORLARI YERELDE SAKLA
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      if (!localScores[mode] || finalSpeedrunTime < localScores[mode]) localScores[mode] = finalSpeedrunTime;
    } else {
      if (!localScores[mode] || numVal > localScores[mode]) localScores[mode] = numVal;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // 3. FIREBASE LİDERLİK TABLOSUNA YAZMA (0 Puanlar Liderliğe Yazılmaz ama İstatistiğe Sayılır)
  if (db && (numVal > 0 || mode === "speedrun_mode")) {
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

    const lbRef = db.ref(`leaderboards/${mode}/${cleanUID}`);
    lbRef.once("value").then(snap => {
      let shouldUpdate = true;
      if (snap.exists()) {
        const old = snap.val();
        if (mode === "speedrun_mode") {
          const oldTime = parseFloat(old.time) || 0;
          shouldUpdate = oldTime <= 5.0 || finalSpeedrunTime < oldTime;
        } else {
          const oldScore = parseFloat(old.score || old.points) || 0;
          shouldUpdate = numVal > oldScore;
        }
      }

      if (shouldUpdate) {
        lbRef.set(recordPayload);
        db.ref(`game_scores/${cleanUID}_${mode}`).set(recordPayload).catch(() => {});
      }
    });
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
