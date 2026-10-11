import React, { useState } from 'react';

const CATEGORIES = ['Flooding', 'Medical', 'Trapped', 'Power Outage', 'Evacuation', 'Structural Hazard', 'Other'];

export default function CreateSOSModal({ isOpen, onClose, onSubmit, submitting }) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Flooding');
  const [peopleCount, setPeopleCount] = useState(1);
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      (err) => {
        setError(`Unable to retrieve location: ${err.message}. You can still submit with landmark text.`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setError('Please provide an emergency description.');
      return;
    }
    if (trimmedMsg.length > 2000) {
      setError('Message exceeds 2000 characters limit.');
      return;
    }

    const count = parseInt(peopleCount, 10);
    if (isNaN(count) || count < 1 || count > 10000) {
      setError('People count must be an integer between 1 and 10000.');
      return;
    }

    let lat = null;
    let lon = null;
    const hasLat = latitude.trim() !== '';
    const hasLon = longitude.trim() !== '';

    if (hasLat !== hasLon) {
      setError('Latitude and longitude must both be provided together, or leave both empty.');
      return;
    }

    if (hasLat && hasLon) {
      lat = parseFloat(latitude);
      lon = parseFloat(longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError('Latitude must be a valid number between -90 and 90.');
        return;
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        setError('Longitude must be a valid number between -180 and 180.');
        return;
      }
    }

    // Generate unique report ID for operator entry
    const uniqueId = `OPS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const payload = {
      reportId: uniqueId,
      message: trimmedMsg,
      category,
      peopleCount: count,
      location: location.trim(),
      latitude: lat,
      longitude: lon,
      receivedVia: 'Manual',
      deliveryStatus: 'Synced',
    };

    try {
      await onSubmit(payload);
      // Reset form
      setMessage('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setPeopleCount(1);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit emergency report.');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Dispatch New Emergency SOS">
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">DISPATCH LOGGING</div>
            <h2>New Emergency SOS Report</h2>
            <p>Log a phone/radio emergency call directly into the DisasterLink response queue</p>
          </div>
          <button className="btn-close-drawer" onClick={onClose} aria-label="Close form">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="emergency-message">
              Emergency Message <span className="req">*</span>
            </label>
            <textarea
              id="emergency-message"
              rows={3}
              placeholder="Describe the nature of the flood emergency, immediate hazards, trapped individuals, water level…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="emergency-category">Category</label>
              <select
                id="emergency-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="people-count">
                People in Danger <span className="req">*</span>
              </label>
              <input
                id="people-count"
                type="number"
                min="1"
                max="10000"
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="landmark-location">Location / Landmark Description</label>
            <input
              id="landmark-location"
              type="text"
              placeholder="e.g. River Street 14, 2nd floor balcony, opposite water tank"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-section-subtitle">
            <span>GPS Coordinates (Optional)</span>
            <button
              type="button"
              className="btn-gps-autofill"
              onClick={handleGetLocation}
              disabled={gpsLoading}
            >
              {gpsLoading ? 'Acquiring GPS…' : '📍 Use My Coordinates'}
            </button>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="latitude-val">Latitude (-90 to 90)</label>
              <input
                id="latitude-val"
                type="number"
                step="any"
                placeholder="e.g. 13.0827"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="longitude-val">Longitude (-180 to 180)</label>
              <input
                id="longitude-val"
                type="number"
                step="any"
                placeholder="e.g. 80.2707"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Registering SOS…' : '🚨 File Emergency SOS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
