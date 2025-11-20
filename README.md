# 🚀 End-to-End 5G Core Management Prototype

A comprehensive 5G Core Network Management System with RESTCONF API support, real-time monitoring with Prometheus & Grafana, and an intuitive web-based dashboard for network function management.

## 🎯 Features

- ✅ **RESTCONF API** - RFC 8040 compliant REST interface for 5G core management
- ✅ **Network Function Monitoring** - Real-time AMF, SMF, UPF status and metrics
- ✅ **Subscriber Management** - Complete UE registration, authentication, and lifecycle management
- ✅ **Network Slicing** - Configure and manage network slices with QoS policies
- ✅ **Prometheus Integration** - Metrics collection and time-series monitoring
- ✅ **Grafana Dashboards** - Pre-configured visualization dashboards for 5G Core metrics
- ✅ **Docker Support** - Containerized deployment with Docker Compose
- ✅ **Modern Web Dashboard** - 7-tab interface for comprehensive network management

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Web Dashboard │────▶│  Flask Backend   │────▶│  MongoDB    │
│   (HTML/JS)     │     │  RESTCONF API    │     │  (Optional) │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               │ /metrics
                               ▼
                        ┌──────────────┐
                        │  Prometheus  │
                        │   (Metrics)  │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Grafana    │
                        │ (Dashboards) │
                        └──────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** (for backend)
- **Docker Desktop** (for Prometheus & Grafana monitoring)
- Modern web browser

### Option 1: Run Backend Only (Quick Demo)

1. **Clone the repository:**
```bash
git clone https://github.com/Shahrukh1003/End-to-End-5G-Management-Prototype.git
cd End-to-End-5G-Management-Prototype/backend
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Start the backend:**
```bash
python app.py
```

4. **Open the dashboard:**
   - Open `dashboard.html` in your browser
   - Backend API: http://localhost:5000

### Option 2: Full Stack with Monitoring (Docker)

1. **Start Docker Desktop** (ensure it's running)

2. **Clone and navigate:**
```bash
git clone https://github.com/Shahrukh1003/End-to-End-5G-Management-Prototype.git
cd End-to-End-5G-Management-Prototype
```

3. **Start monitoring stack:**
```bash
docker-compose -f docker-compose-monitoring.yml up -d
```

4. **Start backend:**
```bash
cd backend
python app.py
```

5. **Access services:**
   - **Dashboard**: Open `dashboard.html` in browser
   - **Backend API**: http://localhost:5000
   - **Prometheus**: http://localhost:9090
   - **Grafana**: http://localhost:3002 (credentials: `admin`/`admin`)

## 📊 Monitoring & Metrics

### Prometheus Metrics
The backend exposes comprehensive metrics at `http://localhost:5000/metrics`:

- **`restconf_requests_total`** - Total API requests by endpoint and method
- **`restconf_request_latency_seconds`** - Request latency histogram
- **`nf_status`** - Network function status (1=active, 0=down)
- **`nf_load_percent`** - Network function load percentage
- **`nf_sessions_total`** - Active sessions per network function
- **`registered_ues_total`** - Total registered user equipment
- **`upf_throughput_mbps`** - UPF throughput in Mbps
- **`upf_packets_total`** - Total packets processed by UPF

### Grafana Dashboard Setup

1. **Access Grafana**: http://localhost:3002 (login: `admin`/`admin`)

2. **Add Prometheus Data Source:**
   - Go to Connections → Data Sources → Add data source
   - Select "Prometheus"
   - URL: `http://prometheus:9090`
   - Click "Save & Test"

3. **Import Pre-configured Dashboard:**
   - Go to Dashboards → New → Import
   - Upload file: `monitoring/grafana-dashboard.json`
   - Select Prometheus data source
   - Click "Import"

4. **View Real-time Metrics:**
   - Network Functions Status (AMF, SMF, UPF)
   - Registered UEs count
   - API Request Rate & Latency
   - UPF Throughput & Packet Count
   - Network Function Load & Sessions

For detailed setup instructions, see [GRAFANA_SETUP.md](GRAFANA_SETUP.md)

## 📱 Dashboard Features

The web dashboard provides 7 comprehensive tabs:

1. **Network Functions** - Monitor AMF, SMF, UPF status and performance
2. **Subscriber Management** - Register, view, and manage UE subscribers
3. **Network Slicing** - Configure network slices with custom parameters
4. **QoS Policies** - Define and manage Quality of Service policies
5. **Monitoring** - Real-time metrics and performance graphs
6. **Alarms** - View and manage system alerts and notifications
7. **Configuration** - System settings and network function configuration

## 📡 RESTCONF API Examples

### Get Network Function Status

**Get AMF Configuration:**
```bash
curl http://localhost:5000/restconf/data/open5gs:core/amf
```

**Get SMF Configuration:**
```bash
curl http://localhost:5000/restconf/data/open5gs:core/smf
```

**Get UPF Configuration:**
```bash
curl http://localhost:5000/restconf/data/open5gs:core/upf
```

### Subscriber Management

**List All Subscribers:**
```bash
curl http://localhost:5000/restconf/data/open5gs:subscribers
```

**Register New Subscriber:**
```bash
curl -X POST http://localhost:5000/restconf/data/open5gs:subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "imsi": "999700000000001",
    "msisdn": "821012345678",
    "k": "465B5CE8B199B49FAA5F0A2EE238A6BC",
    "opc": "E8ED289DEBA952E4283B54E88E6183CA",
    "apn": "internet"
  }'
```

**Delete Subscriber:**
```bash
curl -X DELETE http://localhost:5000/restconf/data/open5gs:subscribers/subscriber=999700000000001
```

**Deregister UE:**
```bash
curl -X POST http://localhost:5000/restconf/operations/open5gs:deregister-ue \
  -H "Content-Type: application/json" \
  -d '{"input": {"imsi": "999700000000001"}}'
```

### Metrics Endpoint

**Get Prometheus Metrics:**
```bash
curl http://localhost:5000/metrics
```

## 🛠️ Technology Stack

**Backend:**
- Python 3.11+ with Flask
- RESTCONF API (RFC 8040 compliant)
- Prometheus Client (metrics export)
- MongoDB support (optional, uses in-memory storage by default)

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Modern responsive design
- Real-time data updates

**Monitoring:**
- Prometheus (metrics collection)
- Grafana 10.4.3 (visualization)
- Docker Compose (container orchestration)

## 📁 Project Structure

```
End-to-End-5G-Management-Prototype/
├── backend/
│   ├── app.py                    # Main Flask application
│   ├── netconf_server.py         # NETCONF server implementation
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile               # Backend container image
├── monitoring/
│   ├── prometheus.yml           # Prometheus configuration
│   └── grafana-dashboard.json   # Pre-configured Grafana dashboard
├── dashboard.html               # Main web dashboard
├── docker-compose-monitoring.yml # Docker Compose for monitoring stack
├── GRAFANA_SETUP.md            # Grafana setup guide
└── README.md                   # This file
```

## 📚 Documentation

- **[GRAFANA_SETUP.md](GRAFANA_SETUP.md)** - Complete Grafana configuration guide
- **Backend API** - RESTCONF endpoints documentation in code
- **Prometheus Metrics** - Available at `/metrics` endpoint

## 🎓 Use Cases

This project demonstrates:
- **5G Core Network Management** - AMF, SMF, UPF configuration and monitoring
- **RESTCONF Protocol** - RFC 8040 compliant REST API for network management
- **Subscriber Lifecycle Management** - UE registration, authentication, and deregistration
- **Real-time Monitoring** - Prometheus metrics and Grafana dashboards
- **Network Slicing** - Configuration and management of network slices
- **Microservices Architecture** - Containerized deployment with Docker

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available for educational and research purposes.

## 👤 Author

**Shahrukh**
- GitHub: [@Shahrukh1003](https://github.com/Shahrukh1003)
- Repository: [End-to-End-5G-Management-Prototype](https://github.com/Shahrukh1003/End-to-End-5G-Management-Prototype)

## 🙏 Acknowledgments

- 3GPP Standards for 5G Core Network specifications
- IETF RFC 8040 (RESTCONF Protocol)
- Prometheus & Grafana communities
- Open source contributors