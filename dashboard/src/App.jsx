import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchReports,
  fetchStats,
  fetchHealth,
  updateStatus,
  createReport,
  syncBatch,
} from './services/api';
import { DEMO_REPORTS, DEMO_STATS } from './services/demoData';

import SummaryMetrics from './components/SummaryMetrics';
import IncidentMap from './components/IncidentMap';
import AnalyticsCharts from './components/AnalyticsCharts';
import ReportsTable from './components/ReportsTable';
import ReportDetailModal from './components/ReportDetailModal';
import CreateSOSModal from './components/CreateSOSModal';
import DemoModeBanner from './components/DemoModeBanner';

export default function App() {
  // Live API data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Demo mode
  const [isDemo, setIsDemo] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Modals & action states
  const [selectedReport, setSelectedReport] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [submittingSOS, setSubmittingSOS] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Fetch live API data
  const loadData = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    setError('');
    try {
      const [reportsData, statsData, healthData] = await Promise.all([
        fetchReports({ page, limit: 50 }),
        fetchStats(),
        fetchHealth(),
      ]);

      setReports(reportsData.reports || []);
      setPages(reportsData.pages || 1);
      setTotal(reportsData.total || 0);
      setStats(statsData);
      setHealth(healthData);
    } catch (err) {
      setError(err.message || 'Unable to connect to DisasterLink API.');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [page, isDemo]);

  // Initial load and 25s auto-refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 25000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Toggle demo mode
  const handleToggleDemo = (enabled) => {
    setIsDemo(enabled);
    if (!enabled) {
      loadData();
      showToast('Switched to Live MongoDB / API Mode.');
    } else {
      showToast('Demo Mode Activated: Using simulated emergency scenario.');
    }
  };

  // Seed sample scenario to real database
  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const batch = DEMO_REPORTS.map((r) => ({
        reportId: `${r.reportId}-${Date.now().toString(36).slice(-4)}`,
        message: r.message,
        category: r.category,
        peopleCount: r.peopleCount,
        location: r.location,
        latitude: r.latitude,
        longitude: r.longitude,
        deliveryStatus: r.deliveryStatus,
        receivedVia: r.receivedVia,
        hopCount: r.hopCount,
        createdAt: r.createdAt,
      }));

      const res = await syncBatch(batch);
      showToast(`Successfully seeded ${res.accepted} reports into MongoDB! Switching to live mode.`);
      setIsDemo(false);
      setPage(1);
      await loadData();
    } catch (err) {
      showToast(`Failed to seed database: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (reportId, newStatus) => {
    setSavingId(reportId);
    try {
      if (isDemo) {
        // Update local demo array
        setReports((prev) =>
          prev.map((r) => (r.reportId === reportId ? { ...r, status: newStatus } : r))
        );
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport((prev) => ({ ...prev, status: newStatus }));
        }
        showToast(`Demo Status updated: ${reportId} → ${newStatus}`);
      } else {
        const res = await updateStatus(reportId, newStatus);
        showToast(`Status updated: ${reportId} → ${newStatus}`);
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.report);
        }
        await loadData();
      }
    } catch (err) {
      showToast(`Status transition failed: ${err.message}`);
    } finally {
      setSavingId('');
    }
  };

  // Create new SOS report
  const handleCreateSOS = async (payload) => {
    setSubmittingSOS(true);
    try {
      if (isDemo) {
        const demoNew = {
          ...payload,
          status: 'Pending',
          createdAt: new Date().toISOString(),
          isDemo: true,
        };
        setReports((prev) => [demoNew, ...prev]);
        showToast(`New SOS ${payload.reportId} added to Demo triage queue!`);
      } else {
        const res = await createReport(payload);
        showToast(`New SOS ${res.report.reportId} successfully registered in database!`);
        await loadData();
      }
    } finally {
      setSubmittingSOS(false);
    }
  };

  // Export CSV
  const handleExportCsv = (recordsToExport) => {
    const list = recordsToExport || (isDemo ? DEMO_REPORTS : reports);
    if (!list || list.length === 0) return;

    const headers = [
      'Report ID',
      'Created At',
      'Category',
      'Message',
      'People In Danger',
      'Location Description',
      'Latitude',
      'Longitude',
      'Emergency Status',
      'Delivery Status',
      'Received Via',
      'Relay Hop Count',
    ];

    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = list.map((r) => [
      escape(r.reportId),
      escape(r.createdAt),
      escape(r.category),
      escape(r.message),
      escape(r.peopleCount),
      escape(r.location),
      escape(r.latitude),
      escape(r.longitude),
      escape(r.status),
      escape(r.deliveryStatus),
      escape(r.receivedVia),
      escape(r.hopCount ?? 0),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disasterlink-sos-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Incident report CSV exported successfully.');
  };

  // Current display dataset
  const currentReports = isDemo ? DEMO_REPORTS : reports;
  const currentStats = isDemo ? DEMO_STATS : stats;
  const currentTotal = isDemo ? DEMO_REPORTS.length : total;

  return (
    <div className="disasterlink-app">
      {/* Toast Notification */}
      {toastMessage && (
        <aside className="toast-notification" role="status" aria-live="polite">
          {toastMessage}
        </aside>
      )}

      {/* Control Room Left Rail */}
      <nav className="control-rail" aria-label="Control Center Navigation">
        <div className="rail-brand-icon" title="DisasterLink Flood Response">
          DL
        </div>
        <div className="rail-status-pill" title="System Operational Pulse">
          <span className="pulse-dot" />
          <span className="rail-status-text">OPS</span>
        </div>
        <div className="rail-version">v1.2</div>
      </nav>

      {/* Main Content Area */}
      <main className="control-main">
        {/* Top Header */}
        <header className="control-header">
          <div className="header-titles">
            <div className="eyebrow-tag">FLOOD EMERGENCY RESPONSE SYSTEM</div>
            <h1>DisasterLink Operations Dashboard</h1>
            <p>Unified triage, spatial coordination, and store-and-forward mesh monitoring</p>
          </div>

          <div className="header-right-controls">
            {/* API Health Indicator */}
            <div className={`health-badge ${health?.database === 'connected' ? 'health-up' : 'health-down'}`}>
              <span className="health-dot" />
              <span>{health?.database === 'connected' ? 'API & MONGO CONNECTED' : 'BACKEND DISCONNECTED'}</span>
            </div>

            {/* Demo Mode Toggle */}
            <label className="demo-toggle-switch" title="Toggle between real database and simulated demo scenario">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => handleToggleDemo(e.target.checked)}
              />
              <span className="switch-slider" />
              <span className="switch-label">Demo Scenario</span>
            </label>

            {/* Dispatch New SOS */}
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              title="Manually log an SOS emergency report"
            >
              ➕ Log Emergency SOS
            </button>

            {/* Refresh */}
            <button
              className="btn btn-secondary"
              onClick={loadData}
              disabled={loading || isDemo}
              title="Fetch latest reports from backend"
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        {/* Demo Mode Notice Banner */}
        <DemoModeBanner
          isDemo={isDemo}
          onToggleDemo={handleToggleDemo}
          onSeedDatabase={handleSeedDatabase}
          seeding={seeding}
        />

        {/* API Error Banner */}
        {error && !isDemo && (
          <div className="system-error-banner" role="alert">
            <div className="error-content">
              <strong>Connection Issue:</strong> {error}
              <p>Make sure the backend is running (`cd backend &amp;&amp; npm run dev`) and MongoDB is active.</p>
            </div>
            <button className="btn btn-retry" onClick={loadData}>
              Retry Connection
            </button>
          </div>
        )}

        {/* Metric Summary Cards */}
        <SummaryMetrics stats={currentStats} loading={loading && !isDemo} />

        {/* Map & Analytics Grid */}
        <section className="spatial-analytics-grid">
          {/* Spatial Leaflet OpenStreetMap */}
          <IncidentMap
            reports={currentReports}
            onSelectReport={(r) => setSelectedReport(r)}
            isDemo={isDemo}
          />

          {/* Visual Analytics */}
          <AnalyticsCharts stats={currentStats} />
        </section>

        {/* SOS Incident Queue Table */}
        <section className="reports-section">
          <ReportsTable
            reports={currentReports}
            loading={loading && !isDemo}
            error={error}
            page={page}
            pages={pages}
            total={currentTotal}
            onPageChange={(p) => setPage(p)}
            onUpdateStatus={handleUpdateStatus}
            onSelectReport={(r) => setSelectedReport(r)}
            onExportCsv={handleExportCsv}
            savingId={savingId}
          />
        </section>

        {/* Operational Footer */}
        <footer className="control-footer">
          <div>
            <strong>DISASTERLINK FLOOD EMERGENCY RESPONSE PROTOTYPE</strong> · Educational &amp; Research System
          </div>
          <div>
            ⚠️ Supplementary civil aid system. In life-threatening emergencies, always dial official emergency services (911 / 112) when telephone networks are accessible.
          </div>
        </footer>
      </main>

      {/* Emergency Dossier Drawer */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdateStatus={handleUpdateStatus}
          saving={Boolean(savingId)}
        />
      )}

      {/* Log Emergency SOS Modal */}
      <CreateSOSModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSOS}
        submitting={submittingSOS}
      />
    </div>
  );
}
