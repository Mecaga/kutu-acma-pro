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

// Hesap Silme İşlemi (Tüm Skorları & Mesaj İsimlerini Günceller)
function deleteAccountPermanently() {
  const u = getActiveUser();
  if (!u) return;

  const conf = confirm("Hesabınızı ve tüm sıralama skorlarınızı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!");
  if (!conf) return;

  const safeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

  // 1. Hesap ve Kullanıcı Düğümünü Sil
  db.ref("accounts/" + safeKey).remove();
  db.ref("users/" + u.uid).remove();

  // 2. Sıralama Tablolarından Skorları Sil
  const modes = ['standard', 'ten_cases', 'catch_open', 'upgrade_mode', 'mines_mode', 'pvp_mode'];
  modes.forEach(m => {
    db.ref(`leaderboards/${m}/${u.uid}`).remove();
  });

  // 3. Global Mesajlardaki Kullanıcı Adını deleteUser#0000 Olarak Güncelle
  db.ref("global_chat").once("value", snap => {
    snap.forEach(child => {
      if (child.val().uid === u.uid) {
        db.ref(`global_chat/${child.key}`).update({
          sender: "deleteUser#0000"
        });
      }
    });
  });

  // 4. Arkadaş İsteklerini ve Bağlarını Sil
  db.ref("friends/" + u.uid).remove();
  db.ref("friend_requests/" + u.uid).remove();

  localStorage.removeItem("kutu_active_session");
  alert("Hesabınız başarıyla silindi.");
  window.location.href = "index.html";
}
