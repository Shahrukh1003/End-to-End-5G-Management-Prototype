# 🚀 5G Core Management System

A modern, feature-rich 5G Core Network Management System with RESTCONF/NETCONF protocol support, real-time monitoring, and comprehensive subscriber management.

## 🎯 Features

- ✅ RESTCONF API (RFC 8040 compliant)
- ✅ NETCONF server (RFC 6241)
- ✅ YANG data models for 5G network functions
- ✅ Real-time dashboard for AMF, SMF, UPF monitoring
- ✅ Subscriber (UE) management
- ✅ PDU session tracking
- ✅ Docker-based microservices architecture
- ✅ Subscriber automation (JSON batch, CSV import/export)

## 🏗️ Architecture
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│   Flask      │────▶│  Open5GS    │
│  Dashboard  │     │NETCONF/REST  │     │    Core     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   NETCONF    │     │   MongoDB   │
                    │   Server     │     │             │
                    └──────────────┘     └─────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/5g-core-management-system.git
cd 5g-core-management-system
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access services:
- **Dashboard**: http://localhost:3001
- **RESTCONF API**: http://localhost:5000/restconf
- **Backend API**: http://localhost:5000/api
- **Open5GS WebUI**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (default credentials: `admin`/`admin`)

## 📊 Monitoring & Alerts

- The backend exposes Prometheus metrics at `http://localhost:5000/metrics` and recent alerts at `http://localhost:5000/api/alerts`.
- `docker-compose.yml` now deploys Prometheus + Grafana; dashboards can be built against the `netconf-backend` scrape job.
- Built-in SLA checks raise alert events (visible in the UI and `/api/alerts`). Configure thresholds through environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `SLA_TARGET` | `99.0` | Minimum acceptable SLA percentage |
| `LATENCY_THRESHOLD_MS` | `150` | Trigger alert when estimated RESTCONF latency exceeds this |
| `LOAD_THRESHOLD_PERCENT` | `80` | Trigger alert when AMF/SMF load crosses this value |
| `ALERT_COOLDOWN_SECONDS` | `120` | Minimum time between repeated alerts of the same type |
| `ALERT_WEBHOOK_URL` | _(unset)_ | Optional HTTP webhook to forward alert payloads (e.g., Slack/MS Teams) |

Set `ALERT_WEBHOOK_URL` in a `.env` file (or host environment) before running `docker compose up` to enable outbound notifications.

## 🤖 Subscriber Automation

- Use the **Automation** tab in the dashboard (http://localhost:3001) to:
  - Batch provision subscribers by pasting JSON arrays
  - Import/export CSV files (`imsi, msisdn, k, opc, amf, dnn`)
  - Bulk delete IMSIs and trigger immediate subscriber sync
- Backend helper endpoints:
  - `GET  /api/subscribers` – simplified inventory listing for the UI
  - `POST /api/subscribers/batch` – create/update multiple subscribers (JSON payload)
  - `POST /api/subscribers/import` – CSV upload (`multipart/form-data`)
  - `GET  /api/subscribers/export` – download the current inventory as CSV
  - `POST /api/subscribers/batch-delete` – remove subscribers by IMSI list

## 📡 API Examples

### Get AMF Configuration
```bash
curl http://localhost:5000/restconf/data/open5gs:core/amf
```

### Register New Subscriber
```bash
curl -X POST http://localhost:5000/restconf/data/open5gs:subscribers \
  -H "Content-Type: application/json" \
  -d '{"imsi": "310150999888777", "k": "00112233445566778899aabbccddeeff"}'
```

### Deregister UE
```bash
curl -X POST http://localhost:5000/restconf/operations/open5gs:deregister-ue \
  -H "Content-Type: application/json" \
  -d '{"input": {"imsi": "310150999888777"}}'
```

## 🛠️ Technology Stack

**Backend:**
- Python Flask
- RESTCONF (RFC 8040)
- NETCONF (RFC 6241)
- MongoDB
- YANG Models

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Lucide Icons

**Infrastructure:**
- Docker & Docker Compose
- Nginx

## 📚 Documentation

See [FLOWCHART.txt](FLOWCHART.txt) for detailed architecture diagrams.

## 🎓 Academic Use

This project is designed for educational and research purposes, demonstrating:
- 5G core network architecture
- Network management protocols (RESTCONF/NETCONF)
- Microservices design patterns
- Real-time monitoring systems

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 👤 Author

Om Shinde

## 🙏 Acknowledgments

- Open5GS Project
- 3GPP Standards
- IETF RFC 8040 (RESTCONF)