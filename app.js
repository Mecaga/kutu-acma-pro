// 0. TELEFON EKRANINDA HATA VE BİLGİ GÖSTERİCİ (DEBUGGER)
function showScreenToast(msg, isError = false) {
  let box = document.getElementById("mobile-debug-toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "mobile-debug-toast";
    box.style.position = "fixed";
    box.style.top = "10px";
    box.style.left = "10px";
    box.style.right = "10px";
    box.style.zIndex = "99999";
    box.style.padding = "10px";
    box.style.borderRadius = "8px";
    box.style.fontSize = "11px";
    box.style.fontWeight = "bold";
    box.style.textAlign = "center";
    box.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
    document.body.appendChild(box);
  }
  box.style.display = "block";
  box.style.background = isError ? "#ef4444" : "#10b981";
  box.style.color = "#fff";
  box.innerText = msg;
  setTimeout(() => { if (box) box.style.display = "none"; }, 5000);
}

// 1. FIREBASE BAĞLANTISI
const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  databaseURL: "https://kutu-acma-pro-default-rtdb.firebaseio.com",
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

// SAYFA AÇILDIĞINDA BAĞLANTIYI ANINDA TEST ET
if (!db) {
  setTimeout(() => showScreenToast("❌ Firebase kütüphanesi yüklenemedi! İnternet veya SDK eksik.", true), 1000);
} else {
  // Test yazması denemesi
  db.ref("_baglanti_testi").set({ test: true, time: Date.now() })
    .then(() => {
      console.log("Bağlantı ve yazma başarılı.");
    })
    .catch(err => {
      showScreenToast("🛑 Firebase İzin Hatası: " + err.message, true);
    });
}

// 2. AKTİF KULLANICI
function getActiveUser() {
  const sessionData = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!sessionData) {
    const guest = {
      name: "Oyuncu",
      tag: "#" + Math.floor(1000 + Math.random() * 9000),
      uid: "user_" + Math.random().toString(36).substr(2, 8),
      avatar: "👤",
      title: "Çaylak"
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
}

// 3. SKOR KAYDETME (EKRANA UYARI VEREN HALİ)
function saveScore(rawMode, scoreVal) {
  let u = getActiveUser();
  let mode = String(rawMode).toLowerCase().trim();
  if (mode === "normal" || mode === "klasik") mode = "standard";
  if (mode === "catch" || mode === "yakala") mode = "catch_open";
  if (mode === "mines" || mode === "mayin") mode = "mines_mode";
  if (mode === "speedrun") mode = "speedrun_mode";
  if (mode === "double" || mode === "rulet") mode = "double_mode";

  const numScore = parseFloat(scoreVal) || 0;
  if (numScore <= 0 && mode !== "speedrun_mode") {
    showScreenToast("⚠️ Skor 0 olduğu için kaydedilmedi!", true);
    return;
  }

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

  if (!db) {
    showScreenToast("❌ Veritabanı (db) hazır değil!", true);
    return;
  }

  // Doğrudan Firebase'e yaz ve sonucu ekrana bildir
  db.ref("game_scores/" + recordKey).set(scorePayload)
    .then(() => {
      showScreenToast(`✅ SKOR BAŞARIYLA KAYDEDİLDİ! (${numScore} P)`, false);
      db.ref("scores/" + recordKey).set(scorePayload).catch(() => {});
    })
    .catch(err => {
      showScreenToast("❌ KAYIT BAŞARISIZ: " + err.message, true);
    });
}
