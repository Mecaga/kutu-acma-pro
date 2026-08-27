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

function getUser() {
  let u = localStorage.getItem("kutu_user");
  if (!u) {
    let tag = "#" + Math.floor(10000 + Math.random() * 90000);
    let newUser = {
      uid: "U_" + Math.floor(1000 + Math.random() * 9000),
      name: "Mecaga",
      tag: tag,
      title: "Çaylak",
      sound: true,
      dailyQuest: 0,
      gold: 500,
      level: 1,
      xp: 0
    };
    localStorage.setItem("kutu_user", JSON.stringify(newUser));
    return newUser;
  }
  return JSON.parse(u);
}

function saveUser(u) {
  localStorage.setItem("kutu_user", JSON.stringify(u));
  db.ref("registered_users/" + u.uid).set({
    uid: u.uid,
    fullName: `${u.name}${u.tag}`,
    title: u.title,
    level: u.level || 1,
    gold: u.gold || 500,
    lastSeen: Date.now()
  });
}

function addXP(amount) {
  let u = getUser();
  u.xp += amount;
  let req = u.level * 100;
  if (u.xp >= req) {
    u.xp -= req;
    u.level++;
    if (u.level >= 5 && u.title === "Çaylak") u.title = "Usta";
    if (u.level >= 10) u.title = "Efsane";
    alert(`🎉 Seviye Atladın: Lvl ${u.level} [${u.title}]`);
  }
  saveUser(u);
}
