// Firebase SDK Bağlantısı (Kendi yapılandırmanızı girin)
const firebaseConfig = {
  apiKey: "SENIN_API_KEY",
  authDomain: "SENIN_AUTH_DOMAIN",
  databaseURL: "SENIN_DATABASE_URL",
  projectId: "SENIN_PROJECT_ID",
  storageBucket: "SENIN_STORAGE_BUCKET",
  messagingSenderId: "SENIN_SENDER_ID",
  appId: "SENIN_APP_ID"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Yerel Kullanıcı Profili
let user = JSON.parse(localStorage.getItem("kutu_user")) || {
  uid: "U_" + Math.floor(1000 + Math.random() * 9000),
  name: "Mecaga",
  tag: "#" + Math.floor(10000 + Math.random() * 90000),
  title: "Çaylak",
  sound: true,
  dailyQuest: 0
};

// State Değişkenleri
let currentMode = "standard";
let activeChatTab = 1; // 1: Global, 2: Kanallar, 3: Arkadaş DM
let activeDMTarget = null;
let activePvPRoom = null;
let pvpMaxPlayers = 2;
let pvpTotalBoxes = 5;
let myOpenedBoxes = 0;
let myPvPScore = 0;

window.onload = () => {
  saveUserData();
  updateLobbyUI();
  listenGlobalChat();
  listenUserRegistry();
};

function saveUserData() {
  localStorage.setItem("kutu_user", JSON.stringify(user));
  db.ref("registered_users/" + user.uid).set({
    uid: user.uid,
    fullName: `${user.name}${user.tag}`,
    title: user.title,
    lastSeen: Date.now()
  });
}

function updateLobbyUI() {
  document.getElementById("lobby-user-tag").innerText = `${user.name}${user.tag}`;
  document.getElementById("lobby-user-title").innerText = `[${user.title}]`;
  document.getElementById("quest-txt").innerText = `${user.dailyQuest}/3`;
  document.getElementById("settings-title-select").value = user.title;
  document.getElementById("sound-toggle-btn").innerText = user.sound ? "🔊 Ses: Açık" : "🔇 Ses: Kapalı";
}

function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* --- GİRİŞ & ÇIKIŞ --- */
function login() {
  let name = document.getElementById("auth-name").value.trim();
  if (!name) return alert("Kullanıcı adı giriniz!");
  user.name = name;
  saveUserData();
  updateLobbyUI();
  switchScreen("screen-lobby");
}

function logout() {
  saveUserData();
  switchScreen("screen-auth");
}

/* --- AYARLAR & UNVAN SİSTEMİ --- */
function openSettings() { document.getElementById("modal-settings").style.display = "flex"; }
function closeSettings() { document.getElementById("modal-settings").style.display = "none"; }
function toggleSound() {
  user.sound = !user.sound;
  saveUserData();
  updateLobbyUI();
}
function changeTitle(newTitle) {
  user.title = newTitle;
  saveUserData();
  updateLobbyUI();
}

/* --- OYUN MODU SEÇİMİ --- */
function setGameMode(mode, el) {
  currentMode = mode;
  document.querySelectorAll(".mode-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
}

function startGame() {
  if (currentMode === "pvp") {
    switchScreen("screen-pvp");
  } else {
    user.dailyQuest = Math.min(3, user.dailyQuest + 1);
    saveUserData();
    updateLobbyUI();
    alert(`${currentMode.toUpperCase()} Modu Oynandı! Günlük Görev: ${user.dailyQuest}/3`);
  }
}

/* --- ONLINE PVP MEKANİĞİ --- */
function changePvPMode(players) {
  pvpMaxPlayers = players;
  pvpTotalBoxes = players * 5; // Her kişi başı 5 kutu
  document.getElementById("pvp-mode-title").innerText = `${players} Kişilik Oda (${pvpTotalBoxes} Kutu)`;
}

function createPvPRoom() {
  let code = "PVP_" + Math.floor(1000 + Math.random() * 9000);
  activePvPRoom = code;
  myOpenedBoxes = 0;
  myPvPScore = 0;

  let initialPlayers = {};
  initialPlayers[user.uid] = { name: `${user.name}${user.tag}`, score: 0, opened: 0, items: [] };

  db.ref("pvp_rooms/" + code).set({
    maxPlayers: pvpMaxPlayers,
    totalBoxes: pvpTotalBoxes,
    status: "waiting",
    players: initialPlayers
  });
  listenPvPRoom(code);
  alert("Oda Kuruldu: " + code);
}

function joinPvPRoom() {
  let code = document.getElementById("pvp-room-code").value.trim();
  if (!code) return alert("Oda kodu girin!");
  activePvPRoom = code;
  myOpenedBoxes = 0;
  myPvPScore = 0;

  db.ref("pvp_rooms/" + code).transaction(room => {
    if (room && Object.keys(room.players || {}).length < room.maxPlayers) {
      room.players[user.uid] = { name: `${user.name}${user.tag}`, score: 0, opened: 0, items: [] };
      if (Object.keys(room.players).length === room.maxPlayers) {
        room.status = "playing";
      }
    }
    return room;
  });
  listenPvPRoom(code);
}

function listenPvPRoom(code) {
  db.ref("pvp_rooms/" + code).on("value", snap => {
    let room = snap.val();
    if (!room) return;

    let pList = Object.values(room.players || {});
    let pGrid = document.getElementById("pvp-players-row");
    pGrid.innerHTML = "";

    pList.forEach(p => {
      let isMe = p.name === `${user.name}${user.tag}`;
      pGrid.innerHTML += `
        <div class="pvp-player-col filled">
          <div style="font-size:11px; color:#38bdf8;">${p.name} ${isMe ? '(Sen)' : ''}</div>
          <div style="font-size:22px; font-weight:900; color:#10b981;">${p.score} P</div>
          <div style="font-size:10px; color:#aaa;">${p.opened}/${room.totalBoxes} Kutu</div>
        </div>
      `;
    });

    let statusText = document.getElementById("pvp-status-banner");
    if (room.status === "playing") {
      statusText.innerText = "⚔️ OYUN BAŞLADI!";
      renderPvPBoxes(room.totalBoxes);
    } else {
      statusText.innerText = `⏳ Bekleniyor (${pList.length}/${room.maxPlayers})`;
    }
  });
}

function renderPvPBoxes(total) {
  let grid = document.getElementById("pvp-box-grid");
  if (grid.children.length > 0) return;
  grid.innerHTML = "";

  const items = [
    { n: "Tahta Kılıç", p: 2, r: "Classic" },
    { n: "Demir Balta", p: 4, r: "Super" },
    { n: "Gümüş Yüzük", p: 8, r: "Ultra" },
    { n: "Ejder Baltası", p: 25, r: "Omega" },
    { n: "Kristal Kılıç", p: 100, r: "Godly" }
  ];

  for (let i = 0; i < total; i++) {
    let box = document.createElement("div");
    box.className = "pvp-box-slot";
    box.id = `pvp-box-${i}`;
    box.innerHTML = `📦<br>${i + 1}`;
    box.onclick = () => {
      if (box.classList.contains("opened") || myOpenedBoxes >= total) return;
      box.classList.add("opened");
      let item = items[Math.floor(Math.random() * items.length)];
      box.innerHTML = `<span style="color:#60a5fa; font-size:8px;">${item.n}</span><br><b style="color:#10b981;">+${item.p}P</b>`;

      myOpenedBoxes++;
      myPvPScore += item.p;

      db.ref(`pvp_rooms/${activePvPRoom}/players/${user.uid}`).update({
        score: myPvPScore,
        opened: myOpenedBoxes
      });

      if (myOpenedBoxes === total) {
        setTimeout(() => alert("🏁 10sn Sonra Kazanan Açıklanıyor!"), 1000);
      }
    };
    grid.appendChild(box);
  }
}

/* --- SOHBET / KANALLAR / DM SİSTEMİ --- */
function setChatTab(tab) {
  activeChatTab = tab;
  document.querySelectorAll(".chat-subtab").forEach((t, i) => t.classList.toggle("active", i + 1 === tab));
  document.getElementById("chat-global-view").style.display = tab === 1 ? "flex" : "none";
  document.getElementById("chat-channels-view").style.display = tab === 2 ? "flex" : "none";
  document.getElementById("chat-dm-view").style.display = tab === 3 ? "flex" : "none";
}

function listenGlobalChat() {
  db.ref("global_chat").limitToLast(30).on("value", snap => {
    let box = document.getElementById("chat-global-view");
    box.innerHTML = "";
    snap.forEach(c => {
      let m = c.val(), k = c.key, isMe = m.uid === user.uid;
      box.innerHTML += `
        <div class="msg-bubble ${isMe ? 'me' : 'other'}">
          <div class="msg-author">${m.sender} [${m.title}]</div>
          <div id="gtxt-${k}">${m.text}</div>
          <div class="msg-actions">
            <span onclick="navigator.clipboard.writeText('${m.text}'); alert('Kopyalandı');">📋 Kopyala</span>
            ${isMe ? `<span onclick="editGlobalMsg('${k}')">✏️ Düzenle</span><span onclick="deleteGlobalMsg('${k}')" style="color:var(--danger)">🗑️ Sil</span>` : ''}
          </div>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  });
}

function sendChatMessage() {
  let input = document.getElementById("chat-input-text");
  if (!input.value.trim()) return;

  if (activeChatTab === 1) {
    db.ref("global_chat").push({ uid: user.uid, sender: `${user.name}${user.tag}`, title: user.title, text: input.value.trim() });
  } else if (activeChatTab === 3 && activeDMTarget) {
    let chatID = [user.uid, activeDMTarget.uid].sort().join("_");
    db.ref("dm_chats/" + chatID).push({ uid: user.uid, sender: `${user.name}${user.tag}`, text: input.value.trim() });
  }
  input.value = "";
}

function editGlobalMsg(key) {
  let old = document.getElementById(`gtxt-${key}`).innerText;
  let updated = prompt("Mesajı düzenle:", old);
  if (updated && updated !== old) db.ref(`global_chat/${key}/text`).set(updated + " (düzenlendi)");
}

function deleteGlobalMsg(key) {
  if (confirm("Mesajı silmek istiyor musun?")) db.ref(`global_chat/${key}`).remove();
}

function createNewChannel() {
  let name = prompt("Yeni Kanal Adı:");
  let isPrivate = confirm("Kanal ÖZEL mi olsun? (Tamam: Özel, İptal: Açık)");
  if (!name) return;
  let id = name.toLowerCase().replace(/\s+/g, '-');
  db.ref("channels/" + id).set({ name: name, type: isPrivate ? "Özel" : "Açık" });
  loadChannels();
}

function loadChannels() {
  db.ref("channels").on("value", snap => {
    let box = document.getElementById("chat-channels-view");
    box.innerHTML = "";
    snap.forEach(c => {
      let ch = c.val();
      box.innerHTML += `
        <div class="mode-card" style="display:flex; justify-content:space-between;">
          <span># ${ch.name}</span>
          <b style="color:${ch.type === 'Özel' ? 'var(--danger)' : 'var(--btn-green)'}">[${ch.type}]</b>
        </div>
      `;
    });
  });
}

/* --- ARKADAŞLIK & KULLANICI LİSTESİ --- */
function listenUserRegistry() {
  db.ref("registered_users").on("value", snap => {
    let list = document.getElementById("friends-all-users-list");
    list.innerHTML = "";
    snap.forEach(u => {
      let reg = u.val();
      if (reg.uid === user.uid) return;
      list.innerHTML += `
        <div class="mode-card" style="display:flex; justify-content:space-between; align-items:center;">
          <span>👤 ${reg.fullName} <small style="color:#c084fc;">[${reg.title}]</small></span>
          <div style="display:flex; gap:4px;">
            <button class="btn-sm" style="background:var(--btn-green);" onclick="sendFriendRequest('${reg.uid}', '${reg.fullName}')">➕ İstek</button>
            <button class="btn-sm" style="background:var(--neon-purple);" onclick="startDirectMessage('${reg.uid}', '${reg.fullName}')">💬 Mesaj</button>
          </div>
        </div>
      `;
    });
  });
}

function sendFriendRequest(targetUID, targetName) {
  db.ref(`friend_requests/${targetUID}/${user.uid}`).set({
    fromUID: user.uid,
    fromName: `${user.name}${user.tag}`
  });
  alert(`${targetName} kullanıcısına istek gönderildi!`);
}

function openFriendRequests() {
  db.ref("friend_requests/" + user.uid).once("value", snap => {
    let box = document.getElementById("request-list-items");
    box.innerHTML = "";
    snap.forEach(r => {
      let req = r.val();
      box.innerHTML += `
        <div class="mode-card" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${req.fromName}</span>
          <div style="display:flex; gap:4px;">
            <button class="btn-sm" style="background:var(--btn-green);" onclick="acceptFriend('${req.fromUID}', '${req.fromName}')">Kabul</button>
            <button class="btn-sm" style="background:var(--danger);" onclick="rejectFriend('${req.fromUID}', '${req.fromName}')">Reddet</button>
          </div>
        </div>
      `;
    });
    document.getElementById("modal-requests").style.display = "flex";
  });
}

function acceptFriend(targetUID, targetName) {
  db.ref(`friends/${user.uid}/${targetUID}`).set({ name: targetName });
  db.ref(`friends/${targetUID}/${user.uid}`).set({ name: `${user.name}${user.tag}` });
  db.ref(`friend_requests/${user.uid}/${targetUID}`).remove();
  alert(`${targetName} arkadaş olarak eklendi!`);
  document.getElementById("modal-requests").style.display = "none";
}

function rejectFriend(targetUID, targetName) {
  db.ref(`friend_requests/${user.uid}/${targetUID}`).remove();
  alert(`${targetName} kullanıcısına gönderdiğiniz arkadaşlık isteğini kabul etmedi.`);
  document.getElementById("modal-requests").style.display = "none";
}

function startDirectMessage(targetUID, targetName) {
  activeDMTarget = { uid: targetUID, name: targetName };
  switchScreen("screen-chat");
  setChatTab(3);

  let chatID = [user.uid, targetUID].sort().join("_");
  db.ref("dm_chats/" + chatID).on("value", snap => {
    let box = document.getElementById("chat-dm-view");
    box.innerHTML = `<div style="font-size:11px; color:#fbbf24; text-align:center;">💬 ${targetName} ile Özel Sohbet</div>`;
    snap.forEach(c => {
      let m = c.val(), isMe = m.uid === user.uid;
      box.innerHTML += `
        <div class="msg-bubble ${isMe ? 'me' : 'other'}">
          <div>${m.text}</div>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  });
}
