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

// 2. KULLANICI BİLGİLERİ
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
    }).catch(e => console.warn("User update:", e));
  }
}

// 3. İLK VERSİYONUN ORİJİNAL SKOR MOTORU (LEADERBOARDS TABLOSUNA DOĞRUDAN YAZAR)
function recordGameScore(gameMode, modeTitle, scoreVal, drops, isWin) {
  let u = getActiveUser();
  if (!u) return;

  // Mod adını orijinal formata eşitle
  let mode = String(gameMode).toLowerCase().trim();
  if (mode === "normal" || mode === "klasik") mode = "standard";
  if (mode === "catch" || mode === "yakala") mode = "catch_open";
  if (mode === "mines" || mode === "mayin") mode = "mines_mode";
  if (mode === "speedrun") mode = "speedrun_mode";
  if (mode === "double" || mode === "rulet") mode = "double_mode";

  let numVal = parseFloat(scoreVal) || 0;

  // Speedrun için süreyi saniyeye çevir (örn: 1133ms -> 11.3s)
  let speedrunSeconds = numVal;
  if (mode === "speedrun_mode" && speedrunSeconds > 100) {
    speedrunSeconds = parseFloat((speedrunSeconds / 1000).toFixed(1));
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
    time: mode === "speedrun_mode" ? speedrunSeconds : numVal,
    drops: drops || [],
    isWin: isWin !== undefined ? isWin : true,
    date: new Date().toLocaleDateString("tr-TR"),
    timestamp: Date.now()
  };

  // 1. LocalStorage Yedekleme
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      if (!localScores[mode] || speedrunSeconds < localScores[mode]) localScores[mode] = speedrunSeconds;
    } else {
      if (!localScores[mode] || numVal > localScores[mode]) localScores[mode] = numVal;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // 2. Kullanıcının Kendi İstatistiklerini Güncelle (Oyun/Kazanma/Kaybetme)
  if (db) {
    const userStatRef = db.ref(`users/${cleanUID}/stats/${mode}`);
    userStatRef.once("value").then(s => {
      const st = s.val() || { played: 0, wins: 0, losses: 0 };
      st.played = (st.played || 0) + 1;
      if (isWin === false) {
        st.losses = (st.losses || 0) + 1;
      } else {
        st.wins = (st.wins || 0) + 1;
      }
      userStatRef.set(st);
    }).catch(() => {});

    // 3. Sıralama Tablosuna (leaderboards/{mode}/{uid}) Yaz
    const lbRef = db.ref(`leaderboards/${mode}/${cleanUID}`);
    lbRef.once("value").then(snap => {
      let shouldUpdate = true;
      if (snap.exists()) {
        const old = snap.val();
        if (mode === "speedrun_mode") {
          const oldTime = parseFloat(old.time) || 9999;
          shouldUpdate = speedrunSeconds < oldTime;
        } else {
          const oldScore = parseFloat(old.score || old.points) || 0;
          shouldUpdate = numVal > oldScore;
        }
      }

      if (shouldUpdate) {
        lbRef.set(recordPayload);
        // Yedek tablolara da aynı anda yaz
        db.ref(`game_scores/${cleanUID}_${mode}`).set(recordPayload).catch(() => {});
      }
    }).catch(err => console.error("Skor kayıt hatası:", err));
  }
}

// Eski çağrılar için köprü fonksiyon
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
