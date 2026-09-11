let activeUser = null;
let selectedMode = 'speedrun';

window.onload = () => {
  // app.js'deki kullanıcı kontrolü
  if (typeof getActiveUser === "function") {
    activeUser = getActiveUser();
  } else {
    activeUser = JSON.parse(localStorage.getItem("active_user") || "null");
  }

  if (!activeUser) return location.href = "index.html";
  streamRooms();
};

function setMode(m) {
  selectedMode = m;
  document.querySelectorAll(".mode-card").forEach(c => c.classList.remove("selected"));
  const card = document.getElementById("card-" + m);
  if (card) card.classList.add("selected");
  document.getElementById("sel-modal-room-mode").value = m;
}

function streamRooms() {
  const container = document.getElementById("rooms-list-container");
  if (!container || !window.db) return;

  db.ref("pvp_rooms").on("value", snap => {
    container.innerHTML = "";
    if (!snap.exists()) {
      container.innerHTML = "<div style='color:#64748b; font-size:9.5px; text-align:center; padding:15px;'>Henüz açık oda bulunmuyor. İlk odayı sen aç!</div>";
      return;
    }

    const myKey = String(activeUser.username).toLowerCase();
    snap.forEach(c => {
      const room = c.val();
      const rId = c.key;
      const players = room.players || {};
      const pKeys = Object.keys(players);

      // Maçı bitmiş veya dolu (içinde yoksak) odaları lobi listesinde gösterme
      if (room.state === "finished") return;
      if (pKeys.length >= 2 && !players[myKey]) return;

      const modeTitles = {
        speedrun: "⚡ Speedrun",
        battleship: "🚢 Amiral Battı",
        classic: "⚔️ Normal Kasa",
        mines: "💣 Mayın Tarlası"
      };

      const card = document.createElement("div");
      card.className = "room-item-card";
      card.innerHTML = `
        <div>
          <b style="font-size:11px; color:#38bdf8;">${room.roomName || room.hostName + ' Odası'}</b> 
          <span style="font-size:9px; color:#f59e0b; font-weight:bold;">${room.roomTag || ''}</span>
          <div style="font-size:8px; color:#94a3b8; margin-top:2px;">${modeTitles[room.mode] || room.mode} • Hedef: ${room.targetScore || 100}P</div>
        </div>
        <button type="button" class="btn-start" style="width:auto; padding:6px 12px; font-size:9px; background:#0284c7;" onclick="redirectToArena('${rId}')">Katıl (${pKeys.length}/2) ›</button>
      `;
      container.appendChild(card);
    });
  });
}

function joinByCode() {
  const raw = document.getElementById("in-room-search").value.trim().toLowerCase();
  if (!raw) return alert("Lütfen oda adı veya #ID girin!");

  db.ref("pvp_rooms").once("value", snap => {
    let matchedKey = null;
    if (snap.exists()) {
      snap.forEach(c => {
        const r = c.val();
        const tag = String(r.roomTag || '').toLowerCase();
        const name = String(r.roomName || '').toLowerCase();
        if (c.key.toLowerCase() === raw || tag === raw || tag === '#' + raw || name === raw) {
          matchedKey = c.key;
        }
      });
    }
    if (matchedKey) redirectToArena(matchedKey);
    else alert("Girdiğiniz #ID veya ada sahip açık oda bulunamadı!");
  });
}

function openCreateModal() {
  document.getElementById("in-modal-room-name").value = `${activeUser.displayName || activeUser.username} Arenası`;
  document.getElementById("modal-create-room").style.display = "flex";
}

function executeCreateRoom() {
  const rName = document.getElementById("in-modal-room-name").value.trim() || `${activeUser.displayName} Odası`;
  const mode = document.getElementById("sel-modal-room-mode").value;
  const target = parseInt(document.getElementById("sel-modal-room-target").value) || 100;
  const myKey = String(activeUser.username).toLowerCase();
  const generatedTag = "#" + Math.floor(1000 + Math.random() * 9000);
  const rId = "pvp_" + Date.now().toString(36);

  const payload = {
    hostKey: myKey,
    hostName: activeUser.displayName || activeUser.username,
    roomName: rName,
    roomTag: generatedTag,
    mode: mode,
    targetScore: target,
    maxPlayers: 2,
    state: "waiting",
    createdAt: Date.now(),
    players: {
      [myKey]: {
        name: activeUser.displayName || activeUser.username,
        avatar: activeUser.avatar || "👤",
        score: 0,
        ready: false
      }
    }
  };

  db.ref("pvp_rooms/" + rId).set(payload).then(() => {
    document.getElementById("modal-create-room").style.display = "none";
    redirectToArena(rId);
  });
}

function redirectToArena(roomId) {
  window.location.href = `pvp-arena.html?roomId=${roomId}`;
}
