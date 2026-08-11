# Project Architecture & Structure
**Project Name:** Network Command Center & Topology Mapper (NMS)
**Architecture Pattern:** Monorepo with Containerized Microservices

## 1. Konsep Arsitektur
Proyek ini menggunakan pendekatan **Monorepo** untuk memudahkan pengembangan, di mana seluruh kode sumber (Frontend, Backend, dan Worker) disatukan dalam satu repositori Git. Namun, pada saat *runtime* (dieksekusi), aplikasi berjalan sebagai **Microservices** yang terisolasi di dalam *container* Docker masing-masing.

## 2. Alur Komunikasi Antar Layanan
1. **Frontend (React) <-> Backend (Laravel):** Berkomunikasi melalui REST API (JSON) menggunakan token autentikasi (Laravel Sanctum). Frontend tidak memiliki akses langsung ke database.
2. **Backend (Laravel) <-> Database (MySQL):** Menggunakan ORM (Eloquent) untuk membaca/menulis data inventaris, pengguna, log, dan topologi.
3. **Backend (Laravel) <-> Network Devices:** Berkomunikasi secara aktif (Write Mode) via **Mikrotik API (Port 8728/8729)** atau **SSH Automation** (Cisco Catalyst) untuk fungsi *Remote Configuration/Provisioning*.
4. **Worker (Go) <-> Database (MySQL):** Melakukan koneksi langsung ke database menggunakan *driver* `go-sql-driver/mysql` untuk menulis hasil pindaian secara massal (*bulk insert/update*) secara cepat.
5. **Worker (Go) <-> Network Devices:** Berkomunikasi secara pasif/polling (Read Mode) via **ICMP (Ping)**, **SNMP (UDP 161)**, dan pemindaian **TCP/UDP Ports** untuk mengekstrak metrik dan *Auto-Discovery* CDP/LLDP.

## 3. Struktur Direktori (Folder Tree)
Berikut adalah struktur root direktori yang harus diikuti untuk proyek ini:

```text
/NMS-Project
│
├── /frontend               # [REACT.JS] Antarmuka Pengguna & Dashboard
│   ├── /public
│   ├── /src
│   │   ├── /assets
│   │   ├── /components     # (Reusable UI: Navbar, Modal, Vis.js/ReactFlow Canvas)
│   │   ├── /pages          # (Dashboard, Devices, Topology Map, Settings)
│   │   ├── /services       # (Axios config & API calls)
│   │   └── /utils          # (Helpers, GeoIP formatter, dll)
│   ├── package.json
│   └── vite.config.js
│
├── /backend                # [LARAVEL 11] API API, Auth, & Logika Bisnis
│   ├── /app
│   │   ├── /Console        # (Scheduler/Cron jobs)
│   │   ├── /Http
│   │   │   ├── /Controllers# (DeviceController, TopologyController, dll)
│   │   │   ├── /Requests   # (Form Validation)
│   │   │   └── /Resources  # (API JSON Transformers)
│   │   ├── /Models         # (Device, TopologyLink, DeviceLog, dll)
│   │   └── /Services       # (Logika Mikrotik API & Cisco SSH Wrapper)
│   ├── /database
│   │   ├── /migrations
│   │   └── /seeders
│   ├── /routes
│   │   ├── api.php         # (Semua endpoint untuk Frontend)
│   │   └── console.php
│   ├── composer.json
│   └── .env.example
│
├── /worker                 # [GOLANG] Mesin Pindai Jaringan Paralel
│   ├── /cmd
│   │   └── nms-worker      # (Entry point: main.go)
│   ├── /internal
│   │   ├── /config         # (Load ENV, DB connection)
│   │   ├── /database       # (Query MySQL: update status, insert log)
│   │   ├── /scanner        # (Logika Ping & TCP/UDP Port Scanner)
│   │   └── /snmp           # (Logika penarikan OID SNMP untuk Mikrotik/Cisco)
│   ├── /pkg
│   │   └── /logger         # (Custom error logging)
│   ├── go.mod
│   └── go.sum
│
├── docker-compose.yml      # Orkestrasi seluruh container (Frontend, Backend, Worker, DB)
├── .gitignore
└── README.md


4. Konfigurasi Container (Docker)
Layanan akan diorkestrasi menggunakan docker-compose.yml dengan pemetaan port sebagai berikut:

frontend service: Build dari folder /frontend, expose port 80 atau 3000.

backend service: Build dari folder /backend (PHP-FPM + Nginx), expose port 8000.

worker service: Build dari folder /worker (Go Binary), berjalan di latar belakang (tanpa expose port eksternal HTTP, kecuali port UDP 514 jika menerima Syslog).

database service: Image mysql:8.0, expose port 3306, dilengkapi named volume untuk persistensi data.