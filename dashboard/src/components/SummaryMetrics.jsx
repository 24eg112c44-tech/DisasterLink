import React from 'react';

export default function SummaryMetrics({ stats, loading }) {
  const cards = [
    {
      label: 'Total SOS Reports',
      value: stats?.total ?? (loading ? '…' : 0),
      desc: 'All recorded incidents',
      icon: '📋',
      tone: 'cyan',
    },
    {
      label: 'Active Emergencies',
      value: stats?.active ?? (loading ? '…' : 0),
      desc: 'In-progress or awaiting help',
      icon: '🚨',
      tone: 'red',
    },
    {
      label: 'Awaiting Assistance',
      value: stats?.awaitingAssistance ?? (loading ? '…' : 0),
      desc: 'Pending triage / dispatch',
      icon: '⏳',
      tone: 'amber',
    },
    {
      label: 'Resolved Emergencies',
      value: stats?.resolved ?? (loading ? '…' : 0),
      desc: 'Completed response operations',
      icon: '✅',
      tone: 'green',
    },
    {
      label: 'Relayed via Nearby Mesh',
      value: stats?.relayed ?? (loading ? '…' : 0),
      desc: 'Store-and-forward offline relay',
      icon: '📡',
      tone: 'blue',
    },
  ];

  return (
    <section className="metrics-grid" aria-label="Incident Summary Metrics">
      {cards.map((card) => (
        <div key={card.label} className={`metric-card metric-${card.tone}`}>
          <div className="metric-header">
            <span className="metric-icon">{card.icon}</span>
            <span className="metric-label">{card.label}</span>
          </div>
          <div className="metric-value">{card.value}</div>
          <div className="metric-desc">{card.desc}</div>
        </div>
      ))}
    </section>
  );
}
