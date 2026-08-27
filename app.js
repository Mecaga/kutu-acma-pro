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
      title: userData.title || "Çaylak",
      level: userData.level || 1,
      xp: userData.xp || 0,
      gold: userData.gold || 500,
      sound: userData.sound !== undefined ? userData.sound : true,
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

function addXP(amount) {
  let u = getActiveUser();
  if (!u) return;
  u.xp = (u.xp || 0) + amount;
  let needed = (u.level || 1) * 100;
  if (u.xp >= needed) {
    u.xp -= needed;
    u.level = (u.level || 1) + 1;
    if (u.level >= 5 && u.title === "Çaylak") u.title = "Usta";
    if (u.level >= 10) u.title = "Efsane";
    alert(`🎉 Seviye Atladın: Lvl ${u.level} [${u.title}]`);
  }
  setActiveUser(u);
}
