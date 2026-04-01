# RatioGuard

Monitor de ratio pentru trackere private de torrente, cu integrare Prowlarr si Transmission.

![RatioGuard Dashboard](docs/screenshot.png)

## Features

- Monitorizare ratio per tracker (Cookie, Login, API)
- Integrare Prowlarr - sync automat prioritati indexeri bazat pe ratio
- Integrare Transmission - recomandari si setare automata bandwidth priority
- Notificari Discord cand ratio scade sub threshold
- Dashboard cu grafic history si statistici Prowlarr
- Senzori Home Assistant via REST API

## Stack

- **Backend**: FastAPI + SQLite (SQLAlchemy async)
- **Frontend**: React + Tailwind CSS
- **Deployment**: Docker Compose

## Instalare

### 1. Cloneaza repo-ul

```bash
git clone https://github.com/yourusername/ratioguard.git
cd ratioguard
```

### 2. Creeaza fisierul .env

```bash
cp .env.example .env
```

Editeaza `.env` cu valorile tale:

```env
SECRET_KEY=your-random-secret-key
TRANSMISSION_URL=http://localhost:9091/transmission/rpc
TRANSMISSION_USER=your-username
TRANSMISSION_PASS=your-password
```

### 3. Build frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Porneste

```bash
docker compose up -d
```

Acceseaza la `http://localhost:7990`

## Configurare initiala

### Trackere

Mergi la tab **Trackers** si adauga trackere. Trei metode de autentificare:

- **Cookie** - pentru trackere cu Cloudflare. Copiaza cookies din browser.
- **Login** - username + parola. Nu functioneaza cu Cloudflare.
- **API** - pentru trackere cu API key (Seedpool, Darkpeers, ItaTorrents etc)

### Prowlarr

In **Settings** completeaza URL-ul si API key-ul Prowlarr. Dupa salvare, mergi la tab **Prowlarr** si leaga fiecare indexer de tracker-ul corespunzator. Prioritatile se vor actualiza automat dupa fiecare check.

### Transmission

In **Settings** completeaza URL-ul, username si parola Transmission (sau lasa gol daca nu are autentificare). Mergi la tab **Transmission** pentru recomandari si management prioritati.

### Discord Notifications

In **Settings** completeaza Discord Webhook URL. Vei primi notificare cand ratio-ul unui tracker scade sub threshold.

### Home Assistant

Endpoint disponibil la `/api/dashboard/ha-sensors`. Exemplu `sensors.yaml`:

```yaml
- platform: rest
  name: "RatioGuard Filelist"
  resource: http://YOUR_IP:7990/api/dashboard/ha-sensors
  scan_interval: 3600
  value_template: "{{ (value_json | selectattr('name', 'eq', 'Filelist') | list | first).ratio }}"
  unit_of_measurement: "ratio"
```

## Update

```bash
git pull
cd frontend && npm run build && cd ..
docker compose down
docker compose up -d
```

## Trackere testate

| Tracker | Metoda |
|---------|--------|
| FileList.io | Login |
| SpeedApp.io | Login |
| Seedpool.org | API |
| DarkPeers.org | API |
| ItaTorrents.xyz | API |
| TorrentLeech | Login |
| Upload.cx | API |
| HD-Space | Cookie |

## Structura proiect

```
ratioguard/
├── backend/
│   └── app/
│       ├── api/          # FastAPI routers
│       ├── core/         # Config, Database, Scheduler
│       ├── models/       # Pydantic schemas
│       ├── scrapers/     # Universal ratio scraper
│       └── services/     # Checker, Prowlarr, Transmission
├── frontend/
│   └── src/
│       ├── hooks/        # API client
│       └── pages/        # React pages
├── nginx/
├── .env.example
├── docker-compose.yml
└── README.md
```

## License

MIT
