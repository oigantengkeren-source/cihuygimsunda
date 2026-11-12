/**
 * ============================================================================
 * 🎮 CIHUY ROOM SYSTEM MODULE (room-system.js)
 * ============================================================================
 * Modul mandiri (Standalone Library) untuk sistem Room Multiplayer (Host & Join
 * menggunakan Kode Unik) pada game berbasis Web.
 *
 * Keunggulan:
 * - Siap diintegrasikan ke Frontend/UI apa pun (HTML/JS biasa, React, Vue, Canvas, Phaser).
 * - Berjalan secara Real-Time antar-device (HP, Laptop, Beda Jaringan) menggunakan
 *   protokol WebRTC (PeerJS) tanpa perlu menjalankan server localhost sendiri.
 * - Otomatis memuat library PeerJS jika belum dipasang di HTML.
 *
 * Cara Pakai Singkat untuk Tim Frontend/UI:
 * ----------------------------------------------------------------------------
 * const roomSystem = new CihuyRoomSystem({
 *   maxPlayers: 8,
 *   onRoomUpdated: (room) => { console.log("Data room:", room); },
 *   onGameStarted: (room) => { console.log("Game mulai!", room); },
 *   onGameData: (senderId, data) => { console.log("Data dari pemain lain:", data); },
 *   onError: (pesan) => { alert(pesan); }
 * });
 *
 * // Untuk membuat room (Host):
 * const kode = await roomSystem.createRoom("NamaHost");
 *
 * // Untuk masuk ke room teman (Join):
 * await roomSystem.joinRoom("KODE5", "NamaTeman");
 * ============================================================================
 */

(function (global) {
  const PEER_PREFIX = 'cihuygimsunda-v1-room-';
  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Tanpa I, O, 1, 0 agar tidak membingungkan

  const DEFAULT_COLORS = [
    '#3B82F6', // Biru
    '#EF4444', // Merah
    '#10B981', // Hijau
    '#F59E0B', // Kuning Amber
    '#8B5CF6', // Ungu
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16'  // Lime
  ];

  // Helper: Pastikan PeerJS sudah dimuat di halaman
  function ensurePeerJSLoaded() {
    return new Promise((resolve, reject) => {
      if (typeof global.Peer !== 'undefined') {
        return resolve(global.Peer);
      }
      const existingScript = document.querySelector('script[data-cihuy-peerjs]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(global.Peer));
        existingScript.addEventListener('error', () => reject(new Error('Gagal memuat library jaringan PeerJS.')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      script.async = true;
      script.setAttribute('data-cihuy-peerjs', 'true');
      script.onload = () => resolve(global.Peer);
      script.onerror = () => reject(new Error('Gagal memuat library jaringan PeerJS. Periksa koneksi internet.'));
      document.head.appendChild(script);
    });
  }

  class CihuyRoomSystem {
    /**
     * @param {Object} config Konfigurasi & Callback Event
     */
    constructor(config = {}) {
      this.maxPlayers = config.maxPlayers || 8;
      this.codeLength = config.codeLength || 5;

      // Callback Events untuk UI
      this.onRoomCreated = config.onRoomCreated || (() => {});
      this.onRoomJoined = config.onRoomJoined || (() => {});
      this.onRoomUpdated = config.onRoomUpdated || (() => {});
      this.onPlayerJoined = config.onPlayerJoined || (() => {});
      this.onPlayerLeft = config.onPlayerLeft || (() => {});
      this.onGameStarted = config.onGameStarted || (() => {});
      this.onGameEnded = config.onGameEnded || (() => {});
      this.onReturnedToLobby = config.onReturnedToLobby || (() => {});
      this.onGameData = config.onGameData || (() => {});
      this.onChatMessage = config.onChatMessage || (() => {});
      this.onKicked = config.onKicked || (() => {});
      this.onError = config.onError || ((msg) => console.error('[CihuyRoomSystem Error]:', msg));
      this.onLog = config.onLog || (() => {});

      // State Internal
      this.peer = null;
      this.myPlayerId = null;
      this.isHost = false;
      this.room = null;

      // Daftar koneksi aktif (Khusus Host: Map<playerId, DataConnection>)
      this.guestConnections = new Map();
      // Koneksi ke Host (Khusus Guest: DataConnection)
      this.hostConnection = null;
    }

    /**
     * Generate kode room acak 5 karakter (contoh: "K9X2B")
     */
    generateRoomCode() {
      let code = '';
      for (let i = 0; i < this.codeLength; i++) {
        code += ROOM_CHARS.charAt(Math.floor(Math.random() * ROOM_CHARS.length));
      }
      return code;
    }

    /**
     * Pilih warna unik untuk pemain baru
     */
    _pickColor(usedColors = []) {
      const available = DEFAULT_COLORS.filter((c) => !usedColors.includes(c));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
      return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    }

    _log(event, detail) {
      this.onLog({
        time: new Date().toLocaleTimeString('id-ID'),
        event,
        detail
      });
    }

    /**
     * ========================================================================
     * 1. MEMBUAT ROOM BARU (SEBAGAI HOST)
     * ========================================================================
     * @param {string} playerName Nama pemain Host
     * @param {string} [customCode] Opsional: kode kustom jika ingin ditentukan sendiri
     * @returns {Promise<Object>} Data room yang berhasil dibuat
     */
    async createRoom(playerName, customCode = null) {
      await ensurePeerJSLoaded();
      this.leaveRoom();

      const cleanName = (playerName || 'Host').trim().slice(0, 16) || 'Host';
      const roomCode = (customCode || this.generateRoomCode()).toUpperCase();
      const peerId = PEER_PREFIX + roomCode;

      return new Promise((resolve, reject) => {
        const peer = new global.Peer(peerId, {
          debug: 1
        });

        peer.on('open', (id) => {
          this.peer = peer;
          this.myPlayerId = 'host_' + Math.random().toString(36).substring(2, 8);
          this.isHost = true;

          const hostPlayer = {
            id: this.myPlayerId,
            name: cleanName,
            isHost: true,
            isReady: true,
            color: DEFAULT_COLORS[0],
            score: 0,
            customData: {}
          };

          this.room = {
            code: roomCode,
            hostId: this.myPlayerId,
            state: 'lobby', // 'lobby' | 'playing' | 'ended'
            maxPlayers: this.maxPlayers,
            createdAt: Date.now(),
            players: [hostPlayer]
          };

          this._setupHostListeners();
          this._log('CREATE_ROOM', `Room ${roomCode} dibuat oleh ${cleanName}`);

          this.onRoomCreated(this.room);
          this.onRoomUpdated(this.room);
          resolve(this.room);
        });

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            // Jika kebetulan kode sudah dipakai, generate ulang otomatis
            peer.destroy();
            if (!customCode) {
              return this.createRoom(playerName).then(resolve).catch(reject);
            }
            const msg = `Kode Room "${roomCode}" sedang digunakan. Silakan coba kode lain.`;
            this.onError(msg);
            return reject(new Error(msg));
          }
          const msg = `Gagal membuat room: ${err.message || err.type}`;
          this.onError(msg);
          reject(err);
        });
      });
    }

    /**
     * Setup listener untuk Host agar bisa menerima koneksi dari teman yang Join
     */
    _setupHostListeners() {
      if (!this.peer) return;

      this.peer.on('connection', (conn) => {
        conn.on('open', () => {
          // Tunggu pesan JOIN_REQUEST dari guest
        });

        conn.on('data', (packet) => {
          this._handleHostReceiveData(conn, packet);
        });

        conn.on('close', () => {
          this._handleGuestDisconnect(conn.peer);
        });

        conn.on('error', () => {
          this._handleGuestDisconnect(conn.peer);
        });
      });
    }

    /**
     * Host memproses paket data yang masuk dari Guest
     */
    _handleHostReceiveData(conn, packet) {
      if (!packet || !packet.type || !this.room) return;

      switch (packet.type) {
        case 'JOIN_REQUEST': {
          const guestName = (packet.playerName || 'Pemain').trim().slice(0, 16) || 'Pemain';
          const guestId = conn.peer;

          if (this.room.players.length >= this.room.maxPlayers) {
            conn.send({ type: 'JOIN_REJECTED', reason: 'Room sudah penuh!' });
            setTimeout(() => conn.close(), 500);
            return;
          }

          if (this.room.state !== 'lobby') {
            conn.send({ type: 'JOIN_REJECTED', reason: 'Permainan di room ini sudah dimulai!' });
            setTimeout(() => conn.close(), 500);
            return;
          }

          const usedColors = this.room.players.map((p) => p.color);
          const newPlayer = {
            id: guestId,
            name: guestName,
            isHost: false,
            isReady: false,
            color: this._pickColor(usedColors),
            score: 0,
            customData: packet.customData || {}
          };

          this.room.players.push(newPlayer);
          this.guestConnections.set(guestId, conn);

          // Kirim konfirmasi ke guest yang baru masuk
          conn.send({
            type: 'JOIN_ACCEPTED',
            playerId: guestId,
            room: this.room
          });

          // Broadcast ke semua pemain di room
          this._broadcastRoomState();
          this._broadcastSystemChat(`${newPlayer.name} bergabung ke dalam room!`);
          this._log('PLAYER_JOINED', `${newPlayer.name} (${guestId}) masuk ke room`);

          this.onPlayerJoined(newPlayer);
          this.onRoomUpdated(this.room);
          break;
        }

        case 'TOGGLE_READY': {
          const player = this.room.players.find((p) => p.id === conn.peer);
          if (player && !player.isHost) {
            player.isReady = typeof packet.isReady === 'boolean' ? packet.isReady : !player.isReady;
            this._broadcastRoomState();
            this._log('PLAYER_READY', `${player.name} status ready: ${player.isReady}`);
            this.onRoomUpdated(this.room);
          }
          break;
        }

        case 'UPDATE_PLAYER_DATA': {
          const player = this.room.players.find((p) => p.id === conn.peer);
          if (player) {
            if (typeof packet.score === 'number') player.score = packet.score;
            if (packet.customData) {
              player.customData = { ...player.customData, ...packet.customData };
            }
            this._broadcastRoomState();
            this.onRoomUpdated(this.room);
          }
          break;
        }

        case 'GAME_DATA': {
          // Teruskan data in-game dari satu guest ke semua guest lain & ke Host
          this._broadcastToGuests(
            {
              type: 'GAME_DATA',
              senderId: conn.peer,
              payload: packet.payload
            },
            conn.peer // Jangan kirim balik ke pengirim asal
          );
          this.onGameData(conn.peer, packet.payload);
          break;
        }

        case 'CHAT_MESSAGE': {
          const sender = this.room.players.find((p) => p.id === conn.peer);
          if (!sender) return;
          const chatObj = {
            system: false,
            senderId: sender.id,
            senderName: sender.name,
            senderColor: sender.color,
            isHost: sender.isHost,
            text: String(packet.text || '').trim().slice(0, 150),
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          };
          if (!chatObj.text) return;
          this._broadcastToGuests({ type: 'CHAT_MESSAGE', chat: chatObj });
          this.onChatMessage(chatObj);
          break;
        }

        case 'LEAVE_ROOM': {
          this._handleGuestDisconnect(conn.peer);
          break;
        }
      }
    }

    /**
     * Ketika Guest terputus atau keluar dari room
     */
    _handleGuestDisconnect(guestId) {
      if (!this.isHost || !this.room) return;
      const idx = this.room.players.findIndex((p) => p.id === guestId);
      if (idx !== -1) {
        const removedPlayer = this.room.players[idx];
        this.room.players.splice(idx, 1);
        this.guestConnections.delete(guestId);

        this._broadcastRoomState();
        this._broadcastSystemChat(`${removedPlayer.name} telah keluar dari room.`);
        this._log('PLAYER_LEFT', `${removedPlayer.name} keluar dari room`);

        this.onPlayerLeft(removedPlayer);
        this.onRoomUpdated(this.room);
      }
    }

    /**
     * ========================================================================
     * 2. GABUNG KE ROOM TEMAN DENGAN KODE (SEBAGAI GUEST)
     * ========================================================================
     * @param {string} roomCode Kode Room 5 karakter dari Host
     * @param {string} playerName Nama pemain
     * @param {Object} [customData] Data tambahan opsional (misal avatar/karakter)
     * @returns {Promise<Object>} Data room yang dimasuki
     */
    async joinRoom(roomCode, playerName, customData = {}) {
      await ensurePeerJSLoaded();
      this.leaveRoom();

      const cleanCode = (roomCode || '').trim().toUpperCase();
      const cleanName = (playerName || 'Pemain').trim().slice(0, 16) || 'Pemain';

      if (!cleanCode || cleanCode.length < 3) {
        const msg = 'Kode Room tidak valid!';
        this.onError(msg);
        throw new Error(msg);
      }

      const targetPeerId = PEER_PREFIX + cleanCode;

      return new Promise((resolve, reject) => {
        const peer = new global.Peer({ debug: 1 });
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.leaveRoom();
            const msg = `Room dengan kode "${cleanCode}" tidak ditemukan atau Host sedang offline.`;
            this.onError(msg);
            reject(new Error(msg));
          }
        }, 8000);

        peer.on('open', (myId) => {
          this.peer = peer;
          this.myPlayerId = myId;
          this.isHost = false;

          const conn = peer.connect(targetPeerId, { reliable: true });
          this.hostConnection = conn;

          conn.on('open', () => {
            this._log('CONNECTING_HOST', `Terhubung ke sinyal room ${cleanCode}, mengirim request join...`);
            conn.send({
              type: 'JOIN_REQUEST',
              playerName: cleanName,
              customData
            });
          });

          conn.on('data', (packet) => {
            if (!packet || !packet.type) return;

            if (packet.type === 'JOIN_ACCEPTED') {
              clearTimeout(timeout);
              isResolved = true;
              this.myPlayerId = packet.playerId;
              this.room = packet.room;
              this._log('JOIN_SUCCESS', `Berhasil masuk ke room ${cleanCode}`);
              this.onRoomJoined(this.room);
              this.onRoomUpdated(this.room);
              resolve(this.room);
            } else if (packet.type === 'JOIN_REJECTED') {
              clearTimeout(timeout);
              isResolved = true;
              this.leaveRoom();
              this.onError(packet.reason || 'Gagal bergabung ke room.');
              reject(new Error(packet.reason));
            } else {
              this._handleGuestReceiveData(packet);
            }
          });

          conn.on('close', () => {
            if (this.room) {
              this.onError('Koneksi ke Host terputus (Host menutup room).');
              this.leaveRoom();
            }
          });
        });

        peer.on('error', (err) => {
          clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            this.leaveRoom();
            const msg =
              err.type === 'peer-unavailable'
                ? `Kode Room "${cleanCode}" tidak ditemukan! Pastikan kode benar dan Host sudah membuat room.`
                : `Koneksi gagal: ${err.message || err.type}`;
            this.onError(msg);
            reject(new Error(msg));
          }
        });
      });
    }

    /**
     * Guest memproses paket data yang dikirim oleh Host
     */
    _handleGuestReceiveData(packet) {
      switch (packet.type) {
        case 'ROOM_STATE_UPDATE': {
          this.room = packet.room;
          this.onRoomUpdated(this.room);
          break;
        }
        case 'GAME_STARTED': {
          this.room = packet.room;
          this._log('GAME_STARTED', 'Permainan dimulai oleh Host!');
          this.onRoomUpdated(this.room);
          this.onGameStarted(this.room, packet.initialData);
          break;
        }
        case 'GAME_ENDED': {
          this.room = packet.room;
          this._log('GAME_ENDED', 'Permainan selesai!');
          this.onRoomUpdated(this.room);
          this.onGameEnded(packet.result);
          break;
        }
        case 'RETURNED_TO_LOBBY': {
          this.room = packet.room;
          this._log('RETURN_LOBBY', 'Room kembali ke Lobby');
          this.onRoomUpdated(this.room);
          this.onReturnedToLobby(this.room);
          break;
        }
        case 'GAME_DATA': {
          this.onGameData(packet.senderId, packet.payload);
          break;
        }
        case 'CHAT_MESSAGE': {
          this.onChatMessage(packet.chat);
          break;
        }
        case 'KICKED': {
          this.onKicked(packet.reason || 'Kamu dikeluarkan dari room oleh Host.');
          this.leaveRoom();
          break;
        }
      }
    }

    /**
     * ========================================================================
     * 3. AKSI-AKSI DI DALAM LOBBY & GAME
     * ========================================================================
     */

    /**
     * Mengubah status Ready / Belum Ready (Untuk Guest)
     */
    toggleReady(forceState) {
      if (!this.room || this.isHost) return;
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          type: 'TOGGLE_READY',
          isReady: forceState
        });
      }
    }

    /**
     * Memulai permainan (Khusus Host)
     * @param {Object} [initialData] Data awal game (misal map, soal, atau posisi objek)
     * @param {boolean} [requireAllReady=true] Wajibkan semua pemain Ready sebelum mulai
     */
    startGame(initialData = {}, requireAllReady = true) {
      if (!this.isHost || !this.room) {
        this.onError('Hanya Host yang dapat memulai permainan!');
        return false;
      }

      if (requireAllReady) {
        const unreadyPlayers = this.room.players.filter((p) => !p.isHost && !p.isReady);
        if (unreadyPlayers.length > 0) {
          this.onError('Semua pemain harus menekan tombol "Siap (Ready)" terlebih dahulu!');
          return false;
        }
      }

      this.room.state = 'playing';
      this.room.players.forEach((p) => {
        p.score = 0;
      });

      this._broadcastToGuests({
        type: 'GAME_STARTED',
        room: this.room,
        initialData
      });

      this._log('START_GAME', 'Host memulai permainan');
      this.onRoomUpdated(this.room);
      this.onGameStarted(this.room, initialData);
      return true;
    }

    /**
     * Mengirim data pergerakan / aksi / event game ke seluruh pemain di room secara real-time
     * @param {Object} payload Data bebas sesuai kebutuhan game (misal: { action: 'MOVE', x: 100, y: 200 })
     */
    sendGameData(payload) {
      if (!this.room) return;

      if (this.isHost) {
        this._broadcastToGuests({
          type: 'GAME_DATA',
          senderId: this.myPlayerId,
          payload
        });
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          type: 'GAME_DATA',
          payload
        });
      }
    }

    /**
     * Update skor atau customData milik pemain sendiri
     */
    updateMyData({ score, customData } = {}) {
      if (!this.room) return;
      const me = this.getMyPlayer();
      if (!me) return;

      if (this.isHost) {
        if (typeof score === 'number') me.score = score;
        if (customData) me.customData = { ...me.customData, ...customData };
        this._broadcastRoomState();
        this.onRoomUpdated(this.room);
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          type: 'UPDATE_PLAYER_DATA',
          score,
          customData
        });
      }
    }

    /**
     * Mengakhiri permainan & mengirim hasil akhir / leaderboard (Khusus Host)
     */
    endGame(customResult = {}) {
      if (!this.isHost || !this.room) return;
      this.room.state = 'ended';

      const leaderboard = [...this.room.players].sort((a, b) => (b.score || 0) - (a.score || 0));
      const result = {
        winner: leaderboard[0] || null,
        leaderboard,
        ...customResult
      };

      this._broadcastToGuests({
        type: 'GAME_ENDED',
        room: this.room,
        result
      });

      this.onRoomUpdated(this.room);
      this.onGameEnded(result);
    }

    /**
     * Mengembalikan seluruh pemain ke Lobby untuk main lagi (Khusus Host)
     */
    returnToLobby() {
      if (!this.isHost || !this.room) return;
      this.room.state = 'lobby';
      this.room.players.forEach((p) => {
        p.isReady = p.isHost;
        p.score = 0;
      });

      this._broadcastToGuests({
        type: 'RETURNED_TO_LOBBY',
        room: this.room
      });

      this.onRoomUpdated(this.room);
      this.onReturnedToLobby(this.room);
    }

    /**
     * Mengirim pesan chat ke dalam room
     */
    sendChat(text) {
      if (!this.room) return;
      const trimmed = String(text || '').trim().slice(0, 150);
      if (!trimmed) return;

      const me = this.getMyPlayer();
      if (!me) return;

      if (this.isHost) {
        const chatObj = {
          system: false,
          senderId: me.id,
          senderName: me.name,
          senderColor: me.color,
          isHost: true,
          text: trimmed,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        this._broadcastToGuests({ type: 'CHAT_MESSAGE', chat: chatObj });
        this.onChatMessage(chatObj);
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          type: 'CHAT_MESSAGE',
          text: trimmed
        });
      }
    }

    /**
     * Mengeluarkan pemain tertentu dari room (Khusus Host)
     */
    kickPlayer(targetPlayerId, reason = 'Dikeluarkan oleh Host.') {
      if (!this.isHost || !this.room || targetPlayerId === this.myPlayerId) return;
      const conn = this.guestConnections.get(targetPlayerId);
      if (conn) {
        conn.send({ type: 'KICKED', reason });
        setTimeout(() => conn.close(), 300);
      }
      this._handleGuestDisconnect(targetPlayerId);
    }

    /**
     * Keluar dari room & putuskan semua koneksi
     */
    leaveRoom() {
      if (!this.isHost && this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send({ type: 'LEAVE_ROOM' });
          this.hostConnection.close();
        } catch (e) {}
      }

      if (this.isHost) {
        this.guestConnections.forEach((conn) => {
          try {
            conn.close();
          } catch (e) {}
        });
        this.guestConnections.clear();
      }

      if (this.peer) {
        try {
          this.peer.destroy();
        } catch (e) {}
      }

      this.peer = null;
      this.hostConnection = null;
      this.room = null;
      this.myPlayerId = null;
      this.isHost = false;
    }

    /**
     * Helper: Ambil objek data diri sendiri di dalam room
     */
    getMyPlayer() {
      if (!this.room || !this.myPlayerId) return null;
      return this.room.players.find((p) => p.id === this.myPlayerId) || null;
    }

    /**
     * Helper: Dapatkan URL undangan otomatis dengan parameter ?room=KODE
     */
    getInviteLink() {
      if (!this.room) return '';
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?room=${this.room.code}`;
    }

    // Internal broadcast helpers (Host)
    _broadcastRoomState() {
      this._broadcastToGuests({
        type: 'ROOM_STATE_UPDATE',
        room: this.room
      });
    }

    _broadcastSystemChat(text) {
      const chatObj = {
        system: true,
        text,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      this._broadcastToGuests({ type: 'CHAT_MESSAGE', chat: chatObj });
      this.onChatMessage(chatObj);
    }

    _broadcastToGuests(packet, excludePeerId = null) {
      this.guestConnections.forEach((conn, peerId) => {
        if (peerId !== excludePeerId && conn.open) {
          conn.send(packet);
        }
      });
    }
  }

  // Ekspos ke global window dan mendukung ES Module / CommonJS
  global.CihuyRoomSystem = CihuyRoomSystem;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CihuyRoomSystem };
  }
})(typeof window !== 'undefined' ? window : globalThis);
