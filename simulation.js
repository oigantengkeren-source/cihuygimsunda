/**
 * ============================================================================
 * 🧪 SIMULATION & TESTBENCH UI CONTROLLER (simulation.js)
 * ============================================================================
 * File ini berfungsi untuk menghubungkan modul utama `room-system.js`
 * dengan menu simulasi HTML agar bisa diuji coba secara visual.
 *
 * Tim Frontend/UI nantinya dapat menjadikan file ini sebagai contoh referensi
 * saat menyambungkan `room-system.js` ke UI game utama.
 * ============================================================================
 */

// Elemen DOM Menu Simulasi
const screens = {
  menu: document.getElementById('screen-menu'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game')
};

const inputPlayerName = document.getElementById('input-player-name');
const inputRoomCode = document.getElementById('input-room-code');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

const displayRoomCode = document.getElementById('display-room-code');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnCopyLink = document.getElementById('btn-copy-link');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const btnToggleReady = document.getElementById('btn-toggle-ready');
const btnStartGame = document.getElementById('btn-start-game');

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const docsModal = document.getElementById('docs-modal');
const btnToggleDocs = document.getElementById('btn-toggle-docs');
const btnCloseDocs = document.getElementById('btn-close-docs');

// Elemen Simulasi Game Arena
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hudTimer = document.getElementById('hud-timer');
const hudScore = document.getElementById('hud-score');
const hudRoomCode = document.getElementById('hud-room-code');
const btnBackLobbyTop = document.getElementById('btn-back-lobby-top');
const gameOverModal = document.getElementById('game-over-modal');
const winnerAnnouncement = document.getElementById('winner-announcement');
const leaderboardBody = document.getElementById('leaderboard-body');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const waitingHostNotice = document.getElementById('waiting-host-notice');

// State lokal untuk simulasi arena mini-game
let playerPositions = {};
let coins = [];
let gameTimer = 45;
let hostTimerInterval = null;
let gameAnimationId = null;

// Efek suara sintetis sederhana (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'coin') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'join') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'start') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      osc.frequency.setValueAtTime(554.37, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {}
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function switchScreen(screenName) {
  Object.keys(screens).forEach((key) => {
    screens[key].classList.toggle('active', key === screenName);
  });
}

function escapeHtml(str) {
  return (str || '').replace(
    /[&<>'"]/g,
    (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ============================================================================
// INISIALISASI MODUL UTAMA `CihuyRoomSystem` (dari room-system.js)
// ============================================================================
const roomSystem = new CihuyRoomSystem({
  maxPlayers: 8,

  onRoomCreated: (room) => {
    btnCreateRoom.disabled = false;
    btnCreateRoom.querySelector('span').textContent = 'Buat Room Baru';
    playSound('join');
    switchScreen('lobby');
    showToast(`Room berhasil dibuat! Kode: ${room.code}`, 'success');

    // Simpan session agar saat refresh tetap di dalam room
    const me = roomSystem.getMyPlayer();
    const playerName = me ? me.name : inputPlayerName.value.trim();
    sessionStorage.setItem(
      'cihuy_room_session',
      JSON.stringify({ role: 'host', roomCode: room.code, playerName })
    );
    window.history.replaceState(null, '', `?room=${room.code}`);
  },

  onRoomJoined: (room) => {
    btnJoinRoom.disabled = false;
    btnJoinRoom.querySelector('span').textContent = 'Gabung';
    playSound('join');
    switchScreen('lobby');
    showToast(`Berhasil masuk ke room ${room.code}!`, 'success');

    // Simpan session agar saat refresh tetap di dalam room
    const me = roomSystem.getMyPlayer();
    const playerName = me ? me.name : inputPlayerName.value.trim();
    sessionStorage.setItem(
      'cihuy_room_session',
      JSON.stringify({ role: 'guest', roomCode: room.code, playerName })
    );
    window.history.replaceState(null, '', `?room=${room.code}`);
  },

  onRoomUpdated: (room) => {
    renderLobby(room);
  },

  onPlayerJoined: (player) => {
    playSound('join');
    showToast(`Pemain "${player.name}" bergabung!`, 'info');
  },

  onPlayerLeft: (player) => {
    delete playerPositions[player.id];
    showToast(`Pemain "${player.name}" keluar dari room.`, 'info');
  },

  onChatMessage: (msg) => {
    appendChatMessage(msg);
  },

  onGameStarted: (room, initialData) => {
    playSound('start');
    setupGameArena(room, initialData);
    switchScreen('game');
    showToast('Simulasi game dimulai!', 'success');
  },

  onGameData: (senderId, data) => {
    handleIncomingGameData(senderId, data);
  },

  onGameEnded: (result) => {
    showGameOverModal(result);
  },

  onReturnedToLobby: (room) => {
    stopGameLoop();
    if (hostTimerInterval) clearInterval(hostTimerInterval);
    gameOverModal.style.display = 'none';
    renderLobby(room);
    switchScreen('lobby');
    showToast('Kembali ke Lobby Room!', 'info');
  },

  onKicked: (reason) => {
    stopGameLoop();
    sessionStorage.removeItem('cihuy_room_session');
    window.history.replaceState(null, '', window.location.pathname);
    switchScreen('menu');
    showToast(reason, 'error');
  },

  onError: (message) => {
    btnCreateRoom.disabled = false;
    btnCreateRoom.querySelector('span').textContent = 'Buat Room Baru';
    btnJoinRoom.disabled = false;
    btnJoinRoom.querySelector('span').textContent = 'Gabung';
    showToast(message, 'error');
    if (!roomSystem.room) {
      sessionStorage.removeItem('cihuy_room_session');
    }
  }
});

// ============================================================================
// EVENT HANDLER TOMBOL UI SIMULASI
// ============================================================================

// Simpan & muat nama pemain dari localStorage
const savedName = localStorage.getItem('cihuy_player_name') || '';
if (savedName) inputPlayerName.value = savedName;

// Otomatis isi kode room jika membuka link undangan (?room=KODE)
const urlParams = new URLSearchParams(window.location.search);
const queryRoom = urlParams.get('room');
if (queryRoom) {
  inputRoomCode.value = queryRoom.toUpperCase();
}

function getValidPlayerName() {
  const name = inputPlayerName.value.trim();
  if (!name) {
    showToast('Masukkan nama pemain terlebih dahulu!', 'error');
    inputPlayerName.focus();
    return null;
  }
  localStorage.setItem('cihuy_player_name', name);
  return name;
}

// 1. Tombol Buat Room (Host)
btnCreateRoom.addEventListener('click', async () => {
  const name = getValidPlayerName();
  if (!name) return;

  btnCreateRoom.disabled = true;
  btnCreateRoom.querySelector('span').textContent = 'Membuat Room...';
  try {
    await roomSystem.createRoom(name);
  } catch (e) {
    btnCreateRoom.disabled = false;
    btnCreateRoom.querySelector('span').textContent = 'Buat Room Baru';
  }
});

// 2. Tombol Gabung Room (Join dengan Kode)
btnJoinRoom.addEventListener('click', async () => {
  const name = getValidPlayerName();
  if (!name) return;

  const code = inputRoomCode.value.trim().toUpperCase();
  if (!code || code.length < 3) {
    showToast('Masukkan Kode Room dari Host!', 'error');
    inputRoomCode.focus();
    return;
  }

  btnJoinRoom.disabled = true;
  btnJoinRoom.querySelector('span').textContent = 'Menghubungkan...';
  try {
    await roomSystem.joinRoom(code, name);
  } catch (e) {
    btnJoinRoom.disabled = false;
    btnJoinRoom.querySelector('span').textContent = 'Gabung';
  }
});

inputRoomCode.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') btnJoinRoom.click();
});

// 3. Salin Kode & Link Undangan
btnCopyCode.addEventListener('click', () => {
  if (!roomSystem.room) return;
  navigator.clipboard.writeText(roomSystem.room.code).then(() => {
    showToast(`Kode Room [${roomSystem.room.code}] disalin!`, 'success');
  });
});

btnCopyLink.addEventListener('click', () => {
  if (!roomSystem.room) return;
  const link = roomSystem.getInviteLink();
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link undangan berhasil disalin!', 'success');
  });
});

// 4. Keluar Room
btnLeaveRoom.addEventListener('click', () => {
  stopGameLoop();
  if (hostTimerInterval) clearInterval(hostTimerInterval);
  sessionStorage.removeItem('cihuy_room_session');
  window.history.replaceState(null, '', window.location.pathname);
  roomSystem.leaveRoom();
  switchScreen('menu');
  showToast('Kamu telah keluar dari room.', 'info');
});

// 5. Toggle Ready (Guest)
btnToggleReady.addEventListener('click', () => {
  roomSystem.toggleReady();
});

// 6. Mulai Simulasi Game (Host)
btnStartGame.addEventListener('click', () => {
  if (!roomSystem.isHost || !roomSystem.room) return;

  // Buat posisi awal pemain & koin untuk simulasi
  const initialPositions = {};
  roomSystem.room.players.forEach((p, idx) => {
    initialPositions[p.id] = {
      x: 100 + (idx % 4) * 140,
      y: 100 + Math.floor(idx / 4) * 160
    };
  });

  const initialCoins = spawnCoins(12);
  roomSystem.startGame({
    positions: initialPositions,
    coins: initialCoins,
    timer: 45
  });
});

// 7. Kirim Pesan Chat Room
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  roomSystem.sendChat(text);
  chatInput.value = '';
});

// 8. Kembali ke Lobby
btnReturnLobby.addEventListener('click', () => {
  roomSystem.returnToLobby();
});

btnBackLobbyTop.addEventListener('click', () => {
  if (roomSystem.isHost) {
    roomSystem.returnToLobby();
  } else {
    showToast('Hanya Host yang bisa mengembalikan seluruh room ke Lobby.', 'info');
  }
});

// 9. Modal Dokumentasi Kode untuk Tim UI
btnToggleDocs.addEventListener('click', () => {
  docsModal.style.display = 'flex';
});
btnCloseDocs.addEventListener('click', () => {
  docsModal.style.display = 'none';
});

// ============================================================================
// RENDER LOBBY & CHAT
// ============================================================================
function renderLobby(room) {
  if (!room) return;
  displayRoomCode.textContent = room.code;
  playerCount.textContent = room.players.length;

  playersList.innerHTML = '';
  room.players.forEach((p) => {
    const isMe = p.id === roomSystem.myPlayerId;
    const card = document.createElement('div');
    card.className = `player-card ${isMe ? 'is-me' : ''}`;

    const initial = p.name.charAt(0).toUpperCase();
    let statusBadge = '';
    if (p.isHost) {
      statusBadge = '<span class="badge badge-host">👑 HOST</span>';
    } else if (p.isReady) {
      statusBadge = '<span class="badge badge-ready">✓ SIAP</span>';
    } else {
      statusBadge = '<span class="badge badge-waiting">⏳ BELUM SIAP</span>';
    }

    const kickBtn =
      roomSystem.isHost && !isMe
        ? `<button class="btn-kick" data-id="${p.id}" title="Keluarkan pemain">✕</button>`
        : '';

    card.innerHTML = `
      <div class="player-avatar" style="background-color: ${p.color};">${initial}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)} ${isMe ? '<small>(Kamu)</small>' : ''}</div>
        <div class="player-badges">${statusBadge}</div>
      </div>
      ${kickBtn}
    `;
    playersList.appendChild(card);
  });

  // Event tombol kick untuk Host
  playersList.querySelectorAll('.btn-kick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-id');
      roomSystem.kickPlayer(targetId);
    });
  });

  if (roomSystem.isHost) {
    btnStartGame.style.display = 'inline-flex';
    btnToggleReady.style.display = 'none';
  } else {
    btnStartGame.style.display = 'none';
    btnToggleReady.style.display = 'inline-flex';
    const me = roomSystem.getMyPlayer();
    if (me && me.isReady) {
      btnToggleReady.textContent = '✓ Kamu Sudah Siap!';
      btnToggleReady.className = 'btn btn-warning ready-active';
    } else {
      btnToggleReady.textContent = '⏳ Klik Siap (Ready)';
      btnToggleReady.className = 'btn btn-warning';
    }
  }
}

function appendChatMessage(msg) {
  const item = document.createElement('div');
  if (msg.system) {
    item.className = 'chat-item system';
    item.textContent = `📢 ${msg.text}`;
  } else {
    item.className = 'chat-item';
    item.innerHTML = `
      <span class="sender" style="color: ${msg.senderColor}">${escapeHtml(msg.senderName)}${msg.isHost ? ' 👑' : ''}:</span>
      <span>${escapeHtml(msg.text)}</span>
      <span class="time">${msg.time || ''}</span>
    `;
  }
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================================
// SIMULASI MINI-GAME REALTIME (PEMBUKTIAN SINKRONISASI DATA ROOM)
// ============================================================================
function spawnCoins(count = 12) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      id: 'c_' + Math.random().toString(36).substring(2, 9),
      x: Math.floor(40 + Math.random() * (canvas.width - 80)),
      y: Math.floor(40 + Math.random() * (canvas.height - 80)),
      value: 10
    });
  }
  return list;
}

function setupGameArena(room, initialData = {}) {
  gameOverModal.style.display = 'none';
  hudRoomCode.textContent = room.code;
  gameTimer = initialData.timer || 45;
  hudTimer.textContent = `${gameTimer}s`;
  hudScore.textContent = '0';

  playerPositions = initialData.positions || {};
  coins = initialData.coins || spawnCoins(10);

  room.players.forEach((p, idx) => {
    if (!playerPositions[p.id]) {
      playerPositions[p.id] = { x: 100 + idx * 60, y: 150 };
    }
  });

  // Jika Host, jalankan timer hitung mundur & sinkronkan ke semua pemain
  if (hostTimerInterval) clearInterval(hostTimerInterval);
  if (roomSystem.isHost) {
    hostTimerInterval = setInterval(() => {
      gameTimer--;
      hudTimer.textContent = `${gameTimer}s`;
      roomSystem.sendGameData({ type: 'TIMER_SYNC', timeLeft: gameTimer });

      if (gameTimer <= 0) {
        clearInterval(hostTimerInterval);
        roomSystem.endGame();
      }
    }, 1000);
  }

  startGameLoop();
}

function handleIncomingGameData(senderId, data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'MOVE': {
      playerPositions[senderId] = { x: data.x, y: data.y };
      break;
    }
    case 'COIN_TAKEN': {
      coins = coins.filter((c) => c.id !== data.coinId);
      if (data.newCoin) coins.push(data.newCoin);
      if (roomSystem.room) {
        const p = roomSystem.room.players.find((pl) => pl.id === senderId);
        if (p) p.score = data.newScore;
      }
      break;
    }
    case 'TIMER_SYNC': {
      gameTimer = data.timeLeft;
      hudTimer.textContent = `${gameTimer}s`;
      break;
    }
  }
}

function showGameOverModal(result) {
  stopGameLoop();
  if (hostTimerInterval) clearInterval(hostTimerInterval);
  gameOverModal.style.display = 'flex';

  const winner = result.winner;
  winnerAnnouncement.textContent = winner
    ? `Juara: 👑 ${winner.name} (${winner.score} Poin)`
    : 'Permainan Selesai!';

  leaderboardBody.innerHTML = (result.leaderboard || [])
    .map(
      (p, idx) => `
    <tr>
      <td>#${idx + 1}</td>
      <td style="color: ${p.color}; font-weight: 700;">${escapeHtml(p.name)} ${p.id === roomSystem.myPlayerId ? '(Kamu)' : ''}</td>
      <td><strong>${p.score || 0}</strong></td>
    </tr>
  `
    )
    .join('');

  if (roomSystem.isHost) {
    btnReturnLobby.style.display = 'inline-block';
    waitingHostNotice.style.display = 'none';
  } else {
    btnReturnLobby.style.display = 'none';
    waitingHostNotice.style.display = 'block';
  }
}

// Kontrol Keyboard & Touch (HP)
const keysDown = {};
let touchTarget = null;

window.addEventListener('keydown', (e) => {
  keysDown[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keysDown[e.key.toLowerCase()] = false;
});

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  touchTarget = {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height
  };
});
canvas.addEventListener('pointermove', (e) => {
  if (!touchTarget) return;
  const rect = canvas.getBoundingClientRect();
  touchTarget = {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height
  };
});
window.addEventListener('pointerup', () => {
  touchTarget = null;
});

let lastMoveSent = 0;
let coinPulse = 0;

function startGameLoop() {
  if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
  function loop() {
    updateLocalCharacter();
    renderCanvas();
    gameAnimationId = requestAnimationFrame(loop);
  }
  loop();
}

function stopGameLoop() {
  if (gameAnimationId) {
    cancelAnimationFrame(gameAnimationId);
    gameAnimationId = null;
  }
}

function updateLocalCharacter() {
  if (!roomSystem.room || roomSystem.room.state !== 'playing') return;
  const myId = roomSystem.myPlayerId;
  if (!playerPositions[myId]) {
    playerPositions[myId] = { x: 120, y: 120 };
  }

  const pos = playerPositions[myId];
  const speed = 4.2;
  let dx = 0;
  let dy = 0;

  if (keysDown['w'] || keysDown['arrowup']) dy -= speed;
  if (keysDown['s'] || keysDown['arrowdown']) dy += speed;
  if (keysDown['a'] || keysDown['arrowleft']) dx -= speed;
  if (keysDown['d'] || keysDown['arrowright']) dx += speed;

  // Dukungan sentuh layar untuk pengetesan di HP
  if (dx === 0 && dy === 0 && touchTarget) {
    const tdx = touchTarget.x - pos.x;
    const tdy = touchTarget.y - pos.y;
    const dist = Math.hypot(tdx, tdy);
    if (dist > 6) {
      dx = (tdx / dist) * speed;
      dy = (tdy / dist) * speed;
    }
  } else if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  if (dx !== 0 || dy !== 0) {
    pos.x = Math.max(20, Math.min(canvas.width - 20, pos.x + dx));
    pos.y = Math.max(20, Math.min(canvas.height - 20, pos.y + dy));

    // Cek ambil koin
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (Math.hypot(pos.x - c.x, pos.y - c.y) < 28) {
        coins.splice(i, 1);
        const me = roomSystem.getMyPlayer();
        const newScore = (me ? me.score : 0) + c.value;
        if (me) me.score = newScore;
        hudScore.textContent = newScore;
        playSound('coin');

        const replacementCoin = spawnCoins(1)[0];
        coins.push(replacementCoin);

        roomSystem.updateMyData({ score: newScore });
        roomSystem.sendGameData({
          type: 'COIN_TAKEN',
          coinId: c.id,
          newScore,
          newCoin: replacementCoin
        });
        break;
      }
    }

    const now = performance.now();
    if (now - lastMoveSent > 35) {
      roomSystem.sendGameData({
        type: 'MOVE',
        x: Math.round(pos.x),
        y: Math.round(pos.y)
      });
      lastMoveSent = now;
    }
  }
}

function renderCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid Latar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (!roomSystem.room) return;

  // Gambar Koin
  coinPulse += 0.06;
  const r = 10 + Math.sin(coinPulse) * 1.5;
  coins.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Gambar Semua Pemain di Room
  roomSystem.room.players.forEach((p) => {
    const pos = playerPositions[p.id] || { x: 100, y: 100 };
    const isMe = p.id === roomSystem.myPlayerId;

    if (isMe) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = isMe ? 3 : 2;
    ctx.stroke();

    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${p.name} (${p.score || 0})`, pos.x, pos.y - 22);
  });
}

// ============================================================================
// AUTO-RESTORE SESSION SAAT REFRESH BROWSER
// ============================================================================
window.addEventListener('beforeunload', () => {
  if (roomSystem.isHost && roomSystem.room) {
    try {
      roomSystem._broadcastToGuests({ type: 'HOST_REFRESHING' });
    } catch (e) {}
  }
  if (roomSystem.peer) {
    try {
      roomSystem.peer.destroy();
    } catch (e) {}
  }
});

(async function checkActiveSession() {
  const sessionStr = sessionStorage.getItem('cihuy_room_session');
  if (!sessionStr) return;

  try {
    const session = JSON.parse(sessionStr);
    if (!session || !session.roomCode || !session.playerName) return;

    inputPlayerName.value = session.playerName;
    inputRoomCode.value = session.roomCode;
    showToast(`Menyambungkan kembali ke room [${session.roomCode}]...`, 'info');

    if (session.role === 'host') {
      btnCreateRoom.disabled = true;
      btnCreateRoom.querySelector('span').textContent = 'Menyambungkan...';
      await roomSystem.createRoom(session.playerName, session.roomCode);
    } else {
      btnJoinRoom.disabled = true;
      btnJoinRoom.querySelector('span').textContent = 'Menyambungkan...';
      await roomSystem.joinRoom(session.roomCode, session.playerName);
    }
  } catch (err) {
    sessionStorage.removeItem('cihuy_room_session');
    switchScreen('menu');
  }
})();
