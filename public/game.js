// Inisialisasi koneksi Socket.io
const socket = io();

// State lokal
let myPlayerId = null;
let currentRoom = null;
let amIHost = false;
let myPlayerName = localStorage.getItem('cihuy_player_name') || '';

// Web Audio API Synthesizer (Efek suara retro 8-bit tanpa perlu file audio eksternal)
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
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
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
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

// Elemen DOM
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

// Canvas Game elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hudTimer = document.getElementById('hud-timer');
const hudScore = document.getElementById('hud-score');
const hudRoomCode = document.getElementById('hud-room-code');
const gameOverModal = document.getElementById('game-over-modal');
const winnerAnnouncement = document.getElementById('winner-announcement');
const leaderboardBody = document.getElementById('leaderboard-body');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const waitingHostNotice = document.getElementById('waiting-host-notice');

// Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Ganti Layar Aktif
function switchScreen(screenName) {
  Object.keys(screens).forEach(key => {
    screens[key].classList.toggle('active', key === screenName);
  });
}

let serverInfo = null;

// Ambil info IP jaringan dari server
fetch('/api/info')
  .then(res => res.json())
  .then(data => {
    serverInfo = data;
    const banner = document.getElementById('network-ip-banner');
    const ipText = document.getElementById('network-ip-text');
    if (banner && ipText && data.localIp && data.localIp !== 'localhost') {
      banner.style.display = 'inline-block';
      ipText.textContent = `http://${data.localIp}:${data.port}`;
    }
  })
  .catch(() => {});

// Pre-fill nama jika pernah disimpan
if (myPlayerName) {
  inputPlayerName.value = myPlayerName;
}

// Cek apakah ada param ?room=CODE di URL
const urlParams = new URLSearchParams(window.location.search);
const queryRoom = urlParams.get('room');
if (queryRoom) {
  inputRoomCode.value = queryRoom.toUpperCase();
}

function getValidPlayerName() {
  const name = inputPlayerName.value.trim();
  if (!name) {
    showToast('Silakan masukkan nama kamu terlebih dahulu!', 'error');
    inputPlayerName.focus();
    return null;
  }
  localStorage.setItem('cihuy_player_name', name);
  return name;
}

// 1. EVENT KLIK BUAT ROOM (HOST)
btnCreateRoom.addEventListener('click', () => {
  const name = getValidPlayerName();
  if (!name) return;

  btnCreateRoom.disabled = true;
  socket.emit('create_room', { playerName: name });
});

// 2. EVENT KLIK GABUNG ROOM (GUEST)
btnJoinRoom.addEventListener('click', () => {
  const name = getValidPlayerName();
  if (!name) return;

  const code = inputRoomCode.value.trim().toUpperCase();
  if (!code || code.length < 3) {
    showToast('Masukkan kode room yang valid!', 'error');
    inputRoomCode.focus();
    return;
  }

  btnJoinRoom.disabled = true;
  socket.emit('join_room', { roomCode: code, playerName: name });
});

// Izinkan enter di input room code
inputRoomCode.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') btnJoinRoom.click();
});

// 3. SALIN KODE ROOM & INVITE LINK
btnCopyCode.addEventListener('click', () => {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom.code).then(() => {
    showToast(`Kode room [${currentRoom.code}] berhasil disalin!`, 'success');
  }).catch(() => {
    showToast(`Kode: ${currentRoom.code}`, 'info');
  });
});

btnCopyLink.addEventListener('click', () => {
  if (!currentRoom) return;
  let origin = window.location.origin;
  // Jika host membuka lewat localhost tapi ada IP jaringan, gunakan IP jaringan agar bisa dibuka HP/device lain
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && serverInfo && serverInfo.localIp && serverInfo.localIp !== 'localhost') {
    origin = `http://${serverInfo.localIp}:${serverInfo.port || 3000}`;
  }
  const inviteUrl = `${origin}${window.location.pathname}?room=${currentRoom.code}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast('Link undangan berhasil disalin!', 'success');
  }).catch(() => {
    showToast(`Link: ${inviteUrl}`, 'info');
  });
});

// 4. KELUAR ROOM
btnLeaveRoom.addEventListener('click', () => {
  socket.emit('leave_room');
  currentRoom = null;
  myPlayerId = null;
  btnCreateRoom.disabled = false;
  btnJoinRoom.disabled = false;
  switchScreen('menu');
  showToast('Kamu keluar dari room.', 'info');
});

// 5. READY TOGGLE (GUEST)
btnToggleReady.addEventListener('click', () => {
  socket.emit('toggle_ready');
});

// 6. MULAI GAME (HOST)
btnStartGame.addEventListener('click', () => {
  socket.emit('start_game');
});

// 7. CHAT MESSAGE
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('send_chat', { text });
  chatInput.value = '';
});

// 8. KEMBALI KE LOBBY (HOST)
btnReturnLobby.addEventListener('click', () => {
  socket.emit('return_to_lobby');
});

// ==================== SOCKET.IO LISTENERS ====================

socket.on('room_created', (data) => {
  btnCreateRoom.disabled = false;
  myPlayerId = data.playerId;
  currentRoom = data.room;
  amIHost = true;
  playSound('join');
  renderLobby();
  switchScreen('lobby');
  showToast(`Room berhasil dibuat! Kode: ${data.roomCode}`, 'success');
});

socket.on('joined_room', (data) => {
  btnJoinRoom.disabled = false;
  myPlayerId = data.playerId;
  currentRoom = data.room;
  amIHost = (data.room.hostId === myPlayerId);
  playSound('join');
  renderLobby();
  switchScreen('lobby');
  showToast(`Berhasil masuk ke room ${data.roomCode}!`, 'success');
});

socket.on('join_error', ({ message }) => {
  btnJoinRoom.disabled = false;
  showToast(message, 'error');
});

socket.on('error_message', (msg) => {
  showToast(msg, 'error');
});

socket.on('room_updated', (room) => {
  currentRoom = room;
  amIHost = (room.hostId === myPlayerId);
  renderLobby();
});

socket.on('chat_message', (msg) => {
  const item = document.createElement('div');
  if (msg.system) {
    item.className = 'chat-item system';
    item.textContent = `📢 ${msg.text}`;
  } else {
    item.className = 'chat-item';
    item.innerHTML = `
      <span class="sender" style="color: ${msg.senderColor}">${msg.senderName}${msg.isHost ? ' 👑' : ''}:</span>
      <span>${escapeHtml(msg.text)}</span>
      <span class="time">${msg.time}</span>
    `;
  }
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('game_started', (room) => {
  currentRoom = room;
  playSound('start');
  gameOverModal.style.display = 'none';
  hudRoomCode.textContent = room.code;
  hudTimer.textContent = `${room.gameTimer}s`;
  hudScore.textContent = '0';
  switchScreen('game');
  startGameLoop();
  showToast('Permainan dimulai! Gerakkan karaktermu!', 'success');
});

socket.on('timer_tick', ({ timeLeft }) => {
  hudTimer.textContent = `${timeLeft}s`;
});

socket.on('coin_collected', ({ coinId, playerId, newScore }) => {
  if (currentRoom) {
    currentRoom.coins = currentRoom.coins.filter(c => c.id !== coinId);
    const p = currentRoom.players.find(pl => pl.id === playerId);
    if (p) p.score = newScore;
  }
  if (playerId === myPlayerId) {
    hudScore.textContent = newScore;
    playSound('coin');
  }
});

socket.on('new_coin_spawned', (coin) => {
  if (currentRoom && currentRoom.coins) {
    currentRoom.coins.push(coin);
  }
});

socket.on('player_moved', ({ id, x, y }) => {
  if (currentRoom && currentRoom.players) {
    const p = currentRoom.players.find(pl => pl.id === id);
    if (p) {
      p.x = x;
      p.y = y;
    }
  }
});

socket.on('game_ended', ({ winner, leaderboard }) => {
  stopGameLoop();
  gameOverModal.style.display = 'flex';
  winnerAnnouncement.textContent = `Juara: 👑 ${winner.name} (${winner.score} Poin)`;

  leaderboardBody.innerHTML = leaderboard.map((p, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td style="color: ${p.color}; font-weight: 700;">${p.name} ${p.id === myPlayerId ? '(Kamu)' : ''}</td>
      <td><strong>${p.score}</strong></td>
    </tr>
  `).join('');

  if (amIHost) {
    btnReturnLobby.style.display = 'inline-block';
    waitingHostNotice.style.display = 'none';
  } else {
    btnReturnLobby.style.display = 'none';
    waitingHostNotice.style.display = 'block';
  }
});

socket.on('returned_to_lobby', (room) => {
  currentRoom = room;
  stopGameLoop();
  gameOverModal.style.display = 'none';
  renderLobby();
  switchScreen('lobby');
  showToast('Kembali ke lobby untuk ronde berikutnya!', 'info');
});

// Render UI Lobby
function renderLobby() {
  if (!currentRoom) return;

  displayRoomCode.textContent = currentRoom.code;
  playerCount.textContent = currentRoom.players.length;

  playersList.innerHTML = '';
  currentRoom.players.forEach(p => {
    const isMe = p.id === myPlayerId;
    const card = document.createElement('div');
    card.className = `player-card ${isMe ? 'is-me' : ''}`;

    const initial = p.name.charAt(0).toUpperCase();

    let statusBadge = '';
    if (p.isHost) {
      statusBadge = '<span class="badge badge-host">👑 HOST</span>';
    } else if (p.isReady) {
      statusBadge = '<span class="badge badge-ready">✓ SIAP</span>';
    } else {
      statusBadge = '<span class="badge badge-waiting">⏳ MENUNGGU</span>';
    }

    card.innerHTML = `
      <div class="player-avatar" style="background-color: ${p.color};">${initial}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)} ${isMe ? '<small>(Kamu)</small>' : ''}</div>
        <div class="player-badges">
          ${statusBadge}
        </div>
      </div>
    `;
    playersList.appendChild(card);
  });

  // Kontrol tombol aksi (Host vs Guest)
  if (amIHost) {
    btnStartGame.style.display = 'inline-flex';
    btnToggleReady.style.display = 'none';
  } else {
    btnStartGame.style.display = 'none';
    btnToggleReady.style.display = 'inline-flex';

    const mySelf = currentRoom.players.find(p => p.id === myPlayerId);
    if (mySelf && mySelf.isReady) {
      btnToggleReady.textContent = '✓ Kamu Sudah Siap!';
      btnToggleReady.className = 'btn btn-warning ready-active';
    } else {
      btnToggleReady.textContent = '⏳ Klik Siap (Ready)';
      btnToggleReady.className = 'btn btn-warning';
    }
  }
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ==================== MINI-GAME ARENA & CANVAS ENGINE ====================

const keysDown = {};
window.addEventListener('keydown', (e) => {
  keysDown[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keysDown[e.key.toLowerCase()] = false;
});

let gameAnimationId = null;
let lastMoveEmit = 0;

function startGameLoop() {
  if (gameAnimationId) cancelAnimationFrame(gameAnimationId);

  function loop() {
    updateLocalPlayer();
    renderGame();
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

function updateLocalPlayer() {
  if (!currentRoom || currentRoom.state !== 'playing') return;
  const myPlayer = currentRoom.players.find(p => p.id === myPlayerId);
  if (!myPlayer) return;

  const speed = 4.5;
  let dx = 0;
  let dy = 0;

  if (keysDown['w'] || keysDown['arrowup']) dy -= speed;
  if (keysDown['s'] || keysDown['arrowdown']) dy += speed;
  if (keysDown['a'] || keysDown['arrowleft']) dx -= speed;
  if (keysDown['d'] || keysDown['arrowright']) dx += speed;

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  if (dx !== 0 || dy !== 0) {
    myPlayer.x = Math.max(20, Math.min(canvas.width - 20, myPlayer.x + dx));
    myPlayer.y = Math.max(20, Math.min(canvas.height - 20, myPlayer.y + dy));

    const now = performance.now();
    if (now - lastMoveEmit > 30) {
      socket.emit('player_move', { x: myPlayer.x, y: myPlayer.y });
      lastMoveEmit = now;
    }
  }
}

let coinPulseTime = 0;

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Grid halus
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (!currentRoom) return;

  // Render Koin Emas
  coinPulseTime += 0.05;
  const coinRadius = 10 + Math.sin(coinPulseTime) * 1.5;

  (currentRoom.coins || []).forEach(coin => {
    // Glow koin
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coinRadius + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.fill();

    // Body koin
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coinRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Simbol $ di tengah koin
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 1);
  });

  // Render Pemain
  (currentRoom.players || []).forEach(p => {
    const isMe = p.id === myPlayerId;

    // Lingkaran aura pemain aktif
    if (isMe) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fill();
    }

    // Avatar karakter
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = isMe ? 3 : 2;
    ctx.stroke();

    // Mata karakter (ekspresi wajah sederhana)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x - 5, p.y - 2, 3, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(p.x - 5, p.y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Nama & Skor di atas karakter
    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${p.name} (${p.score})`, p.x, p.y - 22);

    if (p.isHost) {
      ctx.font = '10px sans-serif';
      ctx.fillText('👑', p.x, p.y - 34);
    }
  });
}
