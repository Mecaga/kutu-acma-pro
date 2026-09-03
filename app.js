const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  projectId: "kutu-acma-pro",
  storageBucket: "kutu-acma-pro.firebasestorage.app",
  messagingSenderId: "483395048462",
  appId: "1:483395048462:web:450f18178e682a4a2f985f"
};

if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
var db = (typeof firebase !== "undefined" && firebase.database) ? firebase.database() : null;

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

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

// 🎯 İSİM VE AVATAR DEĞİŞTİĞİNDE HER YERDE GÜNCELLEME
function updateProfileGlobal(newNameRaw, newAvatar, newTitle) {
  const u = getActiveUser();
  if (!u) return;

  const oldKey = String(u.username).trim().toLowerCase();
  const newDisp = newNameRaw.trim();
  const newKey = newDisp.toLowerCase().replace(/[^a-z0-9_]/gi, "");
  const avatar = newAvatar || u.avatar || "👤";
  const title = newTitle || u.title || "Çaylak";

  if (oldKey === newKey) {
    u.displayName = newDisp;
    u.avatar = avatar;
    u.title = title;
    setActiveUser(u);

    // Liderlik tablolarındaki isim ve avatarı senkronize et
    const modes = ['standard', 'catch_open', 'mines_mode', 'speedrun_mode', 'double_mode', 'farm_mode'];
    modes.forEach(m => {
      db.ref(`leaderboards/${m}/${oldKey}`).update({
        displayName: newDisp,
        avatar: avatar,
        title: title
      }).catch(() => {});
    });
    alert("Profil bilgileriniz güncellendi!");
    location.reload();
    return;
  }

  // Kullanıcı adı değiştiyse hesabı yeni anahtara taşı
  db.ref("accounts/" + newKey).once("value").then(snap => {
    if (snap.exists()) return alert("Bu kullanıcı adı zaten alınmış!");

    db.ref("accounts/" + oldKey).once("value").then(oldSnap => {
      const data = oldSnap.val() || {};
      data.username = newKey;
      data.displayName = newDisp;
      data.avatar = avatar;
      data.title = title;

      db.ref("accounts/" + newKey).set(data).then(() => {
        db.ref("accounts/" + oldKey).remove();

        // Liderlikteki eski kayıtları yeni anahtara taşı
        const modes = ['standard', 'catch_open', 'mines_mode', 'speedrun_mode', 'double_mode', 'farm_mode'];
        modes.forEach(m => {
          db.ref(`leaderboards/${m}/${oldKey}`).once("value").then(lSnap => {
            if (lSnap.exists()) {
              const lData = lSnap.val();
              lData.username = newKey;
              lData.displayName = newDisp;
              lData.avatar = avatar;
              lData.title = title;
              db.ref(`leaderboards/${m}/${newKey}`).set(lData);
              db.ref(`leaderboards/${m}/${oldKey}`).remove();
            }
          });
        });

        u.username = newKey;
        u.displayName = newDisp;
        u.avatar = avatar;
        u.title = title;
        setActiveUser(u);
        alert("Kullanıcı adınız başarıyla değiştirildi! Yeni adınız: " + newDisp);
        location.reload();
      });
    });
  });
}

// 🎯 SKOR VE İSTATİSTİK SAYACI
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

  if (db) {
    // 1. İstatistik Sayacı
    const statRef = db.ref(`accounts/${userKey}/stats/${mode}`);
    statRef.transaction(current => {
      let st = current || { played: 0, wins: 0, losses: 0, bestScore: 0, bestTime: 9999 };
      st.played = (st.played || 0) + 1;
      if (isWin === false) st.losses = (st.losses || 0) + 1;
      else st.wins = (st.wins || 0) + 1;

      if (mode === "speedrun_mode") {
        if (finalSpeedrunTime > 4.0 && finalSpeedrunTime < (st.bestTime || 9999)) st.bestTime = finalSpeedrunTime;
      } else {
        if (numVal > (st.bestScore || 0)) st.bestScore = numVal;
      }
      return st;
    });

    // 2. Liderlik Tablosuna Yazma (Saatli Tarih Eklenmiştir)
    if (numVal > 0 || mode === "speedrun_mode") {
      const now = new Date();
      const dateStr = `${now.toLocaleDateString("tr-TR")} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

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
        date: dateStr,
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
