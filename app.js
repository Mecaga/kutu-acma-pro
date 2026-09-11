// FIREBASE BAŞLATMA
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

// 🔊 DAHİLİ SES EFEKTLERİ MOTORU (Web Audio API)
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  play(type) {
    const u = getActiveUser();
    if (u && u.sound === false) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const now = this.ctx.currentTime;
      if (type === 'click') {
        osc.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'open') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'boom') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'msg') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {}
  }
};

const AVATAR_LIST = [
  "👤", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐸",
  "👑", "💎", "🔥", "⚡", "🍀", "🚀", "🤖", "👻",
  "🌾", "🧑‍🌾", "🐔", "🐮", "🪙", "⚔️", "🛡️", "🎯"
];

// Benzersiz #ID (Etiket) Üretici
function generateUserTag() {
  return "#" + Math.floor(1000 + Math.random() * 9000);
}

// Aktif Kullanıcı Alıcı (Etiket Garantili)
function getActiveUser() {
  const session = localStorage.getItem("kutu_active_session") || localStorage.getItem("kutu_active_user");
  if (!session) return null;
  try {
    let u = JSON.parse(session);
    let realName = u.displayName || u.name || u.username || "Oyuncu";
    u.displayName = realName;
    u.name = realName;
    u.username = String(u.username || realName).toLowerCase().replace(/[^a-z0-9_]/gi, "");
    if (!u.tag) u.tag = generateUserTag();
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
  if (!u.tag) u.tag = generateUserTag();
  if (!u.displayName) u.displayName = u.name || u.username || "Oyuncu";
  if (!u.username) u.username = String(u.displayName).toLowerCase().replace(/[^a-z0-9_]/gi, "");

  localStorage.setItem("kutu_active_session", JSON.stringify(u));
  localStorage.setItem("kutu_active_user", JSON.stringify(u));

  if (db && u.username) {
    db.ref("accounts/" + u.username).update({
      displayName: u.displayName,
      tag: u.tag,
      avatar: u.avatar || "👤",
      title: u.title || "Çaylak",
      sound: u.sound !== false,
      lastOnline: Date.now()
    }).catch(() => {});
  }
}

// Kalıcı Hesap Silme Motoru
function deleteAccountPermanentlyGlobal() {
  const u = getActiveUser();
  if (!u) return;

  if (confirm("DİKKAT! Hesabınız, istatistikleriniz, arkadaşlarınız ve mesajlarınız tamamen silinecek. Emin misiniz?")) {
    if (confirm("Bu işlem geri alınamaz! Son onayınız mı?")) {
      const uKey = String(u.username).toLowerCase();
      if (db) {
        db.ref(`accounts/${uKey}`).remove();
        db.ref(`friends/${uKey}`).remove();
        db.ref(`friend_requests/${uKey}`).remove();
        db.ref(`dms_active/${uKey}`).remove();

        const modes = ['standard', 'catch_open', 'mines_mode', 'speedrun_mode', 'double_mode', 'farm_mode'];
        modes.forEach(m => db.ref(`leaderboards/${m}/${uKey}`).remove());
      }
      localStorage.clear();
      alert("Hesabınız tamamen silindi.");
      location.href = "index.html";
    }
  }
}

// Skor Kaydetme Motoru
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
  const displayName = `${u.displayName} ${u.tag || ''}`;

  if (db) {
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

    if (numVal > 0 || mode === "speedrun_mode") {
      const now = new Date();
      const dateStr = `${now.toLocaleDateString("tr-TR")} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

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
