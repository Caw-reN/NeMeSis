PRODUCT REQUIREMENTS DOCUMENT (PRD)
Nama Produk: Network Command Center & Topology Mapper (NMS)
Fase Dokumen: Finalisasi Kebutuhan Awal
Tanggal: 10 Agustus 2026

================================================================================
1. IKHTISAR PROYEK (PROJECT OVERVIEW)
================================================================================
Proyek ini bertujuan membangun aplikasi Network Management System (NMS) mandiri berbasis web yang menggabungkan kemampuan pemantauan jaringan (monitoring) tingkat lanjut dengan fungsionalitas manajemen konfigurasi jarak jauh (provisioning). Sistem ini dirancang menggunakan arsitektur hybrid guna memisahkan beban kerja pemrosesan jaringan di latar belakang dengan logika antarmuka pengguna, memberikan visualisasi topologi interaktif layaknya simulator jaringan, serta menyajikan metrik secara real-time.

================================================================================
2. TUJUAN & SASARAN (GOALS & OBJECTIVES)
================================================================================
* Visibilitas End-to-End: Memberikan visibilitas penuh terhadap status perangkat fisik (Router/Switch), layanan web (Port TCP/UDP), dan metrik aplikasi (Sesi aktif).
* Pemetaan Dinamis: Menyediakan kanvas topologi interaktif yang dapat memetakan jaringan secara otomatis (auto-discovery) maupun diubah secara manual (drag & drop).
* Kendali Terpusat: Memungkinkan administrator melakukan perubahan konfigurasi dasar (seperti port VLAN dan IP) langsung dari dashboard web tanpa harus membuka terminal atau aplikasi pihak ketiga.
* Performa Eksekusi: Melakukan pemindaian secara paralel pada ratusan IP tanpa memicu bottleneck memori pada server host.

================================================================================
3. ARSITEKTUR & TEKNOLOGI (TECH STACK)
================================================================================
Sistem dibangun dengan memisahkan mesin pemindai dan layanan web, lalu diisolasi menggunakan container.

[Komponen Sistem]      | [Teknologi Utama]    | [Deskripsi & Peran]
--------------------------------------------------------------------------------
Network Engine (Worker)| Go (Golang)          | Berjalan di latar belakang untuk mengeksekusi ping massal, port scanning, SNMP polling, dan menangkap log.
Backend Web & API      | PHP (Laravel)        | Pusat kontrol logika bisnis, mengatur autentikasi, mengelola database, dan mengirimkan perintah eksekusi ke perangkat.
Frontend Dashboard     | React.js             | Menampilkan antarmuka (Dark Mode), memuat kanvas Vis.js/React Flow, dan menyajikan data real-time via WebSockets.
Visualisasi Topologi   | Vis.js / React Flow  | Merender diagram jaringan dengan animasi edge dan manipulasi node (Drag, Drop, Zoom).
Database               | MySQL                | Menyimpan profil perangkat, riwayat koneksi, status port, relasi topologi (parent-child), dan kredensial perangkat yang dienkripsi.
Infrastruktur          | Docker & Nginx       | Pembungkusan microservices (Go, Laravel, React, MySQL) dalam Docker Compose untuk deployment VPS.

================================================================================
4. FITUR UTAMA (CORE FEATURES)
================================================================================
A. Interactive Topology Canvas
* Auto-Discovery: Menggunakan protokol CDP/LLDP via SNMP (terutama untuk Cisco Catalyst) untuk menemukan dan menggambar relasi perangkat tetangga secara otomatis.
* Manual Provisioning: Fitur drag-and-drop bagi pengguna untuk menambahkan perangkat "buta" (seperti Unmanaged Switch) ke dalam kanvas dan menarik garis relasi manual menuju perangkat utama.
* Live Indicators: Perubahan warna ikon perangkat dan garis koneksi (node & edge) secara real-time berdasarkan status ketersediaan.

B. Deep Monitoring (Mikrotik & Cisco)
* Mikrotik RB1100 (Core): Integrasi via Mikrotik API untuk membaca beban CPU multi-core, status OSPF/Routing, tabel DHCP leases, dan lalu lintas Rx/Tx per antarmuka.
* Cisco Catalyst (Distribution): Integrasi via SNMP untuk membaca metrik per-VLAN traffic, status antarmuka Trunk/Access, dan lalu lintas paket jaringan.

C. Remote Configuration (Provisioning)
* Port Management: Mengaktifkan (enable) atau mematikan (disable/shutdown) port tertentu pada Switch/Router langsung dari antarmuka web.
* VLAN & IP Assignment: Mengubah alokasi VLAN pada port access Cisco Catalyst (via SSH Automation) atau merubah konfigurasi IP dasar di Mikrotik (via API).

D. Live Traffic Animation (Cyber Threat Map)
* Penerimaan log NetFlow atau DNS dari perangkat inti oleh worker Go.
* Visualisasi animasi tembakan cahaya/rudal melintasi layar dari IP klien menuju target internet menggunakan integrasi WebSockets di frontend React.

E. Service Scanner & App Metrics
* Pemindaian ketersediaan layanan pada port spesifik (TCP 80/443, UDP 19132, dll).
* Penarikan data (fetching) dari endpoint API eksternal untuk menampilkan jumlah active user login pada layanan web pihak ketiga.
* Peringatan keamanan jika port manajemen yang seharusnya tertutup (seperti Telnet 23) terdeteksi publik.

================================================================================
5. BATASAN SISTEM (CONSTRAINTS & OUT OF SCOPE)
================================================================================
1. Agentless Architecture: Sistem ini tidak memerlukan instalasi agen (agent-based) di sisi perangkat target. Semua pemantauan dilakukan secara eksternal (Ping, SNMP, API, SSH).
2. Batasan Konfigurasi Jarak Jauh: Fungsionalitas Remote Configuration dibatasi hanya untuk perintah operasional dasar (Ubah VLAN, Enable/Disable Port, Ubah IP). Sistem tidak akan mendukung perubahan logika berat seperti Routing Protocols (OSPF/BGP) dari web guna mencegah lockout (koneksi terputus ke alat).
3. Rate Limiting & Polling Interval: Pemindaian port penuh (Full Port Scan) hanya dilakukan saat dipicu secara manual oleh pengguna, bukan berjalan otomatis setiap detik, untuk menghindari identifikasi serangan DDoS lokal oleh perangkat jaringan. Polling standar (Ping/SNMP) dilakukan dengan jeda minimum 30-60 detik.
4. Bukan Pengganti Zabbix Penuh: Sistem tidak bertujuan mereplikasi fitur kompleks seperti Active Proxy atau pembuatan custom script agent seperti pada Zabbix. Fokus utama adalah visibilitas topologi dan otomasi tugas harian.

================================================================================
6. KEBUTUHAN KEAMANAN (SECURITY REQUIREMENTS)
================================================================================
* Enkripsi Kredensial: Seluruh password perangkat, token API Mikrotik, dan kunci SSH Cisco harus disimpan di database MySQL dengan metode enkripsi dua arah (AES-256-CBC bawaan Laravel).
* Autentikasi API: Komunikasi antara dashboard React, worker Go, dan API Laravel diamankan menggunakan Laravel Sanctum.
* Validation & Confirmation: Setiap aksi Remote Configuration yang akan mengubah konfigurasi perangkat (Write Mode) wajib memunculkan peringatan pop-up (Konfirmasi Eksekusi) dan mencatat jejak audit (audit trail log) pengguna yang melakukannya.

================================================================================
7. TAHAPAN PENGEMBANGAN (ROADMAP / PHASES)
================================================================================
* Fase 1 (Infrastruktur Inti): Pembuatan API di Laravel dan eksekutor Go untuk Ping dan deteksi SNMP sederhana.
* Fase 2 (UI & Topologi): Membangun Dashboard React, mengintegrasikan Vis.js untuk kanvas, dan memastikan fitur perangkat manual berfungsi.
* Fase 3 (Integrasi Alat Tingkat Lanjut): Menyematkan komunikasi API Mikrotik dan SSH Cisco untuk fitur Remote Configuration.
* Fase 4 (Estetika & Log): Pengembangan rute WebSockets untuk animasi Live Traffic, metrik aplikasi, dan Dockerization menyeluruh untuk deployment.