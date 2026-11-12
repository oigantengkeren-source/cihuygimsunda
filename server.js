const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Sajikan file static dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint untuk info jaringan (membantu menampilkan IP ke pemain di UI)
app.get('/api/info', (req, res) => {
  res.json({
    localIp: getLocalIp(),
    port: PORT
  });
});

// Simpan data semua room di memory
const rooms = new Map();

// Helper untuk generate kode room acak (5 karakter mudah dibaca)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Hindari I, O, 1, 0
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// Pilihan warna cerah untuk avatar/karakter pemain
const PLAYER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
];

function getRandomColor(usedColors = []) {
  const available = PLAYER_COLORS.filter(c => !usedColors.includes(c));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

// Generate koin/item untuk prototype mini-game
function spawnCoins(count = 12, arenaWidth = 700, arenaHeight = 450) {
  const coins = [];
  for (let i = 0; i < count; i++) {
    coins.push({
      id: 'coin_' + Math.random().toString(36).substr(2, 9),
      x: Math.floor(40 + Math.random() * (arenaWidth - 80)),
      y: Math.floor(40 + Math.random() * (arenaHeight - 80)),
      value: 10
    });
  }
  return coins;
}

io.on('connection', (socket) => {
  let currentRoomCode = null;

  // 1. HOST MEMBUAT ROOM BARU
  socket.on('create_room', ({ playerName }) => {
    const trimmedName = (playerName || 'Player').trim().slice(0, 16);
    const roomCode = generateRoomCode();

    const hostPlayer = {
      id: socket.id,
      name: trimmedName,
      isHost: true,
      isReady: true, // Host otomatis ready
      color: PLAYER_COLORS[0],
      score: 0,
      x: 100,
      y: 100
    };

    const roomData = {
      code: roomCode,
      hostId: socket.id,
      state: 'lobby', // 'lobby' | 'playing' | 'ended'
      maxPlayers: 8,
      createdAt: Date.now(),
      players: [hostPlayer],
      coins: [],
      gameTimer: 45 // 45 detik durasi game ronde
    };

    rooms.set(roomCode, roomData);
    socket.join(roomCode);
    currentRoomCode = roomCode;

    socket.emit('room_created', {
      success: true,
      roomCode,
      room: roomData,
      playerId: socket.id
    });
  });

  // 2. PEMAIN GABUNG ROOM MENGGUNAKAN KODE
  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const trimmedName = (playerName || 'Player').trim().slice(0, 16);

    if (!code || !rooms.has(code)) {
      return socket.emit('join_error', { message: 'Kode Room tidak ditemukan!' });
    }

    const room = rooms.get(code);

    if (room.players.length >= room.maxPlayers) {
      return socket.emit('join_error', { message: 'Room sudah penuh (maksimal 8 pemain)!' });
    }

    if (room.state !== 'lobby') {
      return socket.emit('join_error', { message: 'Game di room ini sudah berlangsung!' });
    }

    const usedColors = room.players.map(p => p.color);
    const newPlayer = {
      id: socket.id,
      name: trimmedName,
      isHost: false,
      isReady: false,
      color: getRandomColor(usedColors),
      score: 0,
      x: 120 + room.players.length * 50,
      y: 120 + room.players.length * 30
    };

    room.players.push(newPlayer);
    socket.join(code);
    currentRoomCode = code;

    socket.emit('joined_room', {
      success: true,
      roomCode: code,
      room,
      playerId: socket.id
    });

    // Beritahu semua pemain di room tentang update anggota
    io.to(code).emit('room_updated', room);
    io.to(code).emit('chat_message', {
      system: true,
      text: `${newPlayer.name} telah bergabung ke room!`
    });
  });

  // 3. TOGGLE STATUS READY (UNTUK GUEST)
  socket.on('toggle_ready', () => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);
    const player = room.players.find(p => p.id === socket.id);

    if (player && !player.isHost) {
      player.isReady = !player.isReady;
      io.to(currentRoomCode).emit('room_updated', room);
    }
  });

  // 4. HOST MEMULAI GAME
  socket.on('start_game', () => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);

    if (room.hostId !== socket.id) {
      return socket.emit('error_message', 'Hanya host yang bisa memulai game!');
    }

    // Pastikan semua guest sudah ready
    const notReady = room.players.some(p => !p.isReady);
    if (notReady) {
      return socket.emit('error_message', 'Semua pemain harus klik "Ready" terlebih dahulu!');
    }

    room.state = 'playing';
    room.coins = spawnCoins(14);
    room.gameTimer = 45;

    // Reset posisi dan skor pemain
    room.players.forEach((p, idx) => {
      p.score = 0;
      p.x = 80 + (idx % 4) * 150;
      p.y = 80 + Math.floor(idx / 4) * 180;
    });

    io.to(currentRoomCode).emit('game_started', room);

    // Jalankan timer ronde permainan
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.gameTimer--;
      io.to(currentRoomCode).emit('timer_tick', { timeLeft: room.gameTimer });

      if (room.gameTimer <= 0) {
        clearInterval(room.timerInterval);
        room.state = 'ended';

        // Tentukan pemenang dengan skor tertinggi
        const sorted = [...room.players].sort((a, b) => b.score - a.score);
        const winner = sorted[0];

        io.to(currentRoomCode).emit('game_ended', {
          winner,
          leaderboard: sorted
        });
      }
    }, 1000);
  });

  // 5. PERGERAKAN / AKSI KARAKTER PEMAIN SAAT IN-GAME
  socket.on('player_move', ({ x, y }) => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);
    if (room.state !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.x = Math.max(15, Math.min(685, x));
    player.y = Math.max(15, Math.min(435, y));

    // Cek tabrakan / ambil koin
    const playerRadius = 16;
    const coinRadius = 12;
    const pickupDist = playerRadius + coinRadius;

    for (let i = room.coins.length - 1; i >= 0; i--) {
      const coin = room.coins[i];
      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < pickupDist) {
        player.score += coin.value;
        room.coins.splice(i, 1);

        // Broadcast koin diambil
        io.to(currentRoomCode).emit('coin_collected', {
          coinId: coin.id,
          playerId: player.id,
          newScore: player.score
        });

        // Spawn koin pengganti jika koin mulai menipis
        if (room.coins.length < 5) {
          const newCoin = {
            id: 'coin_' + Math.random().toString(36).substr(2, 9),
            x: Math.floor(40 + Math.random() * (700 - 80)),
            y: Math.floor(40 + Math.random() * (450 - 80)),
            value: 10
          };
          room.coins.push(newCoin);
          io.to(currentRoomCode).emit('new_coin_spawned', newCoin);
        }
        break;
      }
    }

    // Broadcast posisi pemain ke semua client di room
    socket.to(currentRoomCode).emit('player_moved', {
      id: player.id,
      x: player.x,
      y: player.y
    });
  });

  // 6. CHAT DI ROOM
  socket.on('send_chat', ({ text }) => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const trimmed = (text || '').trim().slice(0, 120);
    if (!trimmed) return;

    io.to(currentRoomCode).emit('chat_message', {
      senderName: player.name,
      senderColor: player.color,
      isHost: player.isHost,
      text: trimmed,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    });
  });

  // 7. KEMBALI KE LOBBY SETELAH GAME SELESAI
  socket.on('return_to_lobby', () => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);
    if (room.hostId !== socket.id) return;

    if (room.timerInterval) clearInterval(room.timerInterval);
    room.state = 'lobby';
    room.players.forEach(p => {
      p.isReady = p.isHost;
      p.score = 0;
    });

    io.to(currentRoomCode).emit('returned_to_lobby', room);
  });

  // 8. TINGGALKAN ROOM / KELUAR
  socket.on('leave_room', () => {
    handlePlayerExit(socket);
  });

  // 9. DISCONNECT (TUTUP TAB / KONEKSI TERPUTUS)
  socket.on('disconnect', () => {
    handlePlayerExit(socket);
  });

  function handlePlayerExit(sock) {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
    const room = rooms.get(currentRoomCode);
    const playerIdx = room.players.findIndex(p => p.id === sock.id);

    if (playerIdx !== -1) {
      const leavingPlayer = room.players[playerIdx];
      room.players.splice(playerIdx, 1);

      sock.leave(currentRoomCode);

      if (room.players.length === 0) {
        // Room kosong, bersihkan dari memory
        if (room.timerInterval) clearInterval(room.timerInterval);
        rooms.delete(currentRoomCode);
      } else {
        // Jika host yang keluar, oper hak host ke pemain pertama berikutnya
        if (leavingPlayer.isHost) {
          room.players[0].isHost = true;
          room.players[0].isReady = true;
          room.hostId = room.players[0].id;
          io.to(currentRoomCode).emit('chat_message', {
            system: true,
            text: `Host keluar! ${room.players[0].name} sekarang menjadi Host baru.`
          });
        }

        io.to(currentRoomCode).emit('chat_message', {
          system: true,
          text: `${leavingPlayer.name} telah meninggalkan room.`
        });
        io.to(currentRoomCode).emit('room_updated', room);
      }
    }

    currentRoomCode = null;
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n==================================================`);
  console.log(`🚀 Server Multiplayer Berjalan!`);
  console.log(`- Di Komputer ini : http://localhost:${PORT}`);
  console.log(`- Di HP / Device Lain (1 WiFi): http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});
