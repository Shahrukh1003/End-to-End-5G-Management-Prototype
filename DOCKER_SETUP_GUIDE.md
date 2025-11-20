# 🐳 Docker Setup Guide - Get Prometheus & Grafana Running

## Current Situation

✅ **What's Working:**
- Backend running manually on port 5000
- Dashboard working perfectly
- All features functional

❌ **What's Missing:**
- Docker not installed
- Prometheus not running
- Grafana not running
- MongoDB not running

---

## 🎯 Goal

Get the full stack running with:
- ✅ Prometheus (metrics collection)
- ✅ Grafana (visualization dashboards)
- ✅ MongoDB (data persistence)
- ✅ All services integrated

---

## 📦 Step 1: Install Docker Desktop

### Download Docker Desktop for Windows:

1. **Go to:** https://www.docker.com/products/docker-desktop/
2. **Click:** "Download for Windows"
3. **Run:** The installer (Docker Desktop Installer.exe)
4. **Follow:** Installation wizard
5. **Restart:** Your computer when prompted

### System Requirements:
- Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
- OR Windows 11 64-bit
- WSL 2 feature enabled
- 4GB RAM minimum (8GB recommended)

### Installation Steps:
```
1. Double-click Docker Desktop Installer.exe
2. Follow the installation wizard
3. Accept the license agreement
4. Choose "Use WSL 2 instead of Hyper-V" (recommended)
5. Click "Install"
6. Wait for installation to complete
7. Click "Close and restart"
```

### After Installation:
1. Docker Desktop will start automatically
2. You'll see the Docker icon in the system tray
3. Wait for "Docker Desktop is running" message

---

## ✅ Step 2: Verify Docker Installation

Open PowerShell and run:

```powershell
docker --version
docker-compose --version
```

You should see:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

---

## 🚀 Step 3: Stop Current Backend

Before starting Docker, stop the manually running backend:

```powershell
# Find the Python process
Get-Process | Where-Object {$_.ProcessName -like "*python*"}

# Stop it (or just close the terminal window)
```

---

## 🐳 Step 4: Start Docker Compose

Navigate to your project and start all services:

```powershell
cd End-to-End-5G-Core-Management-Prototype-master
docker-compose up -d
```

This will start:
- MongoDB (database)
- Open5GS (5G core network)
- Backend (Flask API)
- Frontend (dashboard)
- Prometheus (metrics)
- Grafana (dashboards)

### First Time Setup:
The first time you run this, Docker will:
1. Download all required images (~2-3 GB)
2. Build the backend container
3. Build the frontend container
4. Start all services

**This may take 5-10 minutes on first run.**

---

## 📊 Step 5: Access All Services

Once running, you can access:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3001 | None |
| **Backend API** | http://localhost:5000 | None |
| **Prometheus** | http://localhost:9090 | None |
| **Grafana** | http://localhost:3002 | admin / admin |
| **Open5GS WebUI** | http://localhost:3000 | None |

---

## 📈 Step 6: Set Up Grafana Dashboard

### 6.1 Login to Grafana:
1. Open http://localhost:3002
2. Login with: `admin` / `admin`
3. Skip password change (or set a new one)

### 6.2 Add Prometheus Data Source:
1. Click "Add your first data source"
2. Select "Prometheus"
3. Set URL: `http://prometheus:9090`
4. Click "Save & Test"
5. You should see "Data source is working"

### 6.3 Create Dashboard:
1. Click "+" → "Create Dashboard"
2. Click "Add visualization"
3. Select "Prometheus" data source

### 6.4 Add Panels:

**Panel 1: AMF Load**
- Metric: `nf_load_percent{nf="amf"}`
- Visualization: Time series
- Title: "AMF Load %"

**Panel 2: SMF Load**
- Metric: `nf_load_percent{nf="smf"}`
- Visualization: Time series
- Title: "SMF Load %"

**Panel 3: Registered UEs**
- Metric: `registered_ues_total`
- Visualization: Stat
- Title: "Total Registered UEs"

**Panel 4: UPF Throughput**
- Metric: `upf_throughput_mbps`
- Visualization: Time series
- Title: "UPF Throughput (Mbps)"

**Panel 5: Request Latency**
- Metric: `restconf_request_latency_seconds`
- Visualization: Heatmap
- Title: "Request Latency"

**Panel 6: Active Sessions**
- Metric: `nf_sessions_total`
- Visualization: Gauge
- Title: "Active Sessions"

---

## 🔧 Useful Docker Commands

### Check Status:
```powershell
docker-compose ps
```

### View Logs:
```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs prometheus
docker-compose logs grafana
```

### Stop Services:
```powershell
docker-compose stop
```

### Start Services:
```powershell
docker-compose start
```

### Restart Services:
```powershell
docker-compose restart
```

### Stop and Remove:
```powershell
docker-compose down
```

### Stop and Remove (including volumes):
```powershell
docker-compose down -v
```

---

## 🐛 Troubleshooting

### Issue: "Docker daemon is not running"
**Solution:**
1. Open Docker Desktop
2. Wait for it to start
3. Try again

### Issue: "Port already in use"
**Solution:**
```powershell
# Find what's using the port
netstat -ano | findstr :5000

# Stop the process or change the port in docker-compose.yml
```

### Issue: "Cannot connect to Docker daemon"
**Solution:**
1. Restart Docker Desktop
2. Check if WSL 2 is enabled
3. Run PowerShell as Administrator

### Issue: Containers won't start
**Solution:**
```powershell
# Check logs
docker-compose logs

# Rebuild containers
docker-compose up -d --build
```

### Issue: Out of disk space
**Solution:**
```powershell
# Clean up unused images
docker system prune -a

# Remove unused volumes
docker volume prune
```

---

## 📊 Prometheus Metrics Available

Your backend exposes these metrics:

### Network Function Metrics:
- `nf_status{nf="amf|smf|upf"}` - Status (1=active, 0=down)
- `nf_load_percent{nf="amf|smf|upf"}` - Load percentage
- `nf_sessions_total{nf="amf|smf"}` - Session count

### Subscriber Metrics:
- `registered_ues_total` - Total registered UEs

### UPF Metrics:
- `upf_throughput_mbps` - Throughput in Mbps
- `upf_packets_total` - Total packets

### Request Metrics:
- `restconf_request_latency_seconds` - Request latency histogram
- `restconf_requests_total` - Total requests counter

---

## 🎯 Quick Start Summary

### If Docker is NOT installed:
1. Install Docker Desktop from docker.com
2. Restart computer
3. Run `docker-compose up -d`
4. Access Grafana at http://localhost:3002

### If Docker IS installed:
1. Stop current backend
2. Run `docker-compose up -d`
3. Wait 5-10 minutes for first-time setup
4. Access all services

---

## 💡 Alternative: Keep Current Setup

If you don't want to install Docker, you can:

### Option A: Use Current Setup
- Keep running backend manually
- Use the dashboard as-is
- View metrics at http://localhost:5000/metrics
- No Grafana dashboards, but everything else works

### Option B: Install Prometheus & Grafana Separately
- Install Prometheus standalone
- Install Grafana standalone
- Configure them to scrape your backend
- More complex, but no Docker needed

---

## 🎉 What You'll Get with Docker

### Before (Current):
- ✅ Backend API
- ✅ Dashboard
- ❌ No Prometheus
- ❌ No Grafana
- ❌ No MongoDB persistence
- ❌ No Open5GS

### After (Docker):
- ✅ Backend API
- ✅ Dashboard
- ✅ **Prometheus** - Metrics collection
- ✅ **Grafana** - Beautiful dashboards
- ✅ **MongoDB** - Data persistence
- ✅ **Open5GS** - Full 5G core simulation
- ✅ All integrated and working together

---

## 📝 Next Steps

1. **Install Docker Desktop** (if not already installed)
2. **Restart your computer**
3. **Stop current backend**
4. **Run `docker-compose up -d`**
5. **Access Grafana** at http://localhost:3002
6. **Create dashboards** with the metrics
7. **Enjoy full monitoring!**

---

## 🆘 Need Help?

If you encounter issues:
1. Check Docker Desktop is running
2. Check the logs: `docker-compose logs`
3. Verify ports are not in use
4. Try rebuilding: `docker-compose up -d --build`

---

**Ready to install Docker and get Prometheus & Grafana running?** 🚀

Download Docker Desktop here: https://www.docker.com/products/docker-desktop/
