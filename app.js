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

// İsim Değiştirme (Tüm Sıralamalarda & Geçmiş Mesajlarda İsmi Günceller)
function updateUsernameGlobal(newName) {
  const u = getActiveUser();
  if (!u || !newName.trim()) return;

  const oldSafeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const newSafeKey = newName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  db.ref("accounts/" + newSafeKey).once("value", snap => {
    if (snap.exists() && snap.val().uid !== u.uid) {
      return alert("Bu kullanıcı adı zaten kullanımda!");
    }

    // 1. Hesap Anahtarını Değiştir
    db.ref("accounts/" + oldSafeKey).remove();
    db.ref("accounts/" + newSafeKey).set({ uid: u.uid, password: u.password });

    u.name = newName.trim();
    setActiveUser(u);

    // 2. Global Mesajlardaki İsmini Güncelle
    db.ref("global_chat").once("value", mSnap => {
      mSnap.forEach(child => {
        if (child.val().uid === u.uid) {
          db.ref(`global_chat/${child.key}`).update({
            sender: `${u.name}${u.tag}`
          });
        }
      });
    });

    // 3. Sıralama Tablolarındaki İsmini Güncelle
    const modes = ['standard', 'ten_cases', 'catch_open', 'upgrade_mode', 'mines_mode', 'pvp_mode'];
    modes.forEach(m => {
      db.ref(`leaderboards/${m}/${u.uid}`).update({
        fullName: `${u.name}${u.tag}`
      });
    });

    alert("Kullanıcı adınız başarıyla güncellendi!");
    location.reload();
  });
}

// Çift Taraflı Arkadaşlıktan Çıkarma
function removeFriendBidirectional(friendUID, friendName, callback) {
  const u = getActiveUser();
  if (!u) return;

  const conf = confirm(`${friendName} kullanıcısını arkadaşlıktan çıkarmak istediğinize emin misiniz?`);
  if (!conf) return;

  db.ref(`friends/${u.uid}/${friendUID}`).remove();
  db.ref(`friends/${friendUID}/${u.uid}`).remove();

  alert(`${friendName} arkadaş listenizden çıkarıldı.`);
  if (callback) callback();
}

// Kalıcı Hesap Silme (deleteUser#0000)
function deleteAccountPermanently() {
  const u = getActiveUser();
  if (!u) return;

  const conf = confirm("Hesabınızı ve tüm kayıtlarınızı kalıcı olarak silmek istediğinize emin misiniz?");
  if (!conf) return;

  const safeKey = u.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

  db.ref("accounts/" + safeKey).remove();
  db.ref("users/" + u.uid).remove();

  const modes = ['standard', 'ten_cases', 'catch_open', 'upgrade_mode', 'mines_mode', 'pvp_mode'];
  modes.forEach(m => {
    db.ref(`leaderboards/${m}/${u.uid}`).remove();
  });

  db.ref("global_chat").once("value", snap => {
    snap.forEach(child => {
      if (child.val().uid === u.uid) {
        db.ref(`global_chat/${child.key}`).update({
          sender: "deleteUser#0000"
        });
      }
    });
  });

  db.ref("friends/" + u.uid).remove();
  db.ref("friend_requests/" + u.uid).remove();

  localStorage.removeItem("kutu_active_session");
  alert("Hesabınız silindi.");
  window.location.href = "index.html";
}
