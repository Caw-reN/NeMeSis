UI/UX DESIGN SYSTEM & GUIDELINES
Project Name: Network Command Center & Topology Mapper (NMS)
CSS Framework: Tailwind CSS + shadcn/ui
Animation: motion.dev (Framer Motion)
Design Language: Modern Light Mode, Clean & Bold (Enterprise SaaS Style)

================================================================================
1. KONSEP VISUAL (VISUAL CONCEPT)
================================================================================
Antarmuka menggunakan pendekatan Light Mode dengan pemanfaatan whitespace (ruang kosong) yang lega agar terlihat clean. Kesan bold didapatkan dari penggunaan tipografi yang tebal pada elemen krusial, bayangan (shadows) yang lembut untuk kedalaman dimensi, dan garis batas (borders) yang tegas bergaya shadcn.

================================================================================
2. TIPOGRAFI (TYPOGRAPHY)
================================================================================
Menggunakan sistem font-pairing untuk menciptakan kontras visual yang profesional:
* Heading & Display (Judul & Angka Metrik): "Plus Jakarta Sans"
  Karakter: Kuat, modern, dan tegas. Wajib gunakan weight Extra Bold (800) atau Black (900) untuk metrik penting dan judul agar terlihat sangat tebal (bold).
* Body & UI Text (Tabel, Deskripsi, Form): "Inter" atau "Geist Sans"
  Karakter: Sangat terbaca dalam ukuran kecil, proporsional untuk data tabel jaringan yang padat.

================================================================================
3. PALET WARNA (COLOR PALETTE)
================================================================================
Menggunakan skema warna yang terang, bersih, namun tetap memiliki kontras tinggi untuk status jaringan:

[Kategori]         | [Tailwind Classes]                 | [Fungsi & Penerapan]
--------------------------------------------------------------------------------
Background (Latar) | bg-slate-50 atau bg-gray-50        | Latar belakang kanvas utama agar tidak terlalu menyilaukan.
Surface (Permukaan)| bg-white dengan border-slate-200   | Latar untuk kartu (cards), modal, dan sidebar.
Text Primary       | text-slate-900                     | Teks utama, judul, dan data penting. Sangat kontras.
Text Secondary     | text-slate-500                     | Label, teks placeholder, dan deskripsi tambahan.
Brand / Accent     | bg-zinc-900 atau bg-indigo-600     | Tombol utama (Primary Button), warna bold yang elegan.
Status UP (Hijau)  | text-emerald-600 & bg-emerald-50   | Indikator perangkat hidup atau metrik normal.
Status DOWN (Merah)| text-rose-600 & bg-rose-50         | Indikator perangkat mati, jaringan putus, alarm peringatan.
Status WARNING     | text-amber-600 & bg-amber-50       | Indikator CPU tinggi atau lalu lintas padat.

================================================================================
4. PANDUAN KOMPONEN SPESIFIK (SPECIFIC COMPONENTS)
================================================================================
A. Widget Kartu dengan shadcn/ui
* Gunakan komponen Card dari shadcn/ui.
* Buat agar kartu terasa bold dengan border tipis border-slate-200 dan sedikit efek bayangan shadow-sm.
* Angka statistik utama di dalam kartu wajib menggunakan Plus Jakarta Sans dengan weight tebal dan ukuran besar.

B. Topology Canvas (Kanvas Jaringan)
* Latar Belakang: Gunakan warna bg-slate-50 dengan motif titik-titik samar (menggunakan pola SVG dot pattern) untuk memberikan kesan papan blueprint modern.
* Nodes (Perangkat): Kotak putih bersih (bg-white) bersudut tumpul (rounded-xl).
* Shadows: Berikan bayangan dramatis pada perangkat yang bermasalah (misalnya shadow-rose-500/50) agar langsung menarik perhatian mata.

C. Animasi dengan motion.dev
* Page Transitions: Gunakan animasi fade-in yang sangat halus (sekitar 0.2s - 0.3s) saat berpindah antar halaman atau membuka modal. Jangan berlebihan.
* Live Traffic Animation (Rudal): Gunakan Framer Motion untuk membuat partikel SVG bergerak di sepanjang garis koneksi antar node (misalnya menembakkan titik berwarna biru terang dari klien ke router) secara berulang (looping).
* Status Pop-up: Saat node perangkat baru terdeteksi (auto-discovery), gunakan animasi spring atau pantulan kecil (scale up dari 0 ke 1) agar UI terasa hidup.