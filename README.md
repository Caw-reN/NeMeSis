# Network Command Center & Topology Mapper (NMS)

A full-stack Network Management System (NMS) built with a hybrid microservices architecture, combining a Laravel API backend, a React.js dashboard frontend, and a high-performance Go network scanning worker — all orchestrated via Docker Compose.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js + Vite, Tailwind CSS, shadcn/ui, Vis.js / React Flow |
| **Backend** | PHP 8.3, Laravel 11, Laravel Sanctum |
| **Worker** | Go (Golang) |
| **Database** | MySQL 8.0 |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## Project Structure

```
/NMS
├── /frontend       # React.js Dashboard
├── /backend        # Laravel 11 API & Business Logic
├── /worker         # Go Network Scanning Engine
├── /docker         # Docker configuration files (Nginx, PHP, MySQL)
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Docker & Docker Compose installed
- (For local dev) PHP 8.3+, Composer, Node.js 20+, Go 1.22+

### 1. Clone the repository & configure environment
```bash
# Copy and edit the root environment file
cp .env.example .env

# Copy and edit the Laravel environment file
cp backend/.env.example backend/.env
```

### 2. Start Docker services
```bash
docker-compose up -d --build
```

### 3. Run Laravel setup (first time)
```bash
docker exec -it nms_backend php artisan key:generate
docker exec -it nms_backend php artisan migrate --seed
```

### 4. Access the application
- **Backend API:** http://localhost:8000/api
- **Database:** localhost:3306 (use your DB credentials from .env)

## Development Roadmap
- **Phase 1:** Core Infrastructure (Laravel API + Go Ping/SNMP executor)
- **Phase 2:** UI & Topology (React Dashboard + Vis.js Canvas)
- **Phase 3:** Advanced Device Integration (Mikrotik API + Cisco SSH)
- **Phase 4:** Aesthetics & Logs (WebSocket Live Traffic + Docker full deployment)
