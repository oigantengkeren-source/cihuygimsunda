# 🎮 Cihuy Gim Sunda - Multiplayer Room Lobby System

Sistem lobi multiplayer berbasis web dengan mekanisme **Host & Join menggunakan Kode Room**, dilengkapi dengan *real-time state synchronization* (Socket.io) dan prototype mini-game arena interaktif.

---

## ✨ Fitur Utama

1. **Host Room System**:
   - Pemain dapat membuat room baru dengan 1 klik.
   - Server mengenerate **Kode Room 5 Karakter Unik** (misal: `K8X2W`, bebas dari karakter ambigu seperti `O/0` dan `I/1`).
   - Tombol **Salin Kode** dan **Salin Link Undangan Langsung** (`?room=KODE`) agar teman bisa bergabung tanpa mengetik manual.

2. **Join Room System**:
   - Teman memasukkan kode room di menu utama untuk bergabung ke room yang sama dengan host.
   - Pengecekan otomatis: ketersediaan room, batas maksimal pemain (8 pemain), dan status permainan.

3. **Lobby & Waiting Room**:
   - Daftar pemain real-time dengan avatar warna unik & badge peran (`👑 HOST`, `✓ SIAP`, `⏳ MENUNGGU`).
   - Tombol **Ready / Siap** untuk pemain tamu (guest).
   - Tombol **Mulai Permainan** khusus untuk Host (hanya aktif jika semua pemain sudah siap).
   - Fitur **Chat Room** terintegrasi secara real-time.
   - Penanganan otomatis jika host keluar: hak host dialihkan ke pemain berikutnya.

4. **Prototype Arena Mini-Game**:
   - Sinkronisasi pergerakan karakter real-time antar tab/browser (WASD / Tombol Panah).
   - Koin emas yang dapat dikumpulkan bersama secara kompetitif.
   - Timer countdown & papan skor leaderboard langsung.
   - Efek suara 8-bit retro sintetis (*Web Audio API* tanpa aset file berat).
   - Tombol kembali ke lobby setelah ronde selesai.

---

## 🚀 Cara Menjalankan Proyek

### 1. Buka Terminal di Folder Proyek
```bash
cd C:\Users\oi\.gemini\antigravity\scratch\cihuygimsunda
```

### 2. Jalankan Server
```bash
npm start
```
*(Atau gunakan `npm run dev` untuk mode auto-reload).*

### 3. Uji Coba Multiplayer di Browser
1. Buka browser dan akses **`http://localhost:3000`**.
2. Masukkan nama pemain (misal: `HostPlayer`), lalu klik **"Buat Room Baru"**.
3. Buka jendela browser baru / tab *Incognito* / browser lain, lalu akses **`http://localhost:3000`**.
4. Masukkan nama pemain kedua (misal: `TemanKu`), masukkan kode room dari host, lalu klik **"Gabung"**.
5. Di layar tamu, klik tombol **"Klik Siap (Ready)"**.
6. Di layar host, klik **"Mulai Permainan"**!

---

## 📁 Struktur File

```text
cihuygimsunda/
├── package.json        # Konfigurasi dependensi (Express, Socket.io)
├── server.js          # Server Socket.io & logika manajemen room
├── public/
│   ├── index.html     # Struktur UI (Menu, Lobby, Arena Game, Modal)
│   ├── style.css      # Desain modern dark gaming & glassmorphism
│   └── game.js        # Client Socket.io, event listener, dan canvas loop
├── .gitignore         # Mengabaikan node_modules
└── README.md          # Dokumentasi proyek
```

---

## 🌐 Deploy Online (Bisa Dimainkan Jarak Jauh)
Proyek ini siap dideploy ke platform gratis seperti:
- **Render.com** (Pilih Web Service, build command `npm install`, start command `npm start`)
- **Railway.app** (Hubungkan repo GitHub langsung)
- **Glitch / Replit**
