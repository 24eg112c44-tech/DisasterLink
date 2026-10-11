import React, { useState } from 'react';

const STATUSES = ['All', 'Pending', 'Acknowledged', 'Rescue Dispatched', 'Resolved'];

// Valid transitions based on backend rules:
// Pending -> Acknowledged
// Acknowledged -> Rescue Dispatched, Resolved
// Rescue Dispatched -> Resolved
// Resolved -> None
const VALID_NEXT_STATUSES = {
  Pending: ['Pending', 'Acknowledged'],
  Acknowledged: ['Acknowledged', 'Rescue Dispatched', 'Resolved'],
  'Rescue Dispatched': ['Rescue Dispatched', 'Resolved'],
  Resolved: ['Resolved'],
};

export default function ReportsTable({
  reports = [],
  loading = false,
  error = '',
  page = 1,
  pages = 1,
  total = 0,
  onPageChange,
  onUpdateStatus,
  onSelectReport,
  onExportCsv,
  savingId = '',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  // Filter & sort
  const filteredReports = reports
    .filter((r) => {
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        (r.reportId && r.reportId.toLowerCase().includes(term)) ||
        (r.message && r.message.toLowerCase().includes(term)) ||
        (r.location && r.location.toLowerCase().includes(term)) ||
        (r.category && r.category.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'people') return (b.peopleCount || 1) - (a.peopleCount || 1);
      return 0;
    });

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(val);
    }
  };

  const hasCoords = (r) =>
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number' &&
    Number.isFinite(r.latitude) &&
    Number.isFinite(r.longitude);

  return (
    <div className="panel reports-table-panel">
      {/* Table Header Row */}
      <div className="table-top-header">
        <div>
          <div className="section-eyebrow">ACTIVE TRIAGE QUEUE</div>
          <h2>
            Incoming SOS Reports <span className="total-badge">{filteredReports.length} shown</span>
          </h2>
        </div>
        <div className="table-top-actions">
          <button
            className="btn btn-export"
            onClick={() => onExportCsv(filteredReports)}
            disabled={filteredReports.length === 0}
            title="Download visible reports as a CSV file"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-filters-bar">
        <div className="search-input-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search report ID, message text, landmark location…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search incident reports"
          />
          {searchTerm && (
            <button className="btn-clear-search" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <label className="filter-control">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-control">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="people">Highest People Count</option>
            </select>
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-scroll-container">
        <table className="reports-data-table">
          <thead>
            <tr>
              <th>REPORT ID</th>
              <th>EMERGENCY / MESSAGE</th>
              <th>LOCATION</th>
              <th>PEOPLE</th>
              <th>STATUS</th>
              <th>DELIVERY</th>
              <th>DATE & TIME</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && reports.length === 0 ? (
              <tr>
                <td colSpan="8" className="table-message-cell">
                  <div className="loading-spinner-row">
                    <span className="spinner-dot" /> Loading incoming SOS reports from database…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="8" className="table-message-cell error-cell">
                  ⚠️ Error loading reports: {error}
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td colSpan="8" className="table-message-cell empty-cell">
                  {reports.length === 0
                    ? 'No SOS reports registered in database yet. New emergency reports will appear here in real time.'
                    : 'No emergency reports match the current filter or search criteria.'}
                </td>
              </tr>
            ) : (
              filteredReports.map((r) => {
                const nextOptions = VALID_NEXT_STATUSES[r.status] || [r.status];
                const isResolved = r.status === 'Resolved';
                const isSaving = savingId === r.reportId;

                return (
                  <tr key={r.reportId} className={isResolved ? 'row-resolved' : ''}>
                    {/* ID */}
                    <td>
                      <button
                        className="btn-id-link"
                        onClick={() => onSelectReport(r)}
                        title="Click to view full emergency dossier"
                      >
                        {r.reportId}
                      </button>
                    </td>

                    {/* Message & Category */}
                    <td className="col-message">
                      <div className="category-pill">{r.category || 'General'}</div>
                      <div className="message-snippet">{r.message}</div>
                    </td>

                    {/* Location */}
                    <td className="col-location">
                      <div className="loc-text">{r.location || 'Landmark not specified'}</div>
                      {hasCoords(r) ? (
                        <div className="coords-text">
                          📍 {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                        </div>
                      ) : (
                        <div className="no-coords-text">No GPS fix</div>
                      )}
                    </td>

                    {/* People */}
                    <td className="col-people">
                      <span className={`people-badge ${r.peopleCount > 5 ? 'high-risk' : ''}`}>
                        👤 {r.peopleCount || 1}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-pill pill-${r.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {r.status}
                      </span>
                    </td>

                    {/* Delivery Status */}
                    <td>
                      <div className="delivery-info">
                        <span className={`delivery-pill pill-${(r.deliveryStatus || 'synced').toLowerCase()}`}>
                          {r.deliveryStatus || 'Synced'}
                        </span>
                        {r.hopCount > 0 && <span className="hop-pill">{r.hopCount} hop{r.hopCount === 1 ? '' : 's'}</span>}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="col-time">{formatDate(r.createdAt)}</td>

                    {/* Actions */}
                    <td className="col-actions">
                      <div className="actions-cluster">
                        <select
                          className="status-dropdown"
                          value={r.status}
                          disabled={isResolved || isSaving}
                          onChange={(e) => onUpdateStatus(r.reportId, e.target.value)}
                          aria-label={`Update status for ${r.reportId}`}
                        >
                          {nextOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-view-details"
                          onClick={() => onSelectReport(r)}
                          title="Open details"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          Page {page} of {pages} · Total {total} report{total === 1 ? '' : 's'} in database
        </div>
        <div className="pagination-buttons">
          <button
            className="btn btn-page"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            ← Previous
          </button>
          <button
            className="btn btn-page"
            disabled={page >= pages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
