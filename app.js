// --- FIREBASE AYARLARI ---
const firebaseConfig = {
  apiKey: "AIzaSyBrWRQIsPhQqSuiQkhd47HOmxKvsyT_3wc",
  authDomain: "kutu-acma-pro.firebaseapp.com",
  projectId: "kutu-acma-pro",
  storageBucket: "kutu-acma-pro.firebasestorage.app",
  messagingSenderId: "483395048462",
  appId: "1:483395048462:web:450f18178e682a4a2f985f"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Yerel Kullanıcı Verisini Yükle / Başlat
function getCurrentUser() {
    let saved = localStorage.getItem("kutu_user");
    if (!saved) {
        let tagNumber = Math.floor(10000 + Math.random() * 90000);
        let newUser = {
            uid: "UID_" + tagNumber,
            username: "Oyuncu",
            tag: "#" + tagNumber,
            title: "Çaylak",
            level: 1,
            xp: 0,
            gold: 500,
            dailyQuest: 0
        };
        localStorage.setItem("kutu_user", JSON.stringify(newUser));
        return newUser;
    }
    return JSON.parse(saved);
}

function saveCurrentUser(u) {
    localStorage.setItem("kutu_user", JSON.stringify(u));
    // Firebase Genel Sıralamasını Güncelle
    db.ref("leaderboard/" + u.uid).set({
        fullName: `${u.username}${u.tag}`,
        title: u.title,
        level: u.level,
        gold: u.gold
    });
}

function addXP(amount) {
    let u = getCurrentUser();
    u.xp += amount;
    let req = u.level * 100;
    if (u.xp >= req) {
        u.xp -= req;
        u.level++;
        if (u.level >= 5 && u.title === "Çaylak") u.title = "Usta";
        if (u.level >= 10) u.title = "Efsane";
        alert(`🎉 TEBRİKLER! Lvl ${u.level} oldun! Unvan: [${u.title}]`);
    }
    saveCurrentUser(u);
    renderHeader();
}

function renderHeader() {
    let u = getCurrentUser();
    let nameElem = document.getElementById("header-user-tag");
    let goldElem = document.getElementById("header-gold");
    let questElem = document.getElementById("quest-count");

    if (nameElem) nameElem.innerHTML = `${u.username}${u.tag} <span class="user-title">[${u.title}]</span> (Lvl ${u.level})`;
    if (goldElem) goldElem.innerText = u.gold;
    if (questElem) questElem.innerText = `${u.dailyQuest}/3`;
}
