import React from 'react';

export default function DemoModeBanner({ isDemo, onToggleDemo, onSeedDatabase, seeding }) {
  if (!isDemo) return null;

  return (
    <div className="demo-banner" role="status">
      <div className="demo-banner-content">
        <span className="demo-badge">DEMO MODE ACTIVE</span>
        <div className="demo-text">
          <strong>Viewing Simulated Flood Emergency Dataset.</strong>
          <span>
            These incident reports and map coordinates are generated for exercise and demonstration purposes. No live rescue signals are affected.
          </span>
        </div>
      </div>
      <div className="demo-actions">
        <button
          className="btn-seed"
          onClick={onSeedDatabase}
          disabled={seeding}
          title="Send these demo incidents into the live MongoDB database via POST /api/sos/sync"
        >
          {seeding ? 'Seeding MongoDB…' : '📥 Seed to Live Database'}
        </button>
        <button className="btn-exit-demo" onClick={() => onToggleDemo(false)}>
          Switch to Live API Mode
        </button>
      </div>
    </div>
  );
}
