import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

function MapBoundsUpdater({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    try {
      if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 13);
      } else {
        const lats = points.map((p) => p.latitude);
        const lons = points.map((p) => p.longitude);
        const southWest = [Math.min(...lats), Math.min(...lons)];
        const northEast = [Math.max(...lats), Math.max(...lons)];
        map.fitBounds([southWest, northEast], { padding: [40, 40], maxZoom: 14 });
      }
    } catch {
      // Ignore map bounds calculation errors if unmounted
    }
  }, [points, map]);

  return null;
}

export default function IncidentMap({ reports = [], onSelectReport, isDemo = false }) {
  const validPoints = reports.filter(
    (r) =>
      typeof r.latitude === 'number' &&
      typeof r.longitude === 'number' &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude) &&
      Math.abs(r.latitude) <= 90 &&
      Math.abs(r.longitude) <= 180
  );

  const unmappedCount = reports.length - validPoints.length;

  const getMarkerColor = (status) => {
    switch (status) {
      case 'Pending':
        return '#ff4d6d'; // Vivid Red
      case 'Acknowledged':
        return '#ffaa00'; // Amber
      case 'Rescue Dispatched':
        return '#38bdf8'; // Sky Blue
      case 'Resolved':
        return '#34d399'; // Emerald Green
      default:
        return '#94a3b8';
    }
  };

  // Center default: if points exist use the first, otherwise fallback
  const defaultCenter = validPoints.length > 0 ? [validPoints[0].latitude, validPoints[0].longitude] : [20.5937, 78.9629];

  return (
    <div className="panel incident-map-panel">
      <div className="panel-title-row">
        <div>
          <h2>Operational Incident Map</h2>
          <p>Real-time OpenStreetMap geographic cluster of coordinate-tagged SOS reports</p>
        </div>
        <div className="map-badge-group">
          {isDemo && <span className="demo-tag">SIMULATED COORDINATES</span>}
          <span className="map-stat-badge">
            📍 {validPoints.length} of {reports.length} Mapped
          </span>
        </div>
      </div>

      <div className="map-container-wrapper">
        <MapContainer center={defaultCenter} zoom={validPoints.length > 0 ? 12 : 4} scrollWheelZoom={true} className="leaflet-map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsUpdater points={validPoints} />

          {validPoints.map((r) => {
            const color = getMarkerColor(r.status);
            return (
              <CircleMarker
                key={r.reportId}
                center={[r.latitude, r.longitude]}
                radius={9}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="map-popup-card">
                    <div className="popup-top">
                      <span className="popup-id">{r.reportId}</span>
                      <span className={`status-pill pill-${r.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="popup-category">{r.category || 'Emergency'} · {r.peopleCount} {r.peopleCount === 1 ? 'person' : 'people'}</div>
                    <p className="popup-msg">{r.message}</p>
                    <div className="popup-meta">
                      <span><strong>Loc:</strong> {r.location || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`}</span>
                      <span><strong>Delivery:</strong> {r.deliveryStatus || 'Synced'} ({r.receivedVia || 'Direct'})</span>
                    </div>
                    {onSelectReport && (
                      <button className="popup-btn" onClick={() => onSelectReport(r)}>
                        View Full Dossier →
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="map-legend-row">
        <div className="legend-items">
          <span className="legend-item"><i style={{ background: '#ff4d6d' }} /> Pending</span>
          <span className="legend-item"><i style={{ background: '#ffaa00' }} /> Acknowledged</span>
          <span className="legend-item"><i style={{ background: '#38bdf8' }} /> Rescue Dispatched</span>
          <span className="legend-item"><i style={{ background: '#34d399' }} /> Resolved</span>
        </div>
        {unmappedCount > 0 && (
          <span className="unmapped-note">
            ⚠️ {unmappedCount} report{unmappedCount === 1 ? '' : 's'} without GPS (landmark description only)
          </span>
        )}
      </div>
    </div>
  );
}
