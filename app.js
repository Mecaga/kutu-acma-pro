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

function getDatabase() {
  if (typeof firebase !== "undefined" && firebase.database) {
    return firebase.database();
  }
  return null;
}

var db = getDatabase();

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

// 2. KULLANICI BİLGİSİ
function getActiveUser() {
  const sessionData = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!sessionData) {
    // Oturum yoksa rastgele misafir profili oluştur
    const guestUser = {
      name: "Oyuncu",
      tag: "#" + Math.floor(1000 + Math.random() * 9000),
      uid: "user_" + Math.random().toString(36).substr(2, 9),
      avatar: "👤",
      title: "Çaylak",
      sound: true
    };
    setActiveUser(guestUser);
    return guestUser;
  }
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

  const database = getDatabase();
  if (database && userObj.uid) {
    const cleanUID = String(userObj.uid).replace(/[.#$\[\]]/g, "_");
    database.ref("users/" + cleanUID).update({
      name: userObj.name || "Oyuncu",
      tag: userObj.tag || "#0000",
      avatar: userObj.avatar || "👤",
      title: userObj.title || "Çaylak",
      sound: userObj.sound !== false,
      lastOnline: Date.now()
    }).catch(e => console.warn("User sync hatası:", e));
  }
}

// 3. SKOR KAYDETME MOTORU (KESİN VE ANINDA YAZAN MODEL)
function saveScore(rawMode, scoreVal) {
  let u = getActiveUser();
  if (!u) {
    console.error("[saveScore] Kullanıcı bulunamadı!");
    return;
  }

  // Mod isim eşitleme
  let mode = String(rawMode).toLowerCase().trim();
  if (mode === "normal" || mode === "klasik") mode = "standard";
  if (mode === "catch" || mode === "yakala") mode = "catch_open";
  if (mode === "mines" || mode === "mayin") mode = "mines_mode";
  if (mode === "speedrun") mode = "speedrun_mode";
  if (mode === "double" || mode === "rulet") mode = "double_mode";

  const numScore = parseFloat(scoreVal) || 0;
  if (numScore <= 0 && mode !== "speedrun_mode") {
    console.warn("[saveScore] Geçersiz skor:", numScore);
    return;
  }

  // Güvenli anahtar oluştur
  const safeName = (u.name || "Oyuncu").replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, "");
  const cleanUID = String(u.uid || safeName).replace(/[.#$\[\]]/g, "_");
  const recordKey = `${cleanUID}_${mode}`;

  const scorePayload = {
    uid: cleanUID,
    username: `${u.name || 'Oyuncu'}${u.tag || ''}`,
    name: u.name || 'Oyuncu',
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

  // Yerel hafızaya kaydet
  try {
    let localScores = JSON.parse(localStorage.getItem("kutu_local_scores")) || {};
    if (mode === "speedrun_mode") {
      if (!localScores[mode] || numScore < localScores[mode]) localScores[mode] = numScore;
    } else {
      if (!localScores[mode] || numScore > localScores[mode]) localScores[mode] = numScore;
    }
    localStorage.setItem("kutu_local_scores", JSON.stringify(localScores));
  } catch (e) {}

  // Firebase'e doğrudan ve garantili yaz
  const database = getDatabase();
  if (!database) {
    console.error("[saveScore] Firebase Database nesnesine ulaşılamadı!");
    return;
  }

  const targetRef = database.ref("game_scores/" + recordKey);
  
  targetRef.once("value").then(snap => {
    let shouldSave = true;
    if (snap.exists()) {
      const existing = snap.val();
      const oldScore = parseFloat(existing.score || existing.points || existing.time || 0);
      
      if (mode === "speedrun_mode") {
        // Speedrun: En kısa süre rekor sayılır
        shouldSave = oldScore <= 0 || numScore < oldScore;
      } else {
        // Diğer modlar: En yüksek puan rekor sayılır
        shouldSave = numScore > oldScore;
      }
    }

    if (shouldSave) {
      targetRef.set(scorePayload).then(() => {
        console.log(`✅ [SKOR YAZILDI] Mod: ${mode}, Değer: ${numScore}, Kullanıcı: ${cleanUID}`);
        // Yedek tabloya da bas
        database.ref("scores/" + recordKey).set(scorePayload).catch(() => {});
      }).catch(err => {
        console.error("❌ Firebase Yazma İzni Hatası:", err.message);
        alert("Skor kaydedilemedi! Firebase izin hatası: " + err.message);
      });
    } else {
      console.log(`ℹ️ Mevcut rekor daha iyi olduğundan skor güncellenmedi.`);
    }
  }).catch(err => {
    console.error("Firebase Okuma Hatası:", err);
  });
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
