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

const AVATAR_LIST = ["👤", "😄", "😍", "😎", "🤓", "🤠", "😈", "👽", "🎃", "💀", "👁", "🧠", "🎒", "👑"];

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
      avatar: userData.avatar || "👤",
      title: userData.title || "Çaylak",
      isAdmin: userData.isAdmin || false,
      lastOnline: Date.now()
    });
  }
}

// Skor Kayıt Fonksiyonu (Speedrun süre odaklı)
function recordGameScore(modeKey, modeName, score, dropsList, isWin = true, speedTime = null) {
  const u = getActiveUser();
  if (!u) return;

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

  if (modeKey === 'dice_mode' || modeKey === 'pvp_mode') return;

  const recRef = db.ref(`leaderboards/${modeKey}/${u.uid}`);
  recRef.once("value", snap => {
    const old = snap.val();
    if (modeKey === 'speedrun_mode' && speedTime !== null) {
      const numTime = parseFloat(speedTime);
      if (!old || numTime < old.time) {
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
      if (!old || score > old.score) {
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

// Güvenli Çıkış (Admin hesabı silinmez)
function safeLogout() {
  localStorage.removeItem("kutu_active_session");
  window.location.href = "index.html";
}
