import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const STATUS_COLORS = {
  Pending: '#ff4d6d',
  Acknowledged: '#ffaa00',
  'Rescue Dispatched': '#38bdf8',
  Resolved: '#34d399',
};

export default function AnalyticsCharts({ stats }) {
  const statusData = [
    { name: 'Pending', count: stats?.byStatus?.Pending || 0, color: STATUS_COLORS.Pending },
    { name: 'Acknowledged', count: stats?.byStatus?.Acknowledged || 0, color: STATUS_COLORS.Acknowledged },
    { name: 'Rescue Dispatched', count: stats?.byStatus?.['Rescue Dispatched'] || 0, color: STATUS_COLORS['Rescue Dispatched'] },
    { name: 'Resolved', count: stats?.byStatus?.Resolved || 0, color: STATUS_COLORS.Resolved },
  ];

  // 7-day trend
  const trendData = stats?.byDay && stats.byDay.length > 0
    ? stats.byDay
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (6 - i));
        return { day: d.toISOString().slice(5, 10), reports: 0 };
      });

  const categories = stats?.byCategory || [];
  const maxCategoryCount = Math.max(...categories.map((c) => c.reports), 1);

  return (
    <div className="analytics-grid">
      {/* 1. Status Breakdown */}
      <div className="panel chart-card">
        <div className="panel-title-row">
          <div>
            <h3>Reports by Status</h3>
            <p>Current pipeline distribution across triage stages</p>
          </div>
          <span className="live-pill">LIVE DB</span>
        </div>
        <div className="chart-canvas-wrapper">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} margin={{ top: 15, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Inflow Timeline */}
      <div className="panel chart-card">
        <div className="panel-title-row">
          <div>
            <h3>SOS Inflow Timeline</h3>
            <p>Incident reports logged over the past 7 days</p>
          </div>
        </div>
        <div className="chart-canvas-wrapper">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 15, right: 15, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }}
              />
              <Area type="monotone" dataKey="reports" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Category Breakdown */}
      <div className="panel category-card">
        <div className="panel-title-row">
          <div>
            <h3>Emergency Categories</h3>
            <p>Classification breakdown of active & resolved SOS calls</p>
          </div>
        </div>
        <div className="category-bars-list">
          {categories.length === 0 ? (
            <div className="empty-category-msg">No categorized incident reports recorded yet.</div>
          ) : (
            categories.map((c) => {
              const pct = Math.round((c.reports / maxCategoryCount) * 100);
              return (
                <div key={c.category} className="category-bar-item">
                  <div className="cat-label-row">
                    <span className="cat-name">{c.category || 'General Emergency'}</span>
                    <span className="cat-count">{c.reports} report{c.reports === 1 ? '' : 's'}</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
