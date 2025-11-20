import csv
import io
import os
import time
import threading

import requests
from flask import Flask, jsonify, request, Response, g, send_file
from flask_cors import CORS
from prometheus_client import Counter, Gauge, Histogram, CONTENT_TYPE_LATEST, generate_latest
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)

# MongoDB connection - Using in-memory storage for local development
try:
    mongo_client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000)
    db = mongo_client['open5gs']
    # Test connection
    mongo_client.server_info()
    print("✓ MongoDB connected successfully")
except Exception as e:
    print(f"⚠ MongoDB connection failed: {e}")
    print("⚠ Using in-memory storage instead")
    db = None

# In-memory storage fallback
_in_memory_subscribers = []

# Cache for metrics
metrics_cache = {
    'amf': {'status': 'active', 'load': 45, 'sessions': 127, 'registered_ues': 3},
    'smf': {'status': 'active', 'load': 62, 'sessions': 89, 'pdu_sessions': 89},
    'upf': {'status': 'active', 'throughput': 1240, 'packets': 45632}
}

ALERT_CONFIG = {
    'sla_target': float(os.getenv('SLA_TARGET', '99.0')),
    'latency_threshold_ms': float(os.getenv('LATENCY_THRESHOLD_MS', '150')),
    'load_threshold_percent': float(os.getenv('LOAD_THRESHOLD_PERCENT', '80')),
    'webhook_url': os.getenv('ALERT_WEBHOOK_URL', '').strip(),
    'cooldown_seconds': int(os.getenv('ALERT_COOLDOWN_SECONDS', '120')),
}
_alert_events = []
_last_alert_ts = {}

# Prometheus instrumentation
REQUEST_LATENCY = Histogram(
    'restconf_request_latency_seconds',
    'Latency for RESTCONF/management API requests',
    ['endpoint', 'method']
)
REQUEST_COUNTER = Counter(
    'restconf_requests_total',
    'Total RESTCONF/management API requests',
    ['endpoint', 'method', 'status_class']
)
NF_STATUS = Gauge('nf_status', 'Network function status (1 active, 0 down)', ['nf'])
NF_LOAD = Gauge('nf_load_percent', 'Network function load percentage', ['nf'])
NF_SESSIONS = Gauge('nf_sessions_total', 'Sessions handled per NF', ['nf'])
REGISTERED_UES = Gauge('registered_ues_total', 'Total registered UEs')
UPF_THROUGHPUT = Gauge('upf_throughput_mbps', 'UPF throughput Mbps')
UPF_PACKETS = Gauge('upf_packets_total', 'UPF packet count')


def _update_nf_gauges():
    """Push latest cache values to Prometheus gauges."""
    NF_STATUS.labels(nf='amf').set(1 if metrics_cache['amf']['status'] == 'active' else 0)
    NF_STATUS.labels(nf='smf').set(1 if metrics_cache['smf']['status'] == 'active' else 0)
    NF_STATUS.labels(nf='upf').set(1 if metrics_cache['upf']['status'] == 'active' else 0)

    NF_LOAD.labels(nf='amf').set(metrics_cache['amf']['load'])
    NF_LOAD.labels(nf='smf').set(metrics_cache['smf']['load'])
    NF_LOAD.labels(nf='upf').set(metrics_cache['upf'].get('throughput', 0) / 10)

    NF_SESSIONS.labels(nf='amf').set(metrics_cache['amf']['sessions'])
    NF_SESSIONS.labels(nf='smf').set(metrics_cache['smf']['pdu_sessions'])

    REGISTERED_UES.set(metrics_cache['amf']['registered_ues'])
    UPF_THROUGHPUT.set(metrics_cache['upf']['throughput'])
    UPF_PACKETS.set(metrics_cache['upf']['packets'])

def _estimate_latency():
    load = max(metrics_cache['amf'].get('load', 0), metrics_cache['smf'].get('load', 0))
    return 80 + load * 0.6


def _estimate_sla_score():
    load = max(metrics_cache['amf'].get('load', 0), metrics_cache['smf'].get('load', 0))
    latency_penalty = max(0, load - 70) * 0.4
    return max(90.0, 100 - latency_penalty)


def build_subscriber_document(data: dict) -> dict:
    imsi = str(data.get('imsi', '')).strip()
    if not imsi:
        raise ValueError('IMSI is required')

    msisdn = str(data.get('msisdn', '')).strip()
    k = str(data.get('k', '00112233445566778899aabbccddeeff')).strip()
    opc = str(data.get('opc', '63bfa50ee6523365ff14c1f45f88737d')).strip()
    amf = str(data.get('amf', '8000')).strip()
    dnn = data.get('dnn', 'internet')

    return {
        'imsi': imsi,
        'msisdn': msisdn,
        'security': {
            'k': k,
            'opc': opc,
            'amf': amf
        },
        'slice': [
            {
                'sst': int(data.get('sst', 1)),
                'default_indicator': True,
                'session': [
                    {
                        'name': dnn,
                        'type': data.get('type', 'IPv4'),
                        'ambr': data.get('ambr', {'uplink': '1 Gbps', 'downlink': '1 Gbps'}),
                        'qos': data.get('qos', {'index': 9, 'arp': {'priority': 8}})
                    }
                ]
            }
        ]
    }


def get_subscribers_from_db():
    if db is None:
        return _in_memory_subscribers
    return list(db.subscribers.find({}, {'_id': 0}))


def save_subscriber(doc):
    if db is not None:
        try:
            db.subscribers.update_one({'imsi': doc['imsi']}, {'$set': doc}, upsert=True)
        except Exception as exc:
            print(f"Error writing subscriber {doc['imsi']}: {exc}")
    else:
        # In-memory storage
        existing = next((i for i, s in enumerate(_in_memory_subscribers) if s.get('imsi') == doc['imsi']), None)
        if existing is not None:
            _in_memory_subscribers[existing] = doc
        else:
            _in_memory_subscribers.append(doc)


def record_alert(event_type, message, severity='warning', metadata=None):
    event = {
        'type': event_type,
        'message': message,
        'severity': severity,
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'metadata': metadata or {},
    }
    _alert_events.insert(0, event)
    if len(_alert_events) > 50:
        _alert_events.pop()

    webhook_url = ALERT_CONFIG['webhook_url']
    if webhook_url:
        try:
            requests.post(
                webhook_url,
                json={'text': f"[{severity.upper()}] {event_type}: {message}", 'payload': event},
                timeout=3,
            )
        except Exception as exc:
            print(f"Alert webhook delivery failed: {exc}")


def evaluate_alerts():
    now = time.time()
    cooldown = ALERT_CONFIG['cooldown_seconds']
    load_threshold = ALERT_CONFIG['load_threshold_percent']
    sla_target = ALERT_CONFIG['sla_target']

    latency = _estimate_latency()
    sla_score = _estimate_sla_score()

    if latency > ALERT_CONFIG['latency_threshold_ms']:
        last = _last_alert_ts.get('latency', 0)
        if now - last > cooldown:
            record_alert(
                'latency',
                f'Request latency reached {latency:.0f}ms (threshold {ALERT_CONFIG["latency_threshold_ms"]}ms)',
                severity='warning' if latency < ALERT_CONFIG['latency_threshold_ms'] * 1.2 else 'critical',
                metadata={'latency_ms': latency},
            )
            _last_alert_ts['latency'] = now

    if sla_score < sla_target:
        last = _last_alert_ts.get('sla', 0)
        if now - last > cooldown:
            record_alert(
                'sla',
                f'SLA compliance dropped to {sla_score:.2f}% (target {sla_target}%)',
                severity='critical' if sla_score < sla_target - 2 else 'warning',
                metadata={'sla': sla_score},
            )
            _last_alert_ts['sla'] = now

    for nf in ('amf', 'smf'):
        load = metrics_cache[nf].get('load', 0)
        if load > load_threshold:
            key = f'{nf}_load'
            last = _last_alert_ts.get(key, 0)
            if now - last > cooldown:
                severity = 'critical' if load > load_threshold + 10 else 'warning'
                record_alert(
                    'capacity',
                    f'{nf.upper()} load is {load:.0f}% (threshold {load_threshold}%)',
                    severity=severity,
                    metadata={'nf': nf, 'load': load},
                )
                _last_alert_ts[key] = now


def fetch_open5gs_metrics():
    """Background thread to fetch metrics from Open5GS"""
    while True:
        try:
            if db is not None:
                subscribers = db.subscribers.count_documents({})
                sessions = db.sessions.count_documents({'state': 'ACTIVE'})
                
                metrics_cache['amf']['registered_ues'] = subscribers
                metrics_cache['amf']['sessions'] = sessions
                metrics_cache['smf']['pdu_sessions'] = sessions
                
                metrics_cache['amf']['load'] = min(95, (sessions / 100) * 80) if sessions > 0 else 45
                metrics_cache['smf']['load'] = min(95, (sessions / 80) * 75) if sessions > 0 else 62
        except Exception as e:
            print(f"Error fetching metrics: {e}")
        
        _update_nf_gauges()
        evaluate_alerts()
        time.sleep(2)

# Start metrics collection thread
threading.Thread(target=fetch_open5gs_metrics, daemon=True).start()


@app.before_request
def _start_timer():
    g.request_start_time = time.perf_counter()


@app.after_request
def _record_metrics(response):
    start = getattr(g, 'request_start_time', None)
    endpoint = request.endpoint or 'unknown'
    method = request.method

    if start is not None:
        elapsed = time.perf_counter() - start
        REQUEST_LATENCY.labels(endpoint=endpoint, method=method).observe(elapsed)
        REQUEST_COUNTER.labels(
            endpoint=endpoint,
            method=method,
            status_class=str(response.status_code // 100)
        ).inc()
    return response

# ============================================
# RESTCONF API Endpoints (RFC 8040)
# ============================================

@app.route('/restconf/data/open5gs:core/amf', methods=['GET'])
def get_amf_config():
    """RESTCONF GET - Retrieve AMF configuration"""
    amf_config = {
        'open5gs:amf': {
            'id': 'AMF-01',
            'guami': {
                'plmn-id': {'mcc': '310', 'mnc': '150'},
                'amf-region-id': '02',
                'amf-set-id': '001',
                'amf-pointer': '00'
            },
            'tai': {
                'plmn-id': {'mcc': '310', 'mnc': '150'},
                'tac': '0001'
            },
            'ngap': {'addr': '0.0.0.0', 'port': 7777},
            'metrics': metrics_cache['amf']
        }
    }
    return jsonify(amf_config), 200

@app.route('/restconf/data/open5gs:core/smf', methods=['GET'])
def get_smf_config():
    """RESTCONF GET - Retrieve SMF configuration"""
    smf_config = {
        'open5gs:smf': {
            'id': 'SMF-01',
            'pfcp': {'addr': '0.0.0.0', 'port': 8805},
            'subnet': [
                {'dnn': 'internet', 'cidr': '10.45.0.0/16'}
            ],
            'metrics': metrics_cache['smf']
        }
    }
    return jsonify(smf_config), 200

@app.route('/restconf/data/open5gs:core/upf', methods=['GET'])
def get_upf_config():
    """RESTCONF GET - Retrieve UPF configuration"""
    upf_config = {
        'open5gs:upf': {
            'id': 'UPF-01',
            'pfcp': {'addr': '0.0.0.0', 'port': 8805},
            'gtpu': {'addr': '0.0.0.0', 'port': 2152},
            'metrics': metrics_cache['upf']
        }
    }
    return jsonify(upf_config), 200

@app.route('/restconf/data/open5gs:subscribers', methods=['GET'])
def get_subscribers():
    """RESTCONF GET - List all subscribers (UEs)"""
    subscribers = get_subscribers_from_db()
    return jsonify({'open5gs:subscribers': {'subscriber': subscribers}}), 200

@app.route('/restconf/data/open5gs:subscribers', methods=['POST'])
def create_subscriber():
    """RESTCONF POST - Register new subscriber"""
    data = request.json
    
    if not data or 'imsi' not in data:
        return jsonify({'error': 'IMSI is required'}), 400
    
    try:
        subscriber = build_subscriber_document(data)
        save_subscriber(subscriber)
        return jsonify({'status': 'created', 'subscriber': subscriber}), 201
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/restconf/data/open5gs:subscribers/subscriber=<imsi>', methods=['DELETE'])
def delete_subscriber(imsi):
    """RESTCONF DELETE - Remove subscriber"""
    try:
        if db is not None:
            result = db.subscribers.delete_one({'imsi': imsi})
            if result.deleted_count > 0:
                return jsonify({'status': 'deleted', 'imsi': imsi}), 200
            return jsonify({'error': 'Subscriber not found'}), 404
        else:
            # In-memory storage
            global _in_memory_subscribers
            original_len = len(_in_memory_subscribers)
            _in_memory_subscribers = [s for s in _in_memory_subscribers if s.get('imsi') != imsi]
            if len(_in_memory_subscribers) < original_len:
                return jsonify({'status': 'deleted', 'imsi': imsi}), 200
            return jsonify({'error': 'Subscriber not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/restconf/operations/open5gs:deregister-ue', methods=['POST'])
def deregister_ue():
    """RESTCONF RPC - Deregister UE from AMF"""
    data = request.json
    
    if not data or 'input' not in data or 'imsi' not in data['input']:
        return jsonify({'error': 'IMSI is required in input'}), 400
    
    imsi = data['input']['imsi']
    
    if db is not None:
        try:
            db.sessions.update_one(
                {'imsi': imsi},
                {'$set': {'state': 'DEREGISTERED'}}
            )
        except Exception as e:
            print(f"Error deregistering UE: {e}")
    
    return jsonify({
        'output': {
            'result': 'success',
            'message': f'UE {imsi} deregistered'
        }
    }), 200

# ============================================
# Additional REST API for dashboard
# ============================================

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get all NF metrics"""
    return jsonify(metrics_cache), 200


@app.route('/api/subscribers', methods=['GET'])
def api_list_subscribers():
    """Simplified subscribers listing for dashboard automation workflows."""
    return jsonify({'subscribers': get_subscribers_from_db()}), 200


@app.route('/api/subscribers/batch', methods=['POST'])
def api_batch_subscribers():
    """Create or update multiple subscribers in one payload."""
    payload = request.json or {}
    subscribers = payload.get('subscribers')
    if not isinstance(subscribers, list):
        return jsonify({'error': 'subscribers must be an array'}), 400

    summary = {'processed': 0, 'created': 0, 'errors': []}
    for entry in subscribers:
        summary['processed'] += 1
        try:
            doc = build_subscriber_document(entry or {})
            save_subscriber(doc)
            summary['created'] += 1
        except ValueError as exc:
            summary['errors'].append({'entry': entry, 'error': str(exc)})
    return jsonify(summary), 200


@app.route('/api/subscribers/batch-delete', methods=['POST'])
def api_batch_delete_subscribers():
    """Remove multiple subscribers by IMSI list."""
    payload = request.json or {}
    imsis = payload.get('imsis', [])
    if not isinstance(imsis, list):
        return jsonify({'error': 'imsis must be an array'}), 400

    deleted = 0
    if db is not None and imsis:
        try:
            result = db.subscribers.delete_many({'imsi': {'$in': [str(i).strip() for i in imsis if i]}})
            deleted = result.deleted_count
        except Exception as exc:
            return jsonify({'error': str(exc)}), 500
    else:
        # In-memory storage
        global _in_memory_subscribers
        imsi_set = {str(i).strip() for i in imsis if i}
        original_len = len(_in_memory_subscribers)
        _in_memory_subscribers = [s for s in _in_memory_subscribers if s.get('imsi') not in imsi_set]
        deleted = original_len - len(_in_memory_subscribers)

    return jsonify({'requested': len(imsis), 'deleted': deleted}), 200


@app.route('/api/subscribers/import', methods=['POST'])
def api_import_subscribers():
    """Import subscribers from a CSV upload."""
    if 'file' not in request.files:
        return jsonify({'error': 'file is required'}), 400

    upload = request.files['file']
    try:
        stream = io.StringIO(upload.stream.read().decode('utf-8'))
        reader = csv.DictReader(stream)
    except Exception as exc:
        return jsonify({'error': f'Invalid CSV: {exc}'}), 400

    summary = {'rows': 0, 'created': 0, 'errors': []}
    for row in reader:
        summary['rows'] += 1
        try:
            doc = build_subscriber_document(row)
            save_subscriber(doc)
            summary['created'] += 1
        except ValueError as exc:
            summary['errors'].append({'row': row, 'error': str(exc)})

    return jsonify(summary), 200


@app.route('/api/subscribers/export', methods=['GET'])
def api_export_subscribers():
    """Export subscribers as CSV for automation workflows."""
    subscribers = get_subscribers_from_db()
    fieldnames = ['imsi', 'msisdn', 'k', 'opc', 'amf', 'dnn']
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()

    for sub in subscribers:
        sec = sub.get('security', {})
        slices = sub.get('slice') or []
        sessions = slices[0].get('session') if slices else None
        session = sessions[0] if sessions else {}
        writer.writerow({
            'imsi': sub.get('imsi', ''),
            'msisdn': sub.get('msisdn', ''),
            'k': sec.get('k', ''),
            'opc': sec.get('opc', ''),
            'amf': sec.get('amf', ''),
            'dnn': session.get('name', 'internet')
        })

    csv_data = buffer.getvalue()
    buffer.close()
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=\"subscribers.csv\"'}
    )

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent system logs"""
    logs = [
        {'time': '14:32:15', 'level': 'INFO', 'nf': 'AMF', 'message': 'UE registration complete'},
        {'time': '14:31:48', 'level': 'INFO', 'nf': 'SMF', 'message': 'PDU session established'},
        {'time': '14:30:22', 'level': 'WARNING', 'nf': 'AMF', 'message': 'High CPU load detected'}
    ]
    return jsonify(logs), 200


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Expose recent alert events and config."""
    return jsonify({
        'alerts': _alert_events,
        'config': ALERT_CONFIG,
        'latency_estimate_ms': _estimate_latency(),
        'sla_estimate_percent': _estimate_sla_score(),
    }), 200


@app.route('/metrics', methods=['GET'])
def prometheus_metrics():
    """Prometheus scrape endpoint."""
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy', 
        'services': ['AMF', 'SMF', 'UPF'],
        'database': 'connected' if db is not None else 'disconnected'
    }), 200

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'name': '5G Core Management System',
        'version': '1.0.0',
        'restconf': '/restconf/data/open5gs:*',
        'api': '/api/*'
    }), 200

if __name__ == '__main__':
    print("=" * 60)
    print("5G Core RESTCONF Server Starting...")
    print("=" * 60)
    print("RESTCONF endpoints:")
    print("  GET  /restconf/data/open5gs:core/amf")
    print("  GET  /restconf/data/open5gs:core/smf")
    print("  GET  /restconf/data/open5gs:core/upf")
    print("  GET  /restconf/data/open5gs:subscribers")
    print("  POST /restconf/data/open5gs:subscribers")
    print("  DEL  /restconf/data/open5gs:subscribers/subscriber=<imsi>")
    print("  POST /restconf/operations/open5gs:deregister-ue")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)