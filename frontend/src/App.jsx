import React, { useState, useEffect } from 'react';
import { Activity, Wifi, Users, Database, Signal, AlertCircle, CheckCircle, XCircle, Gauge, BarChart3 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const App = () => {
  const [amfStatus, setAmfStatus] = useState({ status: 'active', load: 0, sessions: 0, registered_ues: 0 });
  const [smfStatus, setSmfStatus] = useState({ status: 'active', load: 0, sessions: 0, pdu_sessions: 0 });
  const [upfStatus, setUpfStatus] = useState({ status: 'active', throughput: 0, packets: 0 });
  const [ues, setUes] = useState([]);
  const [sessions, setSessions] = useState([
    { id: 'PDU-001', ue: 'UE-001', type: 'IPv4', qos: '5QI-9', upf: 'UPF-01', dataVolume: '2.4 GB' },
    { id: 'PDU-002', ue: 'UE-002', type: 'IPv4', qos: '5QI-7', upf: 'UPF-01', dataVolume: '1.8 GB' }
  ]);
  const [logs, setLogs] = useState([]);
  const [newUeImsi, setNewUeImsi] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [latencySeries, setLatencySeries] = useState(Array(20).fill(120));
  const [errorSeries, setErrorSeries] = useState(Array(20).fill(0.2));
  const [slaCompliance, setSlaCompliance] = useState({ target: 99.0, achieved: 99.0 });
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingSubscribers, setIsSyncingSubscribers] = useState(false);
  const [batchJson, setBatchJson] = useState(JSON.stringify([{ imsi: '310150999888777', msisdn: '9001000001' }], null, 2));
  const [deleteImsis, setDeleteImsis] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [processingAutomation, setProcessingAutomation] = useState(false);

  const notifyAutomation = (message, tone = 'success') => {
    setAutomationStatus({ message, tone, ts: Date.now() });
    setTimeout(() => setAutomationStatus(null), 6000);
  };

  const normalizeSubscribers = (list = []) =>
    list.map((sub, idx) => ({
      id: sub.imsi || `UE-${idx + 1}`,
      imsi: sub.imsi || `310150000000${idx}`,
      msisdn: sub.msisdn || '',
      status: sub.state || 'connected',
      ip: sub.ip || `10.45.0.${idx + 2}`,
      amf: sub.amf || 'AMF-01'
    }));

  const loadSubscribers = async (showToast = false) => {
    setIsSyncingSubscribers(true);
    try {
      const res = await fetch(`${API_BASE}/api/subscribers`);
      if (!res.ok) {
        throw new Error('Failed to load subscribers');
      }
      const data = await res.json();
      setUes(normalizeSubscribers(data.subscribers || []));
      if (showToast) {
        notifyAutomation('Subscriber inventory synced', 'success');
      }
    } catch (error) {
      notifyAutomation(error.message, 'error');
    } finally {
      setIsSyncingSubscribers(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
      try {
        const [metricsRes, logsRes] = await Promise.all([
          fetch(`${API_BASE}/api/metrics`),
          fetch(`${API_BASE}/api/logs`)
        ]);

        if (!metricsRes.ok) {
          throw new Error('Failed to load metrics');
        }

        const metricsJson = await metricsRes.json();
        const logsJson = logsRes.ok ? await logsRes.json() : [];

        if (!isMounted) return;

        const amf = metricsJson?.amf || {};
        const smf = metricsJson?.smf || {};
        const upf = metricsJson?.upf || {};

        setAmfStatus(prev => ({ ...prev, ...amf }));
        setSmfStatus(prev => ({ ...prev, ...smf }));
        setUpfStatus(prev => ({ ...prev, ...upf }));
        setLogs(logsJson);

        // Simulated observability signals derived from loads/throughput
        const loadImpact = Math.max(amf.load || 0, smf.load || 0);
        const nextLatency = Math.round(80 + loadImpact * 0.6 + Math.random() * 20);
        const nextErrorRate = Math.max(0.05, (loadImpact - 70) * 0.01);

        setLatencySeries(prev => [...prev.slice(-19), nextLatency]);
        setErrorSeries(prev => [...prev.slice(-19), Number(nextErrorRate.toFixed(3))]);

        const achieved = Math.max(
          92,
          100 - Math.max(0, loadImpact - 70) * 0.4 - (nextErrorRate * 100) * 0.2
        ).toFixed(2);
        setSlaCompliance({ target: 99.0, achieved: Number(achieved) });

        setApiError(null);
        setIsLoading(false);
      } catch (error) {
        if (!isMounted) return;
        setApiError(error.message);
        setIsLoading(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, []);

  const registerUe = async () => {
    if (newUeImsi.length !== 15) return;
    try {
      const res = await fetch(`${API_BASE}/restconf/data/open5gs:subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imsi: newUeImsi })
      });
      if (!res.ok) throw new Error('Failed to register UE');
      notifyAutomation(`UE ${newUeImsi} registered`, 'success');
      setLogs([{ time: new Date().toLocaleTimeString(), level: 'INFO', message: `${newUeImsi} registration complete` }, ...logs]);
      setNewUeImsi('');
      loadSubscribers();
    } catch (error) {
      notifyAutomation(error.message, 'error');
    }
  };

  const disconnectUe = (ueId) => {
    setUes(ues.map(ue => ue.id === ueId ? { ...ue, status: 'idle' } : ue));
    setLogs([{ time: new Date().toLocaleTimeString(), level: 'INFO', message: `${ueId} disconnected` }, ...logs]);
  };

  const createSession = (ueId) => {
    const newSession = {
      id: `PDU-${String(sessions.length + 1).padStart(3, '0')}`,
      ue: ueId,
      type: 'IPv4',
      qos: '5QI-9',
      upf: 'UPF-01',
      dataVolume: '0 MB'
    };
    setSessions([...sessions, newSession]);
    setLogs([{ time: new Date().toLocaleTimeString(), level: 'INFO', message: `PDU session ${newSession.id} established for ${ueId}` }, ...logs]);
  };

  const handleBatchProvision = async () => {
    setProcessingAutomation(true);
    try {
      const parsed = JSON.parse(batchJson || '[]');
      const payload = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch(`${API_BASE}/api/subscribers/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribers: payload })
      });
      if (!res.ok) throw new Error('Batch provisioning failed');
      const summary = await res.json();
      notifyAutomation(`Provisioned ${summary.created}/${summary.processed} subscribers`, 'success');
      loadSubscribers();
    } catch (error) {
      notifyAutomation(error.message, 'error');
    } finally {
      setProcessingAutomation(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!deleteImsis.trim()) return;
    setProcessingAutomation(true);
    try {
      const imsis = deleteImsis
        .split(/[\s,]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      const res = await fetch(`${API_BASE}/api/subscribers/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imsis })
      });
      if (!res.ok) throw new Error('Batch delete failed');
      const summary = await res.json();
      notifyAutomation(`Deleted ${summary.deleted} subscribers`, 'success');
      setDeleteImsis('');
      loadSubscribers();
    } catch (error) {
      notifyAutomation(error.message, 'error');
    } finally {
      setProcessingAutomation(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) {
      notifyAutomation('Please choose a CSV file', 'error');
      return;
    }
    setProcessingAutomation(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await fetch(`${API_BASE}/api/subscribers/import`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('CSV import failed');
      const summary = await res.json();
      notifyAutomation(`Imported ${summary.created} subscribers`, 'success');
      setCsvFile(null);
      loadSubscribers();
    } catch (error) {
      notifyAutomation(error.message, 'error');
    } finally {
      setProcessingAutomation(false);
    }
  };

  const handleExportSubscribers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscribers/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subscribers.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notifyAutomation('Export ready', 'success');
    } catch (error) {
      notifyAutomation(error.message, 'error');
    }
  };

  const StatusIndicator = ({ status }) => {
    if (status === 'active') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const LoadBar = ({ value, label }) => (
    <div className="mt-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold">{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            value > 80 ? 'bg-red-500' : value > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  const TrendSparkline = ({ data, color }) => {
    if (!data.length) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg viewBox="0 0 100 100" className="w-full h-12">
        <polyline
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={color}
          points={points}
        />
      </svg>
    );
  };

  const KpiCard = ({ label, value, subtitle, icon: Icon, trend, accent, accentColor = '#2563eb' }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {Icon && <Icon className={`w-8 h-8 ${accent}`} />}
      </div>
      {trend && <TrendSparkline data={trend} color={accentColor} />}
    </div>
  );

  const latestLatency = latencySeries[latencySeries.length - 1];
  const latestErrors = errorSeries[errorSeries.length - 1];
  const registeredUes = amfStatus.registered_ues || ues.length;
  const connectedUes = ues.filter(u => u.status === 'connected').length;
  const healthScore = Math.max(90, 100 - Math.max(amfStatus.load || 0, smfStatus.load || 0) * 0.25).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Signal className="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-3xl font-bold text-white">5G Core Management System</h1>
                  <p className="text-blue-100 text-sm">RESTCONF Control Plane & Monitoring</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-lg">
                <Activity className="w-5 h-5 text-white animate-pulse" />
                <span className="text-white font-semibold">LIVE</span>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <div className="flex space-x-1 p-2">
              {['overview', 'observability', 'ues', 'sessions', 'automation', 'logs'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    selectedTab === tab
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {apiError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Failed to refresh live telemetry: {apiError}
              </div>
            )}

            {automationStatus && (
              <div
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                  automationStatus.tone === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {automationStatus.message}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <Activity className="w-5 h-5 mr-2 animate-spin" />
                Loading live network telemetry...
              </div>
            )}

            {selectedTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Database className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-800">AMF</h3>
                      </div>
                      <StatusIndicator status={amfStatus.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Access & Mobility Management</p>
                    <LoadBar value={amfStatus.load} label="CPU Load" />
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Active Sessions</span>
                        <span className="font-bold text-blue-600">{amfStatus.sessions}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Users className="w-6 h-6 text-purple-600" />
                        <h3 className="text-lg font-bold text-gray-800">SMF</h3>
                      </div>
                      <StatusIndicator status={smfStatus.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Session Management Function</p>
                    <LoadBar value={smfStatus.load} label="CPU Load" />
                    <div className="mt-4 pt-4 border-t border-purple-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PDU Sessions</span>
                        <span className="font-bold text-purple-600">{smfStatus.sessions}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Wifi className="w-6 h-6 text-green-600" />
                        <h3 className="text-lg font-bold text-gray-800">UPF</h3>
                      </div>
                      <StatusIndicator status={upfStatus.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">User Plane Function</p>
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Throughput</span>
                        <span className="font-bold text-green-600">{Math.round(upfStatus.throughput)} Mbps</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Packets/s</span>
                        <span className="font-bold text-green-600">{upfStatus.packets.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-bold mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    System Metrics
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-sm text-gray-600 mb-1">Total UEs</div>
                      <div className="text-2xl font-bold text-gray-800">{registeredUes}</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-sm text-gray-600 mb-1">Connected UEs</div>
                      <div className="text-2xl font-bold text-green-600">
                        {connectedUes}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-sm text-gray-600 mb-1">Active Sessions</div>
                      <div className="text-2xl font-bold text-purple-600">{smfStatus.pdu_sessions || sessions.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-sm text-gray-600 mb-1">Network Health</div>
                      <div className="text-2xl font-bold text-blue-600">{healthScore}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'observability' && !isLoading && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard
                    label="RESTCONF Latency"
                    value={`${latestLatency} ms`}
                    subtitle="P95 latency across control plane calls"
                    icon={Gauge}
                    trend={latencySeries}
                    accent="text-blue-600"
                    accentColor="#2563eb"
                  />
                  <KpiCard
                    label="Error Budget"
                    value={`${(latestErrors * 100).toFixed(2)}%`}
                    subtitle="Request failure ratio (simulated)"
                    icon={AlertCircle}
                    trend={errorSeries.map(v => v * 100)}
                    accent="text-red-500"
                    accentColor="#dc2626"
                  />
                  <KpiCard
                    label="SLA Compliance"
                    value={`${slaCompliance.achieved}%`}
                    subtitle={`Target ${slaCompliance.target}%`}
                    icon={CheckCircle}
                    trend={[slaCompliance.achieved]}
                    accent={slaCompliance.achieved >= slaCompliance.target ? 'text-green-600' : 'text-yellow-500'}
                    accentColor={slaCompliance.achieved >= slaCompliance.target ? '#16a34a' : '#eab308'}
                  />
                  <KpiCard
                    label="UPF Throughput"
                    value={`${Math.round(upfStatus.throughput || 0)} Mbps`}
                    subtitle="Real-time user plane throughput"
                    icon={Wifi}
                    trend={latencySeries.map(() => Math.max(10, (upfStatus.throughput || 0) / 10))}
                    accent="text-emerald-600"
                    accentColor="#059669"
                  />
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Control Plane Load</p>
                        <h4 className="text-xl font-semibold text-gray-900">AMF vs SMF</h4>
                      </div>
                      <BarChart3 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">AMF</p>
                        <div className="w-full bg-gray-200 h-2 rounded-full">
                          <div
                            className="h-2 bg-blue-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, amfStatus.load || 0)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{Math.round(amfStatus.load || 0)}% utilization</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">SMF</p>
                        <div className="w-full bg-gray-200 h-2 rounded-full">
                          <div
                            className="h-2 bg-purple-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, smfStatus.load || 0)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{Math.round(smfStatus.load || 0)}% utilization</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">SLA Overview</p>
                        <h4 className="text-xl font-semibold text-gray-900">Availability Window</h4>
                      </div>
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <path
                            className="text-gray-200"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845
                               a 15.9155 15.9155 0 0 1 0 31.831
                               a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className={slaCompliance.achieved >= slaCompliance.target ? 'text-emerald-500' : 'text-yellow-500'}
                            strokeWidth="4"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            strokeDasharray={`${slaCompliance.achieved}, 100`}
                            d="M18 2.0845
                               a 15.9155 15.9155 0 0 1 0 31.831
                               a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-gray-900">{slaCompliance.achieved}%</span>
                          <span className="text-xs text-gray-500">uptime</span>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Target</span>
                          <span className="font-semibold text-gray-900">{slaCompliance.target}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Current</span>
                          <span className="font-semibold text-gray-900">{slaCompliance.achieved}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Status</span>
                          <span className={`font-semibold ${slaCompliance.achieved >= slaCompliance.target ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {slaCompliance.achieved >= slaCompliance.target ? 'On Track' : 'At Risk'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Traffic Mix</p>
                        <h4 className="text-xl font-semibold text-gray-900">UE & Session Insight</h4>
                      </div>
                      <Users className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Registered UEs</span>
                        <span className="font-semibold">{registeredUes}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Active PDU Sessions</span>
                        <span className="font-semibold">{smfStatus.pdu_sessions || sessions.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">UPF Packets</span>
                        <span className="font-semibold">{upfStatus.packets?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'ues' && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-bold mb-3">Register New UE</h3>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      placeholder="IMSI (15 digits)"
                      value={newUeImsi}
                      onChange={(e) => setNewUeImsi(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={registerUe}
                      disabled={newUeImsi.length !== 15}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Register UE
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">UE ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IMSI</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP Address</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">AMF</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {ues.map(ue => (
                        <tr key={ue.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{ue.id}</td>
                          <td className="px-4 py-3 font-mono text-sm">{ue.imsi}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              ue.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {ue.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">{ue.ip}</td>
                          <td className="px-4 py-3 text-sm">{ue.amf}</td>
                          <td className="px-4 py-3 space-x-2">
                            {ue.status === 'connected' && (
                              <>
                                <button
                                  onClick={() => createSession(ue.id)}
                                  className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                                >
                                  Create Session
                                </button>
                                <button
                                  onClick={() => disconnectUe(ue.id)}
                                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  Disconnect
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedTab === 'sessions' && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Session ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">UE</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">QoS</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">UPF</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sessions.map(session => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-sm">{session.id}</td>
                        <td className="px-4 py-3 font-mono text-sm">{session.ue}</td>
                        <td className="px-4 py-3 text-sm">{session.type}</td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            {session.qos}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{session.upf}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{session.dataVolume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedTab === 'automation' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Subscriber Automation</h3>
                    <p className="text-sm text-gray-500">Bulk provision, import/export, and clean up UE inventory.</p>
                  </div>
                  <button
                    onClick={() => loadSubscribers(true)}
                    className="px-4 py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    disabled={isSyncingSubscribers}
                  >
                    {isSyncingSubscribers ? 'Syncing...' : 'Sync subscribers'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h4 className="text-md font-semibold mb-2">Batch Provision (JSON)</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Paste an array of subscriber objects (`imsi`, `msisdn`, `k`, `opc`, `amf`, optional `dnn`). Existing IMSIs will be updated.
                    </p>
                    <textarea
                      className="w-full h-48 border border-gray-200 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                      value={batchJson}
                      onChange={(e) => setBatchJson(e.target.value)}
                    />
                    <button
                      onClick={handleBatchProvision}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      disabled={processingAutomation}
                    >
                      {processingAutomation ? 'Processing...' : 'Apply batch'}
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h4 className="text-md font-semibold mb-2">CSV Import / Export</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Columns supported: <code className="font-mono">imsi, msisdn, k, opc, amf, dnn</code>
                    </p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="w-full border border-dashed border-gray-300 rounded-lg p-3 text-sm"
                    />
                    <div className="flex items-center space-x-3 mt-4">
                      <button
                        onClick={handleCsvImport}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        disabled={processingAutomation}
                      >
                        {processingAutomation ? 'Importing...' : 'Import CSV'}
                      </button>
                      <button
                        onClick={handleExportSubscribers}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        Export current list
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h4 className="text-md font-semibold mb-2">Bulk Deregister</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Provide one or more IMSIs separated by commas or whitespace.
                  </p>
                  <textarea
                    className="w-full h-24 border border-gray-200 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-red-500"
                    value={deleteImsis}
                    onChange={(e) => setDeleteImsis(e.target.value)}
                    placeholder="310150123456789,310150123456790"
                  />
                  <button
                    onClick={handleBatchDelete}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    disabled={processingAutomation || !deleteImsis.trim()}
                  >
                    {processingAutomation ? 'Processing...' : 'Delete subscribers'}
                  </button>
                </div>
              </div>
            )}

            {selectedTab === 'logs' && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 p-4 font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex space-x-4">
                      <span className="text-gray-500">{log.time}</span>
                      <span className={`font-semibold ${
                        log.level === 'INFO' ? 'text-green-400' : 
                        log.level === 'WARNING' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;