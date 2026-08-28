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

function getActiveUser() {
  const data = localStorage.getItem("kutu_active_session");
  return data ? JSON.parse(data) : null;
}

function setActiveUser(userData) {
  localStorage.setItem("kutu_active_session", JSON.stringify(userData));
  if (userData && userData.uid) {
    db.ref("users/" + userData.uid).update({
      fullName: `${userData.name}${userData.tag}`,
      name: userData.name,
      tag: userData.tag,
      title: userData.title || "Çaylak",
      sound: userData.sound !== undefined ? userData.sound : true,
      stats: userData.stats || {},
      lastOnline: Date.now()
    });
  }
}

function syncUserFromDB(uid, callback) {
  db.ref("users/" + uid).once("value", snap => {
    const val = snap.val();
    if (val) {
      setActiveUser(val);
      if (callback) callback(val);
    }
  });
}

// Kazanma / Kaybetme ve Skor Kaydı
function recordGameScore(modeKey, modeName, score, dropsList, isWin = true) {
  const u = getActiveUser();
  if (!u) return;

  if (!u.stats) u.stats = {};
  if (!u.stats[modeKey]) u.stats[modeKey] = { played: 0, wins: 0, losses: 0, best: 0 };

  u.stats[modeKey].played = (u.stats[modeKey].played || 0) + 1;
  if (isWin && score > 0) {
    u.stats[modeKey].wins = (u.stats[modeKey].wins || 0) + 1;
  } else {
    u.stats[modeKey].losses = (u.stats[modeKey].losses || 0) + 1;
  }

  if (score > (u.stats[modeKey].best || 0)) {
    u.stats[modeKey].best = score;
  }
  setActiveUser(u);

  if (score > 0) {
    const recRef = db.ref(`leaderboards/${modeKey}/${u.uid}`);
    recRef.once("value", snap => {
      const old = snap.val();
      if (!old || score > old.score) {
        recRef.set({
          uid: u.uid,
          fullName: `${u.name}${u.tag}`,
          title: u.title || "Çaylak",
          modeKey: modeKey,
          modeName: modeName,
          score: parseInt(score, 10),
          date: new Date().toLocaleString("tr-TR"),
          drops: dropsList || []
        });
      }
    });
  }
}

function updateUsernameGlobal(newName) {
  const u = getActiveUser();
  if (!u || !newName.trim()) return;

  const oldSafeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const newSafeKey = newName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  db.ref("accounts/" + newSafeKey).once("value", snap => {
    if (snap.exists() && snap.val().uid !== u.uid) {
      return alert("Bu kullanıcı adı zaten kullanımda!");
    }

    db.ref("accounts/" + oldSafeKey).remove();
    db.ref("accounts/" + newSafeKey).set({ uid: u.uid, password: u.password });

    u.name = newName.trim();
    setActiveUser(u);

    db.ref("global_chat").once("value", mSnap => {
      mSnap.forEach(child => {
        if (child.val().uid === u.uid) {
          db.ref(`global_chat/${child.key}`).update({ sender: `${u.name}${u.tag}` });
        }
      });
    });

    const modes = ['standard', 'ten_cases', 'catch_open', 'upgrade_mode', 'mines_mode', 'mega_mode', 'dice_mode', 'jackpot_mode', 'pvp_mode'];
    modes.forEach(m => {
      db.ref(`leaderboards/${m}/${u.uid}`).update({ fullName: `${u.name}${u.tag}` });
    });

    alert("Kullanıcı adınız güncellendi!");
    location.reload();
  });
}

function removeFriendBidirectional(friendUID, friendName, callback) {
  const u = getActiveUser();
  if (!u) return;
  if (!confirm(`${friendName} arkadaşlıktan çıkarılsın mı?`)) return;

  db.ref(`friends/${u.uid}/${friendUID}`).remove();
  db.ref(`friends/${friendUID}/${u.uid}`).remove();
  alert(`${friendName} arkadaş listenizden çıkarıldı.`);
  if (callback) callback();
}

function deleteAccountPermanently() {
  const u = getActiveUser();
  if (!u) return;
  if (!confirm("Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinize emin misiniz?")) return;

  const safeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  db.ref("accounts/" + safeKey).remove();
  db.ref("users/" + u.uid).remove();

  const modes = ['standard', 'ten_cases', 'catch_open', 'upgrade_mode', 'mines_mode', 'mega_mode', 'dice_mode', 'jackpot_mode', 'pvp_mode'];
  modes.forEach(m => {
    db.ref(`leaderboards/${m}/${u.uid}`).remove();
  });

  db.ref("global_chat").once("value", snap => {
    snap.forEach(child => {
      if (child.val().uid === u.uid) {
        db.ref(`global_chat/${child.key}`).update({ sender: "deleteUser#0000" });
      }
    });
  });

  db.ref("friends/" + u.uid).remove();
  db.ref("friend_requests/" + u.uid).remove();
  db.ref("channel_invites/" + u.uid).remove();

  localStorage.removeItem("kutu_active_session");
  alert("Hesabınız silindi.");
  window.location.href = "index.html";
}
