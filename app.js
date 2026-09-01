// 1. FIREBASE BAŞLATMA YAPILANDIRMASI
const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  databaseURL: "https://kutu-acma-pro-default-rtdb.firebaseio.com",
  projectId: "kutu-acma-pro",
  storageBucket: "kutu-acma-pro.firebasestorage.app",
  messagingSenderId: "483395048462",
  appId: "1:483395048462:web:450f18178e682a4a2f985f"
};

// Firebase SDK yüklüyse ve henüz başlatılmadıysa başlat
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

// 2. AKTİF KULLANICI YÖNETİMİ
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

// 3. SKOR KAYDETME MOTORU (SIRALAMA TABLOSUNA ANINDA YAZAR)
function saveScore(gameMode, scoreVal) {
  const u = getActiveUser();
  if (!u) {
    console.warn("Kullanıcı girişi bulunamadığı için skor yerel olarak kaydedilemedi.");
    return;
  }

  const numScore = parseFloat(scoreVal) || 0;
  if (numScore <= 0 && gameMode !== 'speedrun_mode') return;

  const cleanUID = String(u.uid || u.name).replace(/[.#$\[\]]/g, "_");
  const recordKey = `${cleanUID}_${gameMode}`;

  const scorePayload = {
    uid: cleanUID,
    username: `${u.name}${u.tag || ''}`,
    avatar: u.avatar || "👤",
    title: u.title || "Çaylak",
    gameMode: gameMode,
    mode: gameMode,
    score: numScore,
    points: numScore,
    time: numScore,
    timestamp: Date.now(),
    date: new Date().toLocaleDateString("tr-TR")
  };

  // Yerel Hafızaya Hızlı Yedekleme
  const localScoresKey = "kutu_local_scores";
  let localScores = {};
  try {
    localScores = JSON.parse(localStorage.getItem(localScoresKey)) || {};
  } catch (e) {
    localScores = {};
  }

  if (gameMode === "speedrun_mode") {
    // Speedrun için EN KÜÇÜK (en hızlı) süre rekor sayılır
    if (!localScores[gameMode] || numScore < localScores[gameMode]) {
      localScores[gameMode] = numScore;
    }
  } else {
    // Diğer tüm modlar için EN YÜKSEK puan rekor sayılır
    if (!localScores[gameMode] || numScore > localScores[gameMode]) {
      localScores[gameMode] = numScore;
    }
  }
  localStorage.setItem(localScoresKey, JSON.stringify(localScores));

  // Firebase Veritabanına Yazma
  if (db) {
    const refPath = db.ref("game_scores/" + recordKey);
    
    refPath.once("value").then(snap => {
      let shouldUpdate = true;
      if (snap.exists()) {
        const oldScore = parseFloat(snap.val().score || snap.val().points || 0);
        if (gameMode === "speedrun_mode") {
          shouldUpdate = oldScore === 0 || numScore < oldScore;
        } else {
          shouldUpdate = numScore > oldScore;
        }
      }

      if (shouldUpdate) {
        refPath.set(scorePayload);
        db.ref("scores/" + recordKey).set(scorePayload);
        console.log(`[Skor Kaydedildi] Mod: ${gameMode}, Skor: ${numScore}`);
      }
    }).catch(err => {
      console.error("Firebase skor kaydetme hatası:", err);
    });
  }
}

// 4. OYUN İÇİ SES MOTORU
function playSoundEffect(type) {
  const u = getActiveUser();
  if (u && u.sound === false) return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "open") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "win") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "bomb") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {}
}

// 5. HESAP SİLME & GÜVENLİ ÇIKIŞ
function deleteAccountPermanently() {
  const u = getActiveUser();
  if (!u) return;

  if (confirm("DİKKAT! Hesabınızı ve tüm kayıtlarınızı kalıcı olarak silmek istediğinize emin misiniz?")) {
    const cleanUID = String(u.uid).replace(/[.#$\[\]]/g, "_");

    if (db) {
      db.ref("users/" + cleanUID).remove();
      db.ref("user_friends/" + cleanUID).remove();
      db.ref("friend_requests/" + cleanUID).remove();
    }

    localStorage.clear();
    alert("Hesabınız kalıcı olarak silindi.");
    window.location.href = "index.html";
  }
}

// 6. ADMIN YÖNETİM FONKSİYONLARI
function adminClearAllUsers() {
  if (confirm("Tüm kullanıcı veritabanını silmek istediğinize emin misiniz?")) {
    if (db) db.ref("users").remove().then(() => alert("Kullanıcılar silindi."));
  }
}

function adminClearAllScores() {
  if (confirm("Tüm sıralama skorlarını sıfırlamak istediğinize emin misiniz?")) {
    if (db) {
      db.ref("game_scores").remove();
      db.ref("scores").remove().then(() => alert("Skorlar sıfırlandı."));
    }
  }
}

function adminClearAllChannels() {
  if (confirm("Tüm özel sohbet kanallarını silmek istediğinize emin misiniz?")) {
    if (db) db.ref("custom_channels").remove().then(() => alert("Kanallar temizlendi."));
  }
}

function adminWipeEverything() {
  if (confirm("KRİTİK UYARI! Veritabanındaki HER ŞEY silinecek! Onaylıyor musunuz?")) {
    if (db) {
      db.ref().remove().then(() => {
        localStorage.clear();
        alert("Tüm sistem sıfırlandı.");
        location.reload();
      });
    }
  }
}
