# 🚀 Start Monitoring Stack - Simple Guide

## Current Status

✅ Docker Desktop installed  
⏳ Docker Desktop starting...  
⏳ Waiting for Docker daemon to be ready

---

## 📋 Steps to Get Prometheus & Grafana Running

### Step 1: Wait for Docker Desktop (1-2 minutes)

Look for the Docker icon in your system tray (bottom-right).  
Wait until it shows: **"Docker Desktop is running"**

### Step 2: Verify Docker is Ready

Run this command:
```powershell
docker ps
```

If you see a table (even if empty), Docker is ready!

### Step 3: Start Your Backend

```powershell
cd End-to-End-5G-Core-Management-Prototype-master\backend
python app.py
```

Leave this running in the background.

### Step 4: Start Prometheus & Grafana

In a NEW PowerShell window:
```powershell
cd End-to-End-5G-Core-Management-Prototype-master
docker compose -f docker-compose-monitoring.yml up -d
```

This will:
- Download Prometheus image (~100 MB)
- Download Grafana image (~300 MB)
- Start both services
- Takes 2-5 minutes first time

### Step 5: Access Services

Once started:
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3002 (login: admin/admin)
- **Backend Metrics:** http://localhost:5000/metrics
- **Dashboard:** Open dashboard.html

---

## 🎯 What You'll See

### Prometheus (http://localhost:9090):
- Metrics explorer
- Query interface
- Target status
- Alerts

### Grafana (http://localhost:3002):
- Login with admin/admin
- Create dashboards
- Visualize metrics
- Set up alerts

---

## 📊 Quick Grafana Setup

### 1. Add Prometheus Data Source:
```
1. Login to Grafana (admin/admin)
2. Click "Add your first data source"
3. Select "Prometheus"
4. URL: http://prometheus:9090
5. Click "Save & Test"
```

### 2. Create Your First Dashboard:
```
1. Click "+" → "Create Dashboard"
2. Click "Add visualization"
3. Select Prometheus
4. In query, type: nf_load_percent
5. Click "Apply"
```

### 3. Pre-built Queries:
```
AMF Load: nf_load_percent{nf="amf"}
SMF Load: nf_load_percent{nf="smf"}
Total UEs: registered_ues_total
Throughput: upf_throughput_mbps
Sessions: nf_sessions_total
```

---

## ⏱️ Timeline

**Right now:**
- Docker Desktop is starting (wait 1-2 minutes)

**After Docker starts:**
- Run the commands above
- Wait 2-5 minutes for image download
- Access Prometheus & Grafana

**Total time:** ~10 minutes

---

## 🐛 If Docker Won't Start

### Try these:
1. **Restart Docker Desktop:**
   - Right-click Docker icon → Quit
   - Open Docker Desktop again

2. **Restart Computer:**
   - Sometimes needed after first install

3. **Check WSL 2:**
   ```powershell
   wsl --status
   ```

4. **Run as Administrator:**
   - Right-click PowerShell → Run as Administrator

---

## 💡 Alternative: Keep Current Setup

Your system works perfectly without Docker!

**Current setup:**
- ✅ Backend running manually
- ✅ Dashboard fully functional
- ✅ All features working
- ✅ Metrics available at /metrics endpoint

**With Docker:**
- ✅ Everything above PLUS
- ✅ Prometheus collecting metrics
- ✅ Grafana dashboards
- ✅ Historical data
- ✅ Advanced visualizations

---

## 🎯 Next Steps

1. **Wait** for Docker Desktop to fully start (check system tray icon)
2. **Run** `docker ps` to verify
3. **Start** backend: `python backend/app.py`
4. **Start** monitoring: `docker compose -f docker-compose-monitoring.yml up -d`
5. **Access** Grafana at http://localhost:3002

---

**I'll wait for Docker to be ready, then we can proceed!**

Let me know when you see "Docker Desktop is running" in the system tray.
