const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  projectId: "kutu-acma-pro",
  storageBucket: "kutu-acma-pro.firebasestorage.app",
  messagingSenderId: "483395048462",
  appId: "1:483395048462:web:450f18178e682a4a2f985f"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const AVATAR_LIST = ["👤", "😄", "😍", "😎", "🤓", "🥸", "🤠", "😈", "👽", "🎃", "💀", "👁", "🧠", "⛑️", "🎒", "🛜", "👑"];
const FORBIDDEN_NAMES = ["trump", "putin", "admin", "moderator", "kurucu", "root"];

function getActiveUser() {
  const data = localStorage.getItem("kutu_active_session");
  return data ? JSON.parse(data) : null;
}

function setActiveUser(userData) {
  localStorage.setItem("kutu_active_session", JSON.stringify(userData));
  if (userData && userData.uid && userData.uid !== "ADMIN_ROOT") {
    db.ref("users/" + userData.uid).update({
      fullName: `${userData.name}${userData.tag}`,
      name: userData.name,
      tag: userData.tag,
      avatar: userData.avatar || "👤",
      title: userData.title || "Çaylak",
      sound: userData.sound !== undefined ? userData.sound : true,
      createdAt: userData.createdAt || new Date().toLocaleString("tr-TR"),
      stats: userData.stats || {},
      lastOnline: Date.now()
    });
  }
}

function syncUserFromDB(uid, callback) {
  if (uid === "ADMIN_ROOT") {
    if (callback) callback(getActiveUser());
    return;
  }
  db.ref("users/" + uid).once("value", snap => {
    const val = snap.val();
    if (val) {
      setActiveUser(val);
      if (callback) callback(val);
    }
  });
}

function updateAvatarGlobal(newAvatar) {
  const u = getActiveUser();
  if (!u) return;
  u.avatar = newAvatar;
  setActiveUser(u);

  // Sıralamalardaki avatarları güncelle
  const modes = ['standard', 'ten_cases', 'catch_basket', 'catch_open', 'mines_mode', 'mega_mode', 'speedrun_mode', 'double_mode', 'temple_mode'];
  modes.forEach(m => {
    db.ref(`leaderboards/${m}/${u.uid}`).once("value", s => {
      if (s.exists()) db.ref(`leaderboards/${m}/${u.uid}`).update({ avatar: newAvatar });
    });
  });
}

function updateUsernameGlobal(newName) {
  const u = getActiveUser();
  if (!u || !newName.trim()) return;
  if (u.isAdmin) return alert("Admin kullanıcı adı değiştirilemez!");

  const lower = newName.toLowerCase().trim();
  if (FORBIDDEN_NAMES.some(f => lower.includes(f))) {
    return alert("Bu kullanıcı adı yasaklı bir kelime içeriyor!");
  }

  const oldSafeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const newSafeKey = lower.replace(/[^a-z0-9]/g, "_");

  db.ref("accounts/" + newSafeKey).once("value", snap => {
    if (snap.exists() && snap.val().uid !== u.uid) return alert("Bu kullanıcı adı zaten kullanımda!");

    db.ref("accounts/" + oldSafeKey).remove();
    db.ref("accounts/" + newSafeKey).set({ uid: u.uid, password: u.password });

    u.name = newName.trim();
    setActiveUser(u);

    // Sıralamalardaki isimleri güncelle
    const modes = ['standard', 'ten_cases', 'catch_basket', 'catch_open', 'mines_mode', 'mega_mode', 'speedrun_mode', 'double_mode', 'temple_mode'];
    modes.forEach(m => {
      db.ref(`leaderboards/${m}/${u.uid}`).once("value", s => {
        if (s.exists()) db.ref(`leaderboards/${m}/${u.uid}`).update({ fullName: `${u.name}${u.tag}` });
      });
    });

    alert("Kullanıcı adınız güncellendi! Yeni adınızla giriş yapabilirsiniz.");
    location.reload();
  });
}

function recordGameScore(modeKey, modeName, score, dropsList, isWin = true, speedTime = null) {
  const u = getActiveUser();
  if (!u || u.isAdmin) return;

  if (!u.stats) u.stats = {};
  if (!u.stats[modeKey]) u.stats[modeKey] = { played: 0, wins: 0, losses: 0, best: 0, bestTime: null };

  u.stats[modeKey].played = (u.stats[modeKey].played || 0) + 1;
  if (isWin) u.stats[modeKey].wins = (u.stats[modeKey].wins || 0) + 1;
  else u.stats[modeKey].losses = (u.stats[modeKey].losses || 0) + 1;

  if (modeKey === 'speedrun_mode' && speedTime !== null) {
    const numTime = parseFloat(speedTime);
    if (!u.stats[modeKey].bestTime || numTime < u.stats[modeKey].bestTime) {
      u.stats[modeKey].bestTime = numTime;
    }
  } else if (score > (u.stats[modeKey].best || 0)) {
    u.stats[modeKey].best = score;
  }
  setActiveUser(u);

  if (modeKey === 'pvp_mode') return;

  const recRef = db.ref(`leaderboards/${modeKey}/${u.uid}`);
  recRef.once("value", snap => {
    const old = snap.val();
    if (modeKey === 'speedrun_mode' && speedTime !== null) {
      const numTime = parseFloat(speedTime);
      if (!old || numTime < (parseFloat(old.time) || 9999)) {
        recRef.set({
          uid: u.uid,
          fullName: `${u.name}${u.tag}`,
          avatar: u.avatar || "👤",
          title: u.title || "Çaylak",
          modeKey: modeKey,
          modeName: modeName,
          time: numTime,
          date: new Date().toLocaleDateString("tr-TR"),
          drops: dropsList || []
        });
      }
    } else if (score > 0) {
      if (!old || score > (old.score || 0)) {
        recRef.set({
          uid: u.uid,
          fullName: `${u.name}${u.tag}`,
          avatar: u.avatar || "👤",
          title: u.title || "Çaylak",
          modeKey: modeKey,
          modeName: modeName,
          score: parseInt(score, 10),
          date: new Date().toLocaleDateString("tr-TR"),
          drops: dropsList || []
        });
      }
    }
  });
}

function deleteAccountPermanently() {
  const u = getActiveUser();
  if (!u || u.isAdmin) return alert("Admin hesabı silinemez!");
  if (!confirm("Hesabınızı ve tüm verilerinizi silmek istediğinize emin misiniz?")) return;

  const safeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  db.ref("accounts/" + safeKey).remove();
  db.ref("users/" + u.uid).remove();

  const modes = ['standard', 'ten_cases', 'catch_basket', 'catch_open', 'mines_mode', 'mega_mode', 'speedrun_mode', 'double_mode', 'temple_mode'];
  modes.forEach(m => db.ref(`leaderboards/${m}/${u.uid}`).remove());
  db.ref("friends/" + u.uid).remove();
  db.ref("friend_requests/" + u.uid).remove();

  localStorage.removeItem("kutu_active_session");
  alert("Hesabınız silindi.");
  window.location.href = "index.html";
}
