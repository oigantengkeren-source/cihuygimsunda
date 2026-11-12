# 🎮 CihuyGimSunda — Modul Sistem Room Multiplayer (Host & Join Kode)

Repository ini menyimpan **kode sistem Room Multiplayer (Host & Join menggunakan Kode Unik)** yang siap diintegrasikan langsung ke Frontend/UI Game utama, dilengkapi dengan **Menu Simulasi** untuk menguji bahwa seluruh fungsi kode berjalan dengan baik.

---

## 📦 File Utama untuk Tim Frontend / UI

| Nama File | Fungsi |
| :--- | :--- |
| **[`room-system.js`](./room-system.js)** | **FILE INTI (CORE MODULE).** Berisi class `CihuyRoomSystem` yang menangani pembuatan kode room, join room, daftar pemain, status ready, chat, dan pengiriman data game real-time antar-device tanpa perlu setup server lokal. |
| **[`index.html`](./index.html)** & **[`simulation.js`](./simulation.js)** | **MENU SIMULASI (TESTBENCH).** Halaman antarmuka sementara yang hanya digunakan untuk mengetes dan mensimulasikan bahwa kode di `room-system.js` bekerja dengan baik. |
| **[`server.js`](./server.js)** | *(Opsional)* Alternatif server backend Node.js + Socket.io jika tim ingin menjalankan server khusus sendiri. |

---

## 🛠️ Cara Integrasi ke Frontend / UI Game Utama

Tim Frontend/UI cukup memanggil file **`room-system.js`** ke dalam proyek game utama (bisa di-copy filenya atau dipanggil langsung dari repository GitHub ini):

### 1. Pasang Script di HTML Game Utama
```html
<script src="room-system.js"></script>
```

### 2. Inisialisasi Sistem & Sambungkan ke UI Kalian
```javascript
const roomSystem = new CihuyRoomSystem({
  maxPlayers: 8,

  // Dipanggil otomatis setiap ada pemain masuk/keluar/klik ready
  onRoomUpdated: (room) => {
    console.log("Kode Room:", room.code);
    console.log("Daftar Pemain:", room.players);
    // -> Update tampilan daftar pemain di UI kalian di sini
  },

  // Dipanggil saat Host menekan tombol Start Game
  onGameStarted: (room, initialData) => {
    console.log("Permainan dimulai!", room, initialData);
    // -> Pindahkan layar UI dari Lobby ke Arena Game kalian
  },

  // Dipanggil saat menerima data koordinat/skor/aksi dari pemain lain di room yang sama
  onGameData: (senderId, payload) => {
    console.log("Data dari pemain:", senderId, payload);
    // -> Update posisi/animasi karakter teman di game kalian
  },

  // Dipanggil jika kode room salah atau room penuh
  onError: (pesanError) => {
    alert(pesanError);
  }
});
```

### 3. Panggil Fungsi pada Tombol-Tombol Menu Kalian
```javascript
// A. Saat tombol "Buat Room (Host)" ditekan:
const room = await roomSystem.createRoom("NamaHost");
console.log("Bagikan kode ini ke teman:", room.code); // Contoh: "K9X2B"

// B. Saat tombol "Gabung Room (Join)" ditekan dengan input kode:
await roomSystem.joinRoom("K9X2B", "NamaTeman");

// C. Saat pemain tamu menekan tombol "Siap / Ready":
roomSystem.toggleReady();

// D. Saat Host menekan tombol "Mulai Game":
roomSystem.startGame({ map: "level_1" });

// E. Mengirim data pergerakan/aksi selama di dalam game:
roomSystem.sendGameData({ type: "MOVE", x: 150, y: 200 });

// F. Keluar dari room:
roomSystem.leaveRoom();
```

---

## 🧪 Cara Mencoba Menu Simulasi

Untuk mencoba dan memastikan kodenya bekerja:
1. Buka halaman simulasi (`index.html` atau melalui link GitHub Pages repository ini).
2. Klik **"Buat Room Baru"** di tab/perangkat pertama untuk mendapatkan **Kode Room 5 karakter**.
3. Buka tab/perangkat kedua, masukkan **Kode Room** tersebut di kolom **Simulasi Join**, lalu klik **"Gabung"**.
4. Kedua perangkat akan langsung berada di satu room yang sama dan dapat menguji fitur **Ready**, **Chat**, hingga **Mulai Simulasi Game**.
