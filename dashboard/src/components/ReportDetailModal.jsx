import React, { useEffect } from 'react';

const VALID_NEXT_STATUSES = {
  Pending: ['Acknowledged'],
  Acknowledged: ['Rescue Dispatched', 'Resolved'],
  'Rescue Dispatched': ['Resolved'],
  Resolved: [],
};

export default function ReportDetailModal({ report, onClose, onUpdateStatus, saving }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!report) return null;

  const hasCoords =
    typeof report.latitude === 'number' &&
    typeof report.longitude === 'number' &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude);

  const allowedNext = VALID_NEXT_STATUSES[report.status] || [];

  const getStatusButtonText = (targetStatus) => {
    switch (targetStatus) {
      case 'Acknowledged':
        return '✓ Acknowledge SOS';
      case 'Rescue Dispatched':
        return '🚤 Dispatch Rescue Team';
      case 'Resolved':
        return '🏁 Mark Emergency Resolved';
      default:
        return `Set to ${targetStatus}`;
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-drawer" role="dialog" aria-modal="true" aria-label={`Emergency Dossier ${report.reportId}`}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div className="section-eyebrow">EMERGENCY DOSSIER</div>
            <h2>{report.reportId}</h2>
          </div>
          <button className="btn-close-drawer" onClick={onClose} aria-label="Close dossier">
            ✕
          </button>
        </div>

        {/* Status and Priority Callout */}
        <div className="drawer-status-bar">
          <span className={`status-pill pill-${report.status.toLowerCase().replace(/\s+/g, '-')}`}>
            Status: {report.status}
          </span>
          <span className={`delivery-pill pill-${(report.deliveryStatus || 'synced').toLowerCase()}`}>
            Delivery: {report.deliveryStatus || 'Synced'}
          </span>
          {report.isDemo && <span className="demo-tag">SIMULATED DATA</span>}
        </div>

        {/* People in danger callout */}
        <div className="dossier-alert-box">
          <div className="alert-count-col">
            <span className="alert-num">{report.peopleCount || 1}</span>
            <span className="alert-sub">People Needing Help</span>
          </div>
          <div className="alert-cat-col">
            <strong>Category: {report.category || 'Emergency'}</strong>
            <span>Priority: {report.status === 'Resolved' ? 'Closed' : report.peopleCount > 4 ? 'CRITICAL / MULTI-PERSON' : 'HIGH'}</span>
          </div>
        </div>

        {/* Emergency Message Body */}
        <div className="drawer-section">
          <h3>Emergency Message</h3>
          <div className="dossier-message-text">{report.message}</div>
        </div>

        {/* Location & GPS */}
        <div className="drawer-section">
          <h3>Location & Coordinates</h3>
          <div className="dossier-location-details">
            <div className="dossier-row">
              <span className="dossier-label">Landmark / Address:</span>
              <span className="dossier-val">{report.location || 'Not provided'}</span>
            </div>
            <div className="dossier-row">
              <span className="dossier-label">GPS Coordinates:</span>
              <span className="dossier-val">
                {hasCoords ? (
                  <>
                    {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    <a
                      className="osm-link"
                      href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=16/${report.latitude}/${report.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🗺️ Open on OpenStreetMap ↗
                    </a>
                  </>
                ) : (
                  <span className="text-muted">No GPS coordinates recorded for this report</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Store and Forward Offline Relay Telemetry */}
        <div className="drawer-section">
          <h3>Transmission & Relay Telemetry</h3>
          <div className="telemetry-grid">
            <div className="telemetry-box">
              <span className="tel-label">Channel</span>
              <span className="tel-val">{report.receivedVia || 'Internet'}</span>
            </div>
            <div className="telemetry-box">
              <span className="tel-label">Relay Hop Count</span>
              <span className="tel-val">{report.hopCount ?? 0}</span>
            </div>
            <div className="telemetry-box">
              <span className="tel-label">Store-and-Forward</span>
              <span className="tel-val">{report.deliveryStatus === 'Relayed' ? 'Yes (Via Nearby)' : 'Direct'}</span>
            </div>
            <div className="telemetry-box">
              <span className="tel-label">Device Identifier</span>
              <span className="tel-val">{report.deviceId || 'Pseudonymous'}</span>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="drawer-section">
          <h3>Audit Timeline</h3>
          <div className="timeline-list">
            <div className="timeline-item">
              <span className="tl-dot" />
              <div>
                <strong>Report Created:</strong> {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
            {report.syncedAt && (
              <div className="timeline-item">
                <span className="tl-dot" />
                <div>
                  <strong>Server Synced:</strong> {new Date(report.syncedAt).toLocaleString()}
                </div>
              </div>
            )}
            {report.updatedAt && (
              <div className="timeline-item">
                <span className="tl-dot" />
                <div>
                  <strong>Last Updated:</strong> {new Date(report.updatedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls for Operator */}
        <div className="drawer-actions-footer">
          {allowedNext.length > 0 ? (
            <div className="status-transition-buttons">
              {allowedNext.map((target) => (
                <button
                  key={target}
                  className={`btn-transition btn-target-${target.toLowerCase().replace(/\s+/g, '-')}`}
                  disabled={saving}
                  onClick={() => onUpdateStatus(report.reportId, target)}
                >
                  {saving ? 'Updating status…' : getStatusButtonText(target)}
                </button>
              ))}
            </div>
          ) : (
            <div className="resolved-notice">
              ✓ This emergency report has been resolved. No further transitions allowed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
