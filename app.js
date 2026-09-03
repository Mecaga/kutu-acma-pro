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
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}

var db = (typeof firebase !== "undefined" && firebase.database) ? firebase.database() : null;

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

// Aktif Kullanıcı (Undefined hatasını önleyen akıllı okuyucu)
function getActiveUser() {
  const session = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!session) return null;
  try {
    let u = JSON.parse(session);
    let realName = u.displayName || u.name || u.username || "Oyuncu";
    u.displayName = realName;
    u.name = realName;
    u.username = String(u.username || realName).toLowerCase().replace(/[^a-z0-9_]/gi, "");
    return u;
  } catch (e) {
    return null;
  }
}

function setActiveUser(u) {
  if (!u) {
    localStorage.removeItem("kutu_active_session");
    localStorage.removeItem("kutu_active_user");
    return;
  }
  if (!u.displayName) u.displayName = u.name || u.username || "Oyuncu";
  if (!u.username) u.username = String(u.displayName).toLowerCase().replace(/[^a-z0-9_]/gi, "");
  u.name = u.displayName;

  localStorage.setItem("kutu_active_session", JSON.stringify(u));
  localStorage.setItem("kutu_active_user", JSON.stringify(u));

  if (db && u.username) {
    db.ref("accounts/" + u.username).update({
      displayName: u.displayName,
      avatar: u.avatar || "👤",
      title: u.title || "Çaylak",
      sound: u.sound !== false,
      lastOnline: Date.now()
    }).catch(() => {});
  }
}

// Kullanıcı Adı Değiştirme (Verileri yeni isme taşır)
function changeUsernameGlobal(newRawName) {
  const u = getActiveUser();
  if (!u) return alert("Oturum bulunamadı!");
  const newName = newRawName.trim();
  if (!newName) return alert("Kullanıcı adı boş olamaz!");

  const oldKey = String(u.username).trim().toLowerCase();
  const newKey = newName.toLowerCase().replace(/[^a-z0-9_]/gi, "");

  if (oldKey === newKey) {
    u.displayName = newName;
    setActiveUser(u);
    return alert("İsim güncellendi.");
  }

  db.ref("accounts/" + newKey).once("value").then(snap => {
    if (snap.exists()) {
      return alert("Bu kullanıcı adı zaten kullanımda!");
    }

    db.ref("accounts/" + oldKey).once("value").then(oldSnap => {
      const data = oldSnap.val() || {};
      data.username = newKey;
      data.displayName = newName;

      db.ref("accounts/" + newKey).set(data).then(() => {
        db.ref("accounts/" + oldKey).remove();
        u.username = newKey;
        u.displayName = newName;
        setActiveUser(u);
        alert("Kullanıcı adınız başarıyla " + newName + " yapıldı!");
        location.reload();
      });
    });
  });
}

// Skor Kaydetme Motoru
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
  let finalSpeedrunTime = (mode === "speedrun_mode" && customTime !== undefined) ? parseFloat(customTime) : numVal;

  const userKey = String(u.username).trim().toLowerCase();
  const displayName = u.displayName || u.name || "Oyuncu";

  // 1. İstatistikleri Güncelle (Kazanma / Kaybetme / Oynama)
  if (db) {
    const statRef = db.ref(`accounts/${userKey}/stats/${mode}`);
    statRef.transaction(current => {
      let st = current || { played: 0, wins: 0, losses: 0 };
      st.played = (st.played || 0) + 1;
      if (isWin === false) st.losses = (st.losses || 0) + 1;
      else st.wins = (st.wins || 0) + 1;
      return st;
    });

    // 2. Liderlik Tablosuna Yaz
    if (numVal > 0 || mode === "speedrun_mode") {
      const payload = {
        username: userKey,
        displayName: displayName,
        avatar: u.avatar || "👤",
        title: u.title || "Çaylak",
        modeName: modeTitle || mode,
        gameMode: mode,
        score: numVal,
        time: mode === "speedrun_mode" ? finalSpeedrunTime : numVal,
        drops: drops || [],
        isWin: isWin !== undefined ? isWin : true,
        date: new Date().toLocaleDateString("tr-TR"),
        timestamp: Date.now()
      };

      const lbRef = db.ref(`leaderboards/${mode}/${userKey}`);
      lbRef.once("value").then(snap => {
        let update = true;
        if (snap.exists()) {
          const old = snap.val();
          if (mode === "speedrun_mode") {
            const oldT = parseFloat(old.time) || 0;
            update = oldT <= 5.0 || finalSpeedrunTime < oldT;
          } else {
            update = numVal > (parseFloat(old.score) || 0);
          }
        }
        if (update) lbRef.set(payload);
      });
    }
  }
}

// Admin İşlemleri
function adminClearAllUsers() {
  if (confirm("Tüm kullanıcı hesaplarını silmek istediğinize emin misiniz?")) {
    db.ref("accounts").remove().then(() => alert("Kullanıcılar silindi."));
  }
}
function adminClearAllScores() {
  if (confirm("Tüm liderlik skorlarını silmek istediğinize emin misiniz?")) {
    db.ref("leaderboards").remove().then(() => alert("Skorlar sıfırlandı."));
  }
}
function adminClearAllChannels() {
  if (confirm("Tüm sohbet kanallarını silmek istediğinize emin misiniz?")) {
    db.ref("messages").remove().then(() => alert("Sohbetler temizlendi."));
  }
}
function adminWipeEverything() {
  if (prompt("BÜTÜN VERİLERİ SİLMEK İÇİN 'ONAY' YAZIN:") === "ONAY") {
    db.ref().remove().then(() => {
      alert("Sistem tamamen sıfırlandı!");
      location.reload();
    });
  }
}
