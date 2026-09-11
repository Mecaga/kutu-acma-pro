// GitHub: mode-battleship.js
let _roomRef = null;
let _activeUser = null;
let _roomData = null;

window.initGameMode = function(roomRef, activeUser, roomData) {
  _roomRef = roomRef;
  _activeUser = activeUser;
  _roomData = roomData;
  setupBattleship();
};

window.onRoomDataUpdate = function(newRoomData) {
  _roomData = newRoomData;
  syncBattleshipTurn();
};

function setupBattleship() {
  const container = document.getElementById("arena-content");
  const myKey = String(_activeUser.username).toLowerCase();

  // Her oyuncuya ait 3 adet rastgele gizli gemi koordinatı oluştur
  _roomRef.child("game_state/ships/" + myKey).transaction(current => {
    if (!current) {
      let ships = [];
      while(ships.length < 3) {
        let r = Math.floor(Math.random() * 25);
        if(!ships.includes(r)) ships.push(r);
      }
      return ships;
    }
    return current;
  });

  container.innerHTML = `
    <div style="text-align:center;">
      <div id="turn-indicator" style="font-size:12px; color:#38bdf8; font-weight:bold; margin-bottom:8px;">Izgara Hazırlanıyor...</div>
      <div class="ship-grid" id="ship-grid"></div>
    </div>
  `;

  const grid = document.getElementById("ship-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.id = "cell-" + i;
    cell.innerText = "🌊";
    cell.onclick = () => fireAtEnemy(i);
    grid.appendChild(cell);
  }
}

function syncBattleshipTurn() {
  const myKey = String(_activeUser.username).toLowerCase();
  const enemyKey = Object.keys(_roomData.players || {}).find(k => k !== myKey);
  const currentTurn = _roomData.game_state?.turn || Object.keys(_roomData.players || {})[0];
  
  const indicator = document.getElementById("turn-indicator");
  if (!indicator) return;

  if (currentTurn === myKey) {
    indicator.innerText = "🎯 Sıra Sende! Rakibin gemisini vur!";
    indicator.style.color = "#22c55e";
  } else {
    indicator.innerText = "⏳ Rakibin hamlesi bekleniyor...";
    indicator.style.color = "#ef4444";
  }

  // Atılan atışları senkronize boya
  const enemyShots = _roomData.game_state?.shots?.[myKey] || {};
  Object.keys(enemyShots).forEach(idx => {
    const cell = document.getElementById("cell-" + idx);
    if (cell) {
      cell.onclick = null;
      if (enemyShots[idx] === "hit") {
        cell.innerText = "💥";
        cell.classList.add("hit");
      } else {
        cell.innerText = "❌";
        cell.classList.add("miss");
      }
    }
  });
}

function fireAtEnemy(index) {
  const myKey = String(_activeUser.username).toLowerCase();
  const enemyKey = Object.keys(_roomData.players || {}).find(k => k !== myKey);
  const currentTurn = _roomData.game_state?.turn || Object.keys(_roomData.players || {})[0];

  if (currentTurn !== myKey) return alert("Sıra rakipte!");

  _roomRef.child("game_state/ships/" + enemyKey).once("value", snap => {
    const enemyShips = snap.val() || [];
    const isHit = enemyShips.includes(index);
    const result = isHit ? "hit" : "miss";

    // Hamleyi kaydet ve sırayı rakibe devret
    _roomRef.child(`game_state/shots/${myKey}/${index}`).set(result);
    _roomRef.child("game_state/turn").set(enemyKey);

    if (isHit) {
      const currentScore = (_roomData.players[myKey].score || 0) + 35;
      _roomRef.child(`players/${myKey}/score`).set(currentScore);
      
      if (currentScore >= (_roomData.targetScore || 100)) {
        alert("🏆 TEBRİKLER! Düşman filosunu yok ettin!");
        _roomRef.update({ state: "finished" });
      }
    }
  });
}
