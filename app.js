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
function getUser() {
    let u = localStorage.getItem("mecaga_user");
    if (!u) {
        let newUser = {
            uid: "USER_" + Math.floor(1000 + Math.random() * 9000),
            name: "MecagaTR",
            level: 1,
            xp: 0,
            coins: 1000,
            boxesOpened: 0,
            pvpWins: 0
        };
        localStorage.setItem("mecaga_user", JSON.stringify(newUser));
        return newUser;
    }
    return JSON.parse(u);
}

function saveUser(u) {
    localStorage.setItem("mecaga_user", JSON.stringify(u));
    // Firebase liderlik tablosunu da güncelle
    db.ref("leaderboard/" + u.uid).set({
        name: u.name,
        level: u.level,
        coins: u.coins,
        pvpWins: u.pvpWins || 0
    });
}

function addExp(amount) {
    let u = getUser();
    u.xp += amount;
    let req = u.level * 100;
    if (u.xp >= req) {
        u.xp -= req;
        u.level++;
        alert(`Tebrikler! Seviye Atladın: Lvl ${u.level}`);
    }
    saveUser(u);
    updateGlobalHeader();
}

function updateGlobalHeader() {
    let u = getUser();
    if (document.getElementById("p-name")) document.getElementById("p-name").innerText = u.name;
    if (document.getElementById("p-lvl")) document.getElementById("p-lvl").innerText = `Lvl ${u.level}`;
    if (document.getElementById("p-coins")) document.getElementById("p-coins").innerText = u.coins;
    if (document.getElementById("p-xp-num")) {
        let req = u.level * 100;
        document.getElementById("p-xp-num").innerText = `${u.xp}/${req}`;
        document.getElementById("p-xp-fill").style.width = `${(u.xp / req) * 100}%`;
    }
}
